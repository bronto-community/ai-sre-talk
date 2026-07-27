// The simulation behind the "Scaling a service" demo.
//
// Pure functions only — no Vue, no DOM — so the six policies can be read as
// the argument they encode: each level takes work off the human and puts
// machinery in its place. The diff between `high` and `autonomy` is the whole
// L4 → L5 story, and it is about four lines long.

export const CAPACITY = 100      // req/s one instance can serve
export const CYCLE = 25          // seconds; the curve loops
export const MAX_LOAD = 1200     // y-axis ceiling
export const COST_PER_INSTANCE_S = 0.02   // € per idle instance-second

/** Instances needed to serve `load` with no headroom. Never scales to zero. */
export const instancesFor = (load: number) =>
  Math.max(1, Math.ceil(load / CAPACITY))

// Scripted load curve as [t, load] control points, linearly interpolated.
// Deterministic on purpose: what you rehearse is what you present. Every phase
// exists to make a specific level visibly fall short.
const PHASES: [number, number][] = [
  [0, 200], [5, 200],       // calm — every level copes
  [9, 600], [12, 600],      // ramp — L2's ±1 cannot keep pace
  [13, 1100], [17, 1100],   // flash spike — L3 only catches up after the fact
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

export interface Sample { t: number; load: number; instances: number }

export interface SimState {
  t: number                 // seconds since this level started
  load: number              // load right now
  instances: number         // instances running right now
  sinceLastChange: number   // seconds since the count last changed
  history: Sample[]         // oldest first, newest last
}

export type Decision =
  | { kind: 'set'; target: number }
  | { kind: 'ask'; from: number; to: number }
  | null

// L4/L5 scale into a ramp rather than after it by extrapolating the recent
// slope a couple of seconds forward.
const LOOKAHEAD = 2

// Slope over a 2s window, not a fixed sample count: at 60fps "the last 8
// samples" is 0.13s of history, which is noise, and extrapolating it sends the
// fleet oscillating between 1 and 24 instances.
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

// Above this, a computed *increase* looks implausible enough that L4 defers to a
// human. Only increases: scaling down is cheap to undo, scaling up 6× costs real
// money, and that asymmetry is when a real system stops to ask.
export const ASK_THRESHOLD = 6

// How often each level is even allowed to look. Real control loops run on a
// scrape interval, and giving L3 a 60Hz reaction time made it flawless — which
// erased the very gap that L4 and L5 exist to fill.
export const DECIDE_INTERVAL: Record<string, number> = {
  manual: 0,
  assisted: 0,
  // L2 and L3 look equally often on purpose: the only difference between them
  // is how much they move, so the comparison is about the "if", not the clock.
  linear: 1,
  conditional: 1,
  high: 1,
  autonomy: 1,
}

export const POLICIES: Record<string, (s: SimState) => Decision> = {
  // L0 — nothing happens without a human hand on the button.
  manual: () => null,

  // L1 — still nothing automatic. The human decides *when*; the script decides
  // *how much* (see runScaler). One click instead of ten, but the same watching.
  assisted: () => null,

  // L2 — a trigger and a fixed step. Utilisation thresholds, ±1 at a time.
  linear: (s) => {
    const util = s.load / (s.instances * CAPACITY)
    if (util > 0.9) return { kind: 'set', target: s.instances + 1 }
    if (util < 0.5 && s.instances > 1) return { kind: 'set', target: s.instances - 1 }
    return null
  },

  // L3 — branching on the actual number gets the size right immediately, but
  // only ever after the load has already moved.
  conditional: (s) => {
    const need = instancesFor(s.load)
    return need === s.instances ? null : { kind: 'set', target: need }
  },

  // L4 — predicts into the ramp, then stops and asks when the jump is large
  // enough to look wrong. Sophisticated, and still spending human attention.
  high: (s) => {
    const need = predictiveTarget(s)
    if (need === s.instances) return null
    if (need - s.instances > ASK_THRESHOLD)
      return { kind: 'ask', from: s.instances, to: need }
    return { kind: 'set', target: need }
  },

  // L5 — the same prediction with no question asked, plus the judgment to
  // recognise the collapse at t≈18 instead of scaling into it.
  autonomy: (s) => {
    if (isSuspectCollapse(s)) return null
    const need = predictiveTarget(s)
    return need === s.instances ? null : { kind: 'set', target: need }
  },
}

/** What L1's one-shot script does: size for right now, in a single action. */
export const runScaler = (load: number) => instancesFor(load)

// --- the simulation itself --------------------------------------------------
// Kept here rather than in the component so a test can run the whole 25s cycle
// headlessly and check that climbing a level actually costs less — the demo
// would quietly undercut the talk if the curve were mistuned.

export interface Sim {
  t: number
  instances: number
  dropped: number       // requests
  wasted: number        // €
  clicks: number        // human actions
  asks: number          // times the system stopped to ask
  sinceLastChange: number
  sinceDecision: number
  pending: { from: number; to: number } | null
  history: Sample[]
}

export function newSim(): Sim {
  return {
    t: 0,
    instances: instancesFor(loadAt(0)),
    dropped: 0, wasted: 0, clicks: 0, asks: 0,
    sinceLastChange: 0,
    sinceDecision: 0,
    pending: null,
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

  // An unanswered question stops the machine dead. That is the point of L4.
  const due = s.sinceDecision >= (DECIDE_INTERVAL[levelKey] ?? 0)
  if (!s.pending && due) {
    s.sinceDecision = 0
    const d = POLICIES[levelKey]({
      t: s.t, load, instances: s.instances,
      sinceLastChange: s.sinceLastChange, history: s.history,
    })
    if (d?.kind === 'set') {
      s.instances = Math.max(1, d.target)
      s.sinceLastChange = 0
    } else if (d?.kind === 'ask') {
      s.pending = { from: d.from, to: d.to }
      s.asks++
    }
  }

  // Both sides are charged, so "just max it out" is not a winning move.
  const served = s.instances * CAPACITY
  if (load > served) s.dropped += (load - served) * dt
  const idle = s.instances - instancesFor(load)
  if (idle > 0) s.wasted += idle * COST_PER_INSTANCE_S * dt

  s.history.push({ t: s.t, load, instances: s.instances })
  return true
}

/** Resolve a pending question. Counts as human work either way. */
export function resolveAsk(s: Sim, ok: boolean) {
  if (!s.pending) return
  if (ok) { s.instances = s.pending.to; s.sinceLastChange = 0 }
  s.pending = null
  s.clicks++
}
