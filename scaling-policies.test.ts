import { describe, it, expect } from 'vitest'

import {
  CAPACITY, CYCLE, MAX_LOAD, POLICIES, loadAt, instancesFor, runScaler,
  isSuspectCollapse, newSim, tick, resolveAsk, type SimState, type Sample,
} from './scaling-policies'
import { LEVELS } from './data'

// Build a state with a linear history ramping from `from` to `to` over `secs`.
function state(over: Partial<SimState> & { instances: number; load: number }): SimState {
  return {
    t: 0,
    sinceLastChange: 99,   // default: policy is free to act
    history: [],
    ...over,
  }
}

function ramp(from: number, to: number, secs: number, endT: number, instances: number): Sample[] {
  const n = 8
  return Array.from({ length: n }, (_, i) => {
    const k = i / (n - 1)
    return { t: endT - secs + k * secs, load: from + (to - from) * k, instances }
  })
}

describe('load curve', () => {
  it('is deterministic', () => {
    expect(loadAt(7)).toBe(loadAt(7))
  })

  it('loops every cycle', () => {
    for (const t of [0, 3.5, 11, 17.2, 24]) {
      expect(loadAt(t + CYCLE)).toBeCloseTo(loadAt(t), 6)
    }
  })

  it('collapses then rebounds, which is what L3 and L5 disagree about', () => {
    expect(loadAt(17)).toBeGreaterThan(1000)   // spike
    expect(loadAt(18.5)).toBeLessThan(300)     // collapse
    expect(loadAt(21)).toBeGreaterThan(800)    // rebound
  })
})

describe('instancesFor', () => {
  it('never scales to zero', () => {
    expect(instancesFor(0)).toBe(1)
  })

  it('rounds up to cover the load', () => {
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
})

describe('L2 linear', () => {
  it('moves one instance at a time, so it lags a steep ramp', () => {
    const s = state({ instances: 2, load: 600 })   // needs 6, badly under
    expect(POLICIES.linear(s)).toEqual({ kind: 'set', target: 3 })
  })

  // How *often* it may act is scheduling, which belongs to tick() — see the
  // full-run block below, where L2's one-step-per-second cadence is what makes
  // it lag the ramp.

  it('scales back down when utilisation drops', () => {
    const s = state({ instances: 6, load: 100 })
    expect(POLICIES.linear(s)).toEqual({ kind: 'set', target: 5 })
  })
})

describe('L3 conditional', () => {
  it('gets the size right in one step, but only after load has moved', () => {
    const s = state({ instances: 2, load: 600 })
    expect(POLICIES.conditional(s)).toEqual({ kind: 'set', target: 6 })
  })

  it('takes the collapse at face value and scales down into the rebound', () => {
    const s = state({
      instances: 11, load: 150,
      history: [
        { t: 16, load: 1100, instances: 11 },
        { t: 18, load: 150, instances: 11 },
      ],
    })
    expect(POLICIES.conditional(s)).toEqual({ kind: 'set', target: 2 })
  })
})

describe('L4 high automation', () => {
  it('asks a human when the computed jump looks implausible', () => {
    const s = state({
      instances: 2, load: 900,
      history: ramp(150, 900, 2, 20, 2),
    })
    const d = POLICIES.high(s)
    expect(d?.kind).toBe('ask')
    expect(d).toMatchObject({ from: 2 })
  })

  it('acts without asking when the change is modest', () => {
    const s = state({
      instances: 5, load: 600,
      history: ramp(580, 600, 2, 10, 5),
    })
    const d = POLICIES.high(s)
    expect(d === null || d.kind === 'set').toBe(true)
  })
})

describe('L5 full autonomy', () => {
  const collapsing = () => state({
    instances: 11, load: 150,
    history: [
      { t: 16, load: 1100, instances: 11 },
      { t: 16.5, load: 1100, instances: 11 },
      { t: 18, load: 150, instances: 11 },
    ],
  })

  it('recognises the collapse as suspect', () => {
    expect(isSuspectCollapse(collapsing())).toBe(true)
  })

  it('holds instead of scaling into it — the L4/L5 difference', () => {
    expect(POLICIES.autonomy(collapsing())).toBeNull()
    // ...where L3, on the identical reading, gives the capacity away
    expect(POLICIES.conditional(collapsing())).toEqual({ kind: 'set', target: 2 })
  })

  it('never stops to ask', () => {
    const s = state({
      instances: 2, load: 900,
      history: ramp(150, 900, 2, 20, 2),
    })
    expect(POLICIES.autonomy(s)?.kind).toBe('set')
  })
})

// The slide argues that climbing the ladder costs less human work and produces
// better outcomes. If the curve or a policy is mistuned the demo says the
// opposite on stage, so assert the claim rather than trusting it.
function runCycle(key: string, opts: { approve?: boolean } = {}) {
  const s = newSim()
  while (tick(s, 1 / 60, key)) {
    if (s.pending && opts.approve) resolveAsk(s, true)
  }
  return s
}

describe('a full 25s run — the claim the slide makes', () => {
  const r: Record<string, ReturnType<typeof runCycle>> = {}
  for (const l of LEVELS) r[l.key] = runCycle(l.key, { approve: true })

  it('drops fewer requests at every step up the ladder', () => {
    expect(r.linear.dropped).toBeLessThan(r.manual.dropped)
    expect(r.conditional.dropped).toBeLessThan(r.linear.dropped)
    expect(r.high.dropped).toBeLessThan(r.conditional.dropped)
    expect(r.autonomy.dropped).toBeLessThan(r.high.dropped)
  })

  it('leaves L0 and L1 equally helpless when nobody presses anything', () => {
    expect(r.manual.dropped).toBeCloseTo(r.assisted.dropped, 6)
    expect(r.manual.dropped).toBeGreaterThan(5000)
  })

  it('has L4 stop to ask exactly once, and L5 never', () => {
    expect(r.high.asks).toBe(1)
    expect(r.autonomy.asks).toBe(0)
  })

  it('punishes an ignored prompt — what needing a human actually costs', () => {
    const ignored = runCycle('high')          // nobody ever approves
    expect(ignored.dropped).toBeGreaterThan(r.high.dropped * 3)
  })

  it('has L5 pay in waste for the capacity it holds through the collapse', () => {
    expect(r.autonomy.wasted).toBeGreaterThan(r.conditional.wasted)
    expect(r.autonomy.dropped).toBeLessThan(r.conditional.dropped)
  })

  it('never lets the fleet run away', () => {
    for (const l of LEVELS) {
      const peak = Math.max(...r[l.key].history.map(h => h.instances))
      expect(peak).toBeLessThanOrEqual(instancesFor(MAX_LOAD))
    }
  })
})
