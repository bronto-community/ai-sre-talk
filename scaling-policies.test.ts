import { describe, it, expect } from 'vitest'

import {
  CAPACITY, CYCLE, MAX_LOAD, BASE_LATENCY, LAT_TARGET, TIMEOUT,
  POLICIES, loadAt, instancesFor, runScaler, isSuspectCollapse, recentCollapse,
  newSim, tick, humanScale, wasteCost, withinGuardrails,
  MIN_INSTANCES, MAX_INSTANCES,
  type SimState, type Sample,
} from './scaling-policies'
import { LEVELS } from './data'

function state(over: Partial<SimState> & { instances: number; load: number }): SimState {
  return {
    t: 0,
    latency: BASE_LATENCY,
    shedding: false,
    sinceLastChange: 99,
    history: [],
    ...over,
  }
}

function ramp(from: number, to: number, secs: number, endT: number, instances: number): Sample[] {
  const n = 12
  return Array.from({ length: n }, (_, i) => {
    const k = i / (n - 1)
    return {
      t: endT - secs + k * secs,
      load: from + (to - from) * k,
      instances, latency: BASE_LATENCY, shedding: false,
    }
  })
}

describe('load curve', () => {
  it('is deterministic and loops', () => {
    expect(loadAt(7)).toBe(loadAt(7))
    for (const t of [0, 3.5, 11, 17.2, 24]) {
      expect(loadAt(t + CYCLE)).toBeCloseTo(loadAt(t), 6)
    }
  })

  it('collapses then rebounds — what L3 and L5 disagree about', () => {
    expect(loadAt(17)).toBeGreaterThan(1000)   // spike
    expect(loadAt(18.5)).toBeLessThan(300)     // collapse
    expect(loadAt(21)).toBeGreaterThan(800)    // rebound
  })
})

// The heart of the model: overload is a queue, not an instant failure.
describe('the service under load', () => {
  it('degrades to latency long before it drops anything', () => {
    const s = newSim()
    let sawSlowButLossless = false
    while (tick(s, 1 / 60, 'manual')) {
      if (s.latency > BASE_LATENCY * 3 && s.dropped === 0) sawSlowButLossless = true
      if (s.dropped > 0) break
    }
    expect(sawSlowButLossless).toBe(true)
  })

  it('only fails requests once the backlog outlives the timeout', () => {
    const s = newSim()
    while (tick(s, 1 / 60, 'manual') && s.dropped === 0) { /* run to first loss */ }
    // at the moment of first loss the queue is exactly the timeout ceiling
    expect(s.latency).toBeGreaterThan(TIMEOUT * 0.9)
  })

  it('serves everything with latency at baseline when in balance', () => {
    const s = newSim()
    for (let i = 0; i < 60 * 4; i++) tick(s, 1 / 60, 'conditional')   // calm phase
    expect(s.dropped).toBe(0)
    expect(s.latency).toBeLessThan(LAT_TARGET)
  })
})

describe('instancesFor', () => {
  it('never scales to zero and rounds up to cover the load', () => {
    expect(instancesFor(0)).toBe(1)
    expect(instancesFor(CAPACITY * 3)).toBe(3)
    expect(instancesFor(CAPACITY * 3 + 1)).toBe(4)
  })
})

describe('L0 manual / L1 assisted', () => {
  it('never act on their own', () => {
    const s = state({ instances: 1, load: 1100 })
    expect(POLICIES.manual(s)).toBeNull()
    expect(POLICIES.assisted(s)).toBeNull()
  })

  it("L1's script sizes for right now in one action", () => {
    expect(runScaler(600)).toBe(6)
  })

  it('counts every human action, and records it as an event', () => {
    const s = newSim()
    tick(s, 1 / 60, 'manual')
    humanScale(s, 5)
    expect(s.clicks).toBe(1)
    expect(s.events.at(-1)).toMatchObject({ to: 5, kind: 'human' })
  })
})

describe('L2 linear', () => {
  // How *often* it may act is scheduling, owned by tick() — see the full run.
  it('moves one instance at a time, so it lags a steep ramp', () => {
    const s = state({ instances: 2, load: 600 })   // needs 6+, badly under
    expect(POLICIES.linear(s)).toEqual({ kind: 'set', target: 3 })
  })

  it('scales back down when utilisation drops', () => {
    const s = state({ instances: 6, load: 100 })
    expect(POLICIES.linear(s)).toEqual({ kind: 'set', target: 5 })
  })
})

describe('L3 conditional', () => {
  it('keeps headroom rather than sizing for exact saturation', () => {
    const s = state({ instances: 2, load: 800 })
    const d = POLICIES.conditional(s)
    // 8 would be exact; a utilisation target asks for more than that
    expect(d).toMatchObject({ kind: 'set' })
    expect((d as { target: number }).target).toBeGreaterThan(instancesFor(800))
  })

  it('takes the collapse at face value and gives the capacity away', () => {
    const s = state({
      instances: 11, load: 150,
      history: [
        { t: 16, load: 1100, instances: 11, latency: BASE_LATENCY, shedding: false },
        { t: 18, load: 150, instances: 11, latency: BASE_LATENCY, shedding: false },
      ],
    })
    const d = POLICIES.conditional(s) as { target: number }
    expect(d.target).toBeLessThan(5)
  })
})

describe('L4 high automation', () => {
  it('adds capacity to drain a backlog, which L3 structurally cannot see', () => {
    const hurting = state({ instances: 4, load: 400, latency: LAT_TARGET * 2.5 })
    const calm = state({ instances: 4, load: 400, latency: BASE_LATENCY })
    const d = POLICIES.high(hurting) as { target: number }
    expect(d.target).toBeGreaterThan(4)
    // same arrival rate, healthy latency -> no extra capacity wanted
    expect(POLICIES.high(calm)).toBeNull()
  })

  it('extrapolates a cliff into a nonsense number, which is what guardrails are for', () => {
    const s = state({
      t: 18.5, instances: 11, load: 150,
      history: [...ramp(1100, 1100, 1, 17, 11), ...ramp(1100, 150, 1.5, 18.5, 11)],
    })
    const want = (POLICIES.high(s) as { target: number }).target
    expect(want).toBeLessThan(MIN_INSTANCES)          // it wants to switch off
    expect(withinGuardrails(want)).toBe(MIN_INSTANCES) // the floor catches it
  })
})

describe('L5 full autonomy', () => {
  const collapsing = () => state({
    t: 18, instances: 11, load: 150,
    history: [
      { t: 16, load: 1100, instances: 11, latency: BASE_LATENCY, shedding: false },
      { t: 16.5, load: 1100, instances: 11, latency: BASE_LATENCY, shedding: false },
      { t: 18, load: 150, instances: 11, latency: BASE_LATENCY, shedding: false },
    ],
  })

  it('recognises the collapse and holds, where L3 gives the capacity away', () => {
    expect(isSuspectCollapse(collapsing())).toBe(true)
    expect(POLICIES.autonomy(collapsing())).toBeNull()
    expect((POLICIES.conditional(collapsing()) as { target: number }).target).toBeLessThan(5)
  })

  it('leads a ramp but never a fall, so it asks for nothing a guardrail must catch', () => {
    const falling = state({
      t: 18.5, instances: 11, load: 150,
      history: [...ramp(1100, 1100, 1, 17, 11), ...ramp(1100, 150, 1.5, 18.5, 11)],
    })
    const d = POLICIES.autonomy(falling)
    // it holds through a suspect collapse; if it does move, never below the floor
    if (d) expect(d.target).toBeGreaterThanOrEqual(MIN_INSTANCES)
  })
})

// The slide makes claims in front of an audience. Assert them rather than
// trusting them — a mistuned curve would quietly argue the opposite on stage.
function runCycle(key: string) {
  const s = newSim()
  while (tick(s, 1 / 60, key)) { /* nothing blocks; guardrails handle it */ }
  return s
}

describe('a full 25s run — the claims the slide makes', () => {
  const r: Record<string, ReturnType<typeof runCycle>> = {}
  for (const l of LEVELS) r[l.key] = runCycle(l.key)

  it('leaves L0 and L1 equally helpless when nobody presses anything', () => {
    expect(r.manual.dropped).toBeCloseTo(r.assisted.dropped, 6)
    expect(r.manual.dropped).toBeGreaterThan(5000)
  })

  it('stops losing requests entirely from L2 upward', () => {
    for (const k of ['linear', 'conditional', 'high', 'autonomy']) {
      expect(r[k].dropped).toBe(0)
    }
  })

  it('has L3 pay for its precision with a worse latency excursion than L2', () => {
    // more sophistication, a new failure mode: L3 gives capacity away on the
    // collapse and is caught by the rebound, where sluggish L2 never was.
    expect(r.conditional.peakLatency).toBeGreaterThan(r.linear.peakLatency)
  })

  it('has L4 and L5 hold latency at target where L2 and L3 cannot', () => {
    expect(r.high.peakLatency).toBeLessThan(r.linear.peakLatency)
    expect(r.autonomy.peakLatency).toBeLessThan(r.conditional.peakLatency)
    expect(r.autonomy.peakLatency).toBeLessThanOrEqual(LAT_TARGET + 0.05)
  })

  it('never blocks on a human — nothing in the run waits to be told what to do', () => {
    // L4 is contained by guardrails and pages someone; it does not stop.
    expect(r.high.dropped).toBe(0)
    expect(r.high.alerts.length).toBeGreaterThan(0)
  })

  it('trips a guardrail only where the model goes somewhere silly', () => {
    // ordinary levels have no model to go wrong
    for (const k of ['manual', 'assisted', 'linear', 'conditional']) {
      expect(r[k].alerts.length).toBe(0)
    }
    // and every trip is the floor catching a cliff extrapolation
    expect(r.high.alerts.every(a => a.bound === 'min')).toBe(true)
    expect(r.high.alerts.every(a => a.capped === MIN_INSTANCES)).toBe(true)
  })

  it('has L5 apply judgment where L4 needs a guardrail', () => {
    expect(r.autonomy.alerts.length).toBe(0)
    expect(r.autonomy.peakLatency).toBeLessThan(r.high.peakLatency)
  })

  it('keeps every fleet inside the guardrails', () => {
    for (const l of LEVELS) {
      for (const h of r[l.key].history) {
        expect(h.instances).toBeGreaterThanOrEqual(MIN_INSTANCES)
        expect(h.instances).toBeLessThanOrEqual(MAX_INSTANCES)
      }
    }
  })

  it('quotes waste at a scale anyone actually reacts to', () => {
    expect(wasteCost(r.conditional.idleSeconds)).toBeGreaterThan(1000)
  })

  it('charges nothing for waste at L0/L1 — they are never over-provisioned', () => {
    expect(r.manual.idleSeconds).toBe(0)
    expect(r.assisted.idleSeconds).toBe(0)
  })

  it('leaves L5 both cheaper and steadier than L4', () => {
    expect(r.autonomy.idleSeconds).toBeLessThan(r.high.idleSeconds)
    expect(r.autonomy.peakLatency).toBeLessThan(r.high.peakLatency)
  })

  it('records a trigger event for every automatic change', () => {
    for (const k of ['linear', 'conditional', 'high', 'autonomy']) {
      expect(r[k].events.length).toBeGreaterThan(5)
      expect(r[k].events.every(e => e.t > 0 && e.to >= 1)).toBe(true)
    }
    expect(r.manual.events.length).toBe(0)   // nobody touched it
  })

  it('never lets the fleet run away', () => {
    for (const l of LEVELS) {
      const peak = Math.max(...r[l.key].history.map(h => h.instances))
      expect(peak).toBeLessThanOrEqual(MAX_INSTANCES)
    }
  })
})
