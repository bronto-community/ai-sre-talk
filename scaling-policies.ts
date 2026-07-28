// The simulation behind the "Scaling a service" demo.
//
// Pure functions only — no Vue, no DOM — so the six policies can be read as the
// argument they encode: each level takes work off the human and puts machinery
// in its place. The diff between `high` and `autonomy` is the whole L4 → L5
// story, and it is about four lines long.

export const CAPACITY = 100      // req/s one instance can serve
export const CYCLE = 25          // seconds; the curve loops
export const MAX_LOAD = 1200     // y-axis ceiling
// This is a game, not a bill. Idle capacity costs a round number per
// instance-second so the waste column lands somewhere people actually react to,
// without pretending to forecast anything.
export const EUR_PER_IDLE_INSTANCE_SECOND = 50

export const wasteCost = (idleInstanceSeconds: number) =>
  idleInstanceSeconds * EUR_PER_IDLE_INSTANCE_SECOND

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
  [0, 200], [4, 200],       // calm — every level copes
  [6, 1100], [16, 1100],    // steep ramp then sustained peak: +9 instances
                            //   needed in 2s. L2 climbs one per second and is
                            //   still under water ten seconds later, so it is
                            //   the only automated level that actually loses
                            //   requests. It is the step size that beats L2,
                            //   not the reaction time — L3 jumps straight to
                            //   the right size and stays dry.
  [17, 150], [18, 150],     // collapse — L4's model extrapolates through zero
  [19, 900], [22, 900],     // rebound
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

export type Decision = { kind: 'set'; target: number } | null

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
  // Deliberately unbounded. Extrapolating the rebound gives an absurd number,
  // and containing that is the guardrail's job, not the predictor's — that is
  // the whole point of having one.
  return Math.max(0, last.load + slope * LOOKAHEAD)
}

// What the model actually believes, in both directions and without a floor —
// extrapolating a cliff asks for zero instances. Nothing here protects it from
// itself; that is the guardrail's job, and being clamped is how the human finds
// out the model went somewhere silly.
function predictiveTarget(s: SimState): number {
  return Math.ceil(predictedLoad(s) / CAPACITY)
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

// Guardrails. Every automated level runs inside them — a floor and a ceiling on
// the fleet, exactly like the min/max replicas on a real autoscaler. They are
// what stops a confident model from acting on a nonsense number. When one
// binds, the system keeps running and tells a human afterwards; it does not
// stop and wait to be told what to do.
export const MIN_INSTANCES = 2
export const MAX_INSTANCES = 18

const ANOMALY_MEMORY = 3

/** A sharp collapse in the recent past — the pattern L5 refuses to trust. */
export function recentCollapse(s: SimState): boolean {
  const w = s.history.filter(p => p.t >= s.t - ANOMALY_MEMORY)
  if (w.length < 2) return false
  const peak = Math.max(...w.map(p => p.load))
  const trough = Math.min(...w.map(p => p.load))
  return peak > 600 && trough < peak * 0.4
}

/** Clamp a desired fleet size into the guardrails. */
export const withinGuardrails = (n: number) =>
  Math.min(MAX_INSTANCES, Math.max(MIN_INSTANCES, n))

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
  // errors. In the corner case it extrapolates wildly and the guardrail
  // contains it — the failure of a confident model is a bounded one, plus a
  // human who now has an alert to explain.
  high: (s) => {
    const need = Math.max(predictiveTarget(s), backlogTarget(s))
    return need === s.instances ? null : { kind: 'set', target: need }
  },

  // L5 — the same signals with no question asked, plus the judgment to
  // recognise the collapse at t≈18 instead of scaling into it.
  autonomy: (s) => {
    if (isSuspectCollapse(s)) return null
    // Same model as L4, with the judgment to know when not to act on it:
    // it will lead a ramp but never a fall, and once it recognises an anomaly
    // it stops trusting the slope altogether. So it never asks for a number a
    // guardrail has to catch.
    const lead = recentCollapse(s) ? 0 : predictiveTarget(s)
    const need = Math.max(instancesFor(s.load), lead, backlogTarget(s))
    return need === s.instances ? null : { kind: 'set', target: need }
  },
}

// Capacity needed to drain what is already waiting. This term is what L3
// structurally cannot see: it reads arrivals, never the queue behind them.
function backlogTarget(s: SimState): number {
  const overshoot = s.latency / LAT_TARGET
  return overshoot > 1 ? Math.ceil(s.instances * Math.min(overshoot, 3)) : 0
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
  kind: 'auto' | 'human' | 'guard'
}

/** A guardrail bound something. The run continues; a human hears about it. */
export interface Alert {
  t: number
  wanted: number      // what the model asked for
  capped: number      // what the guardrail allowed
  bound: 'max' | 'min'
}

export interface Sim {
  t: number
  instances: number
  queue: number         // requests waiting to be served
  latency: number       // s
  shedding: boolean     // currently failing requests
  dropped: number       // requests
  idleSeconds: number   // idle instance-seconds; see annualWaste()
  clicks: number        // human actions
  alerts: Alert[]       // guardrail trips a human has to follow up on
  peakLatency: number   // s
  sinceLastChange: number
  sinceDecision: number
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
    dropped: 0, idleSeconds: 0, clicks: 0,
    alerts: [],
    peakLatency: BASE_LATENCY,
    sinceLastChange: 0,
    sinceDecision: 0,
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

  const due = s.sinceDecision >= (DECIDE_INTERVAL[levelKey] ?? 0)
  if (due) {
    s.sinceDecision = 0
    const d = POLICIES[levelKey]({
      t: s.t, load, instances: s.instances, latency: s.latency,
      shedding: s.shedding, sinceLastChange: s.sinceLastChange, history: s.history,
    })
    if (d) {
      // The guardrail binds whatever the model asked for. The system keeps
      // running on the clamped number and raises an alert — a human finds out,
      // and has to work out why, but nothing waits on them to answer.
      const wanted = d.target
      const target = withinGuardrails(wanted)
      if (wanted !== target) {
        s.alerts.push({
          t: s.t, wanted, capped: target,
          bound: wanted > target ? 'max' : 'min',
        })
      }
      if (target !== s.instances) {
        s.events.push({
          t: s.t, from: s.instances, to: target,
          kind: wanted !== target ? 'guard' : 'auto',
        })
        s.instances = target
        s.sinceLastChange = 0
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
  if (idle > 0) s.idleSeconds += idle * dt

  s.history.push({
    t: s.t, load, instances: s.instances, latency: s.latency, shedding: s.shedding,
  })
  return true
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
