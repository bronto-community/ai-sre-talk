// The simulation behind the "Scaling a service" demo.
//
// Pure functions only — no Vue, no DOM — so the six policies can be read as the
// argument they encode: each level takes work off the human and puts machinery
// in its place. The diff between `high` and `autonomy` is the whole L4 → L5
// story, and it is about four lines long.

export const CAPACITY = 100      // req/s one instance can serve
export const CYCLE = 25          // seconds; the curve loops
export const MAX_LOAD = 1200     // y-axis ceiling
export const COST_PER_INSTANCE_S = 0.02   // € per idle instance-second

// Overload does not drop requests, it queues them. Requests only fail once
// they have waited longer than the client is willing to wait. This is the
// difference between "the site is slow" and "the site is down", and it is why
// latency is the signal worth scaling on.
export const TIMEOUT = 2.5       // s a request waits before it gives up
export const BASE_LATENCY = 0.05 // s to serve a request with an empty queue
export const LAT_TARGET = 0.3    // s — the latency objective L4/L5 scale against

/** Instances needed to serve `load` with no headroom. Never scales to zero. */
export const instancesFor = (load: number) =>
  Math.max(1, Math.ceil(load / CAPACITY))

// Scripted load curve as [t, load] control points, linearly interpolated.
// Deterministic on purpose: what you rehearse is what you present. Every phase
// exists to make a specific level visibly fall short.
const PHASES: [number, number][] = [
  [0, 200], [5, 200],       // calm — every level copes
  [9, 600], [12, 600],      // ramp — L2's ±1 cannot keep pace
  [13, 1100], [17, 1100],   // flash spike — L3 sizes for arrivals, not backlog
  [18, 150], [19, 150],     // collapse — L3 believes it and scales down
  [20, 900], [22, 900],     // rebound — L4 computes a big jump and asks
  [25, 200],                // decay, then loop
]

/** Load at time `t` (seconds), wrapping around the cycle. */
export function loadAt(t: number): number {
  const x = ((t % CYCLE) + CYCLE) % CYCLE
  for (let i = 0; i < PHASES.length - 1; i++) {
    const [t0, l0] = PHASES[i]
    const [t1, l1] = PHASES[i + 1]
    if (x >= t0 && x <= t1) {
      const k = t1 === t0 ? 0 : (x - t0) / (t1 - t0)
      return l0 + (l1 - l0) * k
    }
  }
  return PHASES[PHASES.length - 1][1]
}

export interface Sample {
  t: number
  load: number
  instances: number
  latency: number
  shedding: boolean
}

export interface SimState {
  t: number                 // seconds since this level started
  load: number              // arrival rate right now
  instances: number
  latency: number           // what a user is currently experiencing
  shedding: boolean         // are we actually failing requests yet
  sinceLastChange: number
  history: Sample[]
}

export type Decision =
  | { kind: 'set'; target: number }
  | { kind: 'ask'; from: number; to: number }
  | null

// L4/L5 scale into a ramp rather than after it by extrapolating the recent
// slope. Slope over a 2s window, not a fixed sample count: at 60fps "the last 8
// samples" is 0.13s of history, which is noise, and extrapolating it sends the
// fleet oscillating between 1 and 24 instances.
const LOOKAHEAD = 2
const SLOPE_WINDOW = 2

function predictedLoad(s: SimState): number {
  const recent = s.history.filter(p => p.t >= s.t - SLOPE_WINDOW)
  if (recent.length < 2) return s.load
  const first = recent[0]
  const last = recent[recent.length - 1]
  const span = last.t - first.t
  if (span < 0.5) return s.load          // too short a span to trust a slope
  const slope = (last.load - first.load) / span
  // Clamped: a prediction may lead the curve, never leave the chart.
  return Math.max(0, Math.min(MAX_LOAD, last.load + slope * LOOKAHEAD))
}

// Lead the ramp, never the fall. A predictive scaler that extrapolates a
// downward slope shrinks the fleet just before the traffic comes back, which is
// how anticipation turns a dip into an outage. Prediction only ever raises the
// target; shrinking waits for the load to actually be gone.
function predictiveTarget(s: SimState): number {
  return instancesFor(Math.max(s.load, predictedLoad(s)))
}

// A near-vertical collapse after sustained high load is far more likely to be a
// broken upstream than real traffic going away. L5 makes that judgment call and
// holds; L3 takes the reading at face value and scales down into the rebound.
export function isSuspectCollapse(s: SimState): boolean {
  const h = s.history
  if (h.length < 2) return false
  const now = h[h.length - 1]
  const past = [...h].reverse().find(p => now.t - p.t >= 1.5)
  if (!past) return false
  return past.load > 600 && now.load < past.load * 0.4
}

// When a computed *increase* looks implausible enough that L4 defers to a
// human. Implausibility is about proportion, not absolute size: tripling the
// fleet in one step straight after a collapse looks wrong in a way that going
// 7 → 12 up a normal ramp does not. Only increases — scaling down is cheap to
// undo, scaling up 3× costs real money, and that asymmetry is when a real
// system stops to ask.
export const ASK_MIN_STEP = 3
// Once you have answered, it stops asking again for this episode.
const ASK_COOLDOWN = 6
const ASK_MIN_RATIO = 1.5
const ANOMALY_MEMORY = 3

/** A sharp collapse in the recent past — the pattern L5 refuses to trust. */
export function recentCollapse(s: SimState): boolean {
  const w = s.history.filter(p => p.t >= s.t - ANOMALY_MEMORY)
  if (w.length < 2) return false
  const peak = Math.max(...w.map(p => p.load))
  const trough = Math.min(...w.map(p => p.load))
  return peak > 600 && trough < peak * 0.4
}

/**
 * L4 stops to ask when it wants a materially bigger fleet in the shadow of an
 * anomaly it cannot explain. It is reading the *same* signal L5 acts on — the
 * difference is the confidence to act without a human, which is precisely what
 * separates the two levels.
 */
export function shouldAsk(s: SimState, need: number): boolean {
  return need - s.instances >= ASK_MIN_STEP
    && need >= s.instances * ASK_MIN_RATIO
    && recentCollapse(s)
}

// A real conditional autoscaler targets a utilisation, not saturation. Sizing
// for exactly the arrival rate leaves no headroom, so every transient queues.
const TARGET_UTIL = 0.8

// How often each level is even allowed to look. Real control loops run on a
// scrape interval — the trigger does not fire the instant a threshold is
// crossed, and that delay is worth showing on stage.
export const DECIDE_INTERVAL: Record<string, number> = {
  manual: 0,
  assisted: 0,
  // L2 and L3 look equally often on purpose: the only difference between them
  // is how much they move, so the comparison is about the "if", not the clock.
  linear: 1,
  conditional: 1,
  // L4/L5 run a tighter loop because latency is a fast signal: they are
  // reacting to the queue forming, not waiting for the next utilisation scrape.
  high: 0.5,
  autonomy: 0.5,
}

export const POLICIES: Record<string, (s: SimState) => Decision> = {
  // L0 — nothing happens without a human hand on the button.
  manual: () => null,

  // L1 — still nothing automatic. The human decides *when*; the script decides
  // *how much* (see runScaler). One click instead of ten, but the same watching.
  assisted: () => null,

  // L2 — a trigger and a fixed step, on the one signal it has: utilisation.
  linear: (s) => {
    const util = s.load / (s.instances * CAPACITY)
    if (util > 0.9) return { kind: 'set', target: s.instances + 1 }
    if (util < 0.5 && s.instances > 1) return { kind: 'set', target: s.instances - 1 }
    return null
  },

  // L3 — branching on the actual number gets the arrival rate right in one
  // step. It still cannot see the queue it already built, so it sizes for the
  // traffic arriving and never for the backlog waiting.
  conditional: (s) => {
    const need = instancesFor(s.load / TARGET_UTIL)
    return need === s.instances ? null : { kind: 'set', target: need }
  },

  // L4 — scales on what users actually feel. Latency against an objective and
  // whether anything is being shed, on top of a predicted arrival rate: that is
  // what "load + errors + latency + seasonality" buys you, and it moves before
  // L3 does because queueing shows up in latency long before it shows up as
  // errors. It still stops and asks when the jump looks implausible.
  high: (s) => {
    const need = latencyAwareTarget(s)
    if (need === s.instances) return null
    if (shouldAsk(s, need))
      return { kind: 'ask', from: s.instances, to: need }
    return { kind: 'set', target: need }
  },

  // L5 — the same signals with no question asked, plus the judgment to
  // recognise the collapse at t≈18 instead of scaling into it.
  autonomy: (s) => {
    if (isSuspectCollapse(s)) return null
    const need = latencyAwareTarget(s)
    return need === s.instances ? null : { kind: 'set', target: need }
  },
}

// Enough capacity for the traffic that is coming, plus enough to drain what is
// already waiting. The second term is what L3 structurally cannot do.
function latencyAwareTarget(s: SimState): number {
  const forArrivals = predictiveTarget(s)
  const overshoot = s.latency / LAT_TARGET
  const forBacklog = overshoot > 1
    ? Math.ceil(s.instances * Math.min(overshoot, 3))   // capped: no panic scaling
    : 0
  return Math.max(forArrivals, forBacklog)
}

/** What L1's one-shot script does: size for right now, in a single action. */
export const runScaler = (load: number) => instancesFor(load)

// --- the simulation itself --------------------------------------------------
// Kept here rather than in the component so a test can run the whole 25s cycle
// headlessly and check that climbing a level actually costs less — the demo
// would quietly undercut the talk if the curve were mistuned.

export interface ScaleEvent {
  t: number
  from: number
  to: number
  kind: 'auto' | 'human' | 'ask'
}

export interface Sim {
  t: number
  instances: number
  queue: number         // requests waiting to be served
  latency: number       // s
  shedding: boolean     // currently failing requests
  dropped: number       // requests
  wasted: number        // €
  clicks: number        // human actions
  asks: number          // times the system stopped to ask
  peakLatency: number   // s
  sinceAsk: number      // s since the last question was raised
  sinceLastChange: number
  sinceDecision: number
  pending: { from: number; to: number } | null
  events: ScaleEvent[]
  history: Sample[]
}

export function newSim(): Sim {
  return {
    t: 0,
    instances: instancesFor(loadAt(0)),
    queue: 0,
    latency: BASE_LATENCY,
    shedding: false,
    dropped: 0, wasted: 0, clicks: 0, asks: 0,
    peakLatency: BASE_LATENCY,
    sinceAsk: Infinity,
    sinceLastChange: 0,
    sinceDecision: 0,
    pending: null,
    events: [],
    history: [],
  }
}

/**
 * Advance `s` by `dt` seconds, mutating it.
 * Returns false when the cycle is complete, so the caller can start a fresh run.
 */
export function tick(s: Sim, dt: number, levelKey: string): boolean {
  s.t += dt
  if (s.t >= CYCLE) return false

  const load = loadAt(s.t)
  s.sinceLastChange += dt
  s.sinceDecision += dt
  s.sinceAsk += dt

  // An unanswered question stops the machine dead. That is the point of L4.
  const due = s.sinceDecision >= (DECIDE_INTERVAL[levelKey] ?? 0)
  if (!s.pending && due) {
    s.sinceDecision = 0
    const d = POLICIES[levelKey]({
      t: s.t, load, instances: s.instances, latency: s.latency,
      shedding: s.shedding, sinceLastChange: s.sinceLastChange, history: s.history,
    })
    if (d?.kind === 'set') {
      const target = Math.max(1, d.target)
      if (target !== s.instances) {
        s.events.push({ t: s.t, from: s.instances, to: target, kind: 'auto' })
        s.instances = target
        s.sinceLastChange = 0
      }
    } else if (d?.kind === 'ask') {
      // Having just been told yes, it does not re-open the same question for
      // the rest of the episode — it acts.
      if (s.sinceAsk < ASK_COOLDOWN) {
        s.events.push({ t: s.t, from: s.instances, to: d.to, kind: 'auto' })
        s.instances = Math.max(1, d.to)
        s.sinceLastChange = 0
      } else {
        s.pending = { from: d.from, to: d.to }
        s.events.push({ t: s.t, from: d.from, to: d.to, kind: 'ask' })
        s.sinceAsk = 0
        s.asks++
      }
    }
  }

  // The service: arrivals queue up, the fleet drains the queue, and only
  // requests that wait longer than TIMEOUT are actually lost. A load increase
  // costs latency first and errors only once the backlog outlives the client.
  const arrivals = load * dt
  const throughput = s.instances * CAPACITY
  const served = Math.min(s.queue + arrivals, throughput * dt)
  s.queue = Math.max(0, s.queue + arrivals - served)

  const maxQueue = TIMEOUT * throughput
  if (s.queue > maxQueue) {
    s.dropped += s.queue - maxQueue
    s.queue = maxQueue
    s.shedding = true
  } else {
    s.shedding = false
  }

  s.latency = BASE_LATENCY + s.queue / throughput
  s.peakLatency = Math.max(s.peakLatency, s.latency)

  // Both sides are charged, so "just max it out" is not a winning move.
  const idle = s.instances - instancesFor(load)
  if (idle > 0) s.wasted += idle * COST_PER_INSTANCE_S * dt

  s.history.push({
    t: s.t, load, instances: s.instances, latency: s.latency, shedding: s.shedding,
  })
  return true
}

/** Resolve a pending question. Counts as human work either way. */
export function resolveAsk(s: Sim, ok: boolean) {
  if (!s.pending) return
  if (ok) {
    s.events.push({ t: s.t, from: s.instances, to: s.pending.to, kind: 'human' })
    s.instances = s.pending.to
    s.sinceLastChange = 0
  }
  s.pending = null
  s.clicks++
}

/** A human moving the fleet by hand (L0) or running the one-shot script (L1). */
export function humanScale(s: Sim, target: number) {
  const to = Math.max(1, target)
  if (to !== s.instances) {
    s.events.push({ t: s.t, from: s.instances, to, kind: 'human' })
    s.instances = to
    s.sinceLastChange = 0
  }
  s.clicks++
}
