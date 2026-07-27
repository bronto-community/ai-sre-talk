<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

import { LEVELS, DOMAINS, TRANSITIONS } from '../data'
import {
  CAPACITY, CYCLE, MAX_LOAD,
  loadAt, instancesFor, runScaler,
  newSim, tick, resolveAsk, type Sim,
} from '../scaling-policies'

// "Scaling a service" as something you do, not something you read. The load
// curve runs on a real clock; each Slidev click hands more of the work to the
// system, until at L5 there is nothing left for you to press.
const props = defineProps<{ stage?: number }>()

const domain = computed(() => DOMAINS.find(d => d.key === 'resource-mgmt')!)

const level = ref(0)
const levelKey = computed(() => LEVELS[level.value].key)

// Chart geometry. Fixed viewBox, scaled by CSS, so it reads at any projector size.
const W = 1000, H = 240, FLOOR = 225, ROOF = 20
const X = (t: number) => (t / CYCLE) * W
const Y = (v: number) => FLOOR - (v / MAX_LOAD) * (FLOOR - ROOF)

// --- simulation state -------------------------------------------------------
// The sim itself is a plain object from scaling-policies, deliberately not a
// ref: its history grows to ~1500 samples and is rewritten every frame, which
// is exactly the shape deep reactivity is worst at. `frame` is the single
// reactive trigger everything below reads.
let sim: Sim = newSim()
const frame = ref(0)
const paused = ref(false)

function reset() {
  sim = newSim()
  frame.value++
}

// Each level replays the identical 25 seconds from a clean slate, so the
// numbers at the bottom are directly comparable between levels.
watch(() => props.stage, s => {
  if (typeof s !== 'number') return
  level.value = Math.max(0, Math.min(LEVELS.length - 1, s))
  reset()
}, { immediate: true })

// --- the clock --------------------------------------------------------------
const reduced = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches
const MIN_STEP = reduced ? 1 / 20 : 1 / 60

let raf = 0
let last = 0
let visible = false
let acc = 0

function step(now: number) {
  raf = requestAnimationFrame(step)
  if (!last) last = now
  let dt = (now - last) / 1000
  last = now
  if (!visible || paused.value) return

  // Clamp so a backgrounded tab or a slow frame cannot fast-forward the sim.
  dt = Math.min(dt, 0.1)
  acc += dt
  if (acc < MIN_STEP) return
  dt = acc
  acc = 0

  if (!tick(sim, dt, levelKey.value)) { reset(); return }   // one clean run per pass
  frame.value++
}

// --- human controls ---------------------------------------------------------
function bump(n: number) {
  sim.instances = Math.max(1, sim.instances + n)
  sim.sinceLastChange = 0
  sim.clicks++
  frame.value++
}
function scaleNow() {
  sim.instances = runScaler(loadAt(sim.t))
  sim.sinceLastChange = 0
  sim.clicks++
  frame.value++
}
function resolve(ok: boolean) {
  resolveAsk(sim, ok)
  frame.value++
}

// `a` approves without hunting for the mouse — the escape hatch for being
// mid-sentence when L4 interrupts.
function onKey(e: KeyboardEvent) {
  if (!visible || !sim.pending) return
  if (e.key === 'a') { e.preventDefault(); resolve(true) }
}

const root = ref<HTMLElement | null>(null)
let io: IntersectionObserver | null = null

onMounted(() => {
  // Slidev keeps neighbouring slides mounted; only run while actually on screen.
  io = new IntersectionObserver(
    ([e]) => { visible = e.isIntersecting; last = 0 },
    { threshold: 0.1 },
  )
  if (root.value) io.observe(root.value)
  window.addEventListener('keydown', onKey)
  raf = requestAnimationFrame(step)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  io?.disconnect()
  window.removeEventListener('keydown', onKey)
})

// --- derived drawing --------------------------------------------------------
// The full curve, drawn faintly the whole time so you can point ahead on stage
// ("watch what happens here") before the playhead reaches it.
const ghost = computed(() => {
  const pts: string[] = []
  for (let x = 0; x <= CYCLE; x += 0.2) pts.push(`${X(x)},${Y(loadAt(x))}`)
  return pts.join(' ')
})

const loadLine = computed(() => {
  frame.value
  return sim.history.map(p => `${X(p.t)},${Y(p.load)}`).join(' ')
})

// Capacity as a staircase — it only moves when the instance count moves.
const capLine = computed(() => {
  frame.value
  const pts: string[] = []
  let prev = -1
  for (const p of sim.history) {
    const y = Y(p.instances * CAPACITY)
    if (p.instances !== prev && prev !== -1) pts.push(`${X(p.t)},${Y(prev * CAPACITY)}`)
    pts.push(`${X(p.t)},${y}`)
    prev = p.instances
  }
  return pts.join(' ')
})

// Contiguous runs where one curve is above the other, as filled polygons:
// red where load outruns capacity, grey where capacity sits idle.
function bands(over: boolean): string[] {
  const out: string[] = []
  let run: typeof sim.history = []
  const flush = () => {
    if (run.length > 1) {
      const top = run.map(s => `${X(s.t)},${Y(over ? s.load : s.instances * CAPACITY)}`)
      const bot = [...run].reverse().map(s => `${X(s.t)},${Y(over ? s.instances * CAPACITY : s.load)}`)
      out.push([...top, ...bot].join(' '))
    }
    run = []
  }
  for (const p of sim.history) {
    const served = p.instances * CAPACITY
    const hit = over ? p.load > served : served > p.load
    if (hit) run.push(p); else flush()
  }
  flush()
  return out
}

const errorBands = computed(() => { frame.value; return bands(true) })
const wasteBands = computed(() => { frame.value; return bands(false) })

const playX = computed(() => { frame.value; return X(sim.t) })
const nowLoad = computed(() => { frame.value; return loadAt(sim.t) })
const needed = computed(() => instancesFor(nowLoad.value))
const overloaded = computed(() => { frame.value; return sim.instances < needed.value })

const boxes = computed(() => { frame.value; return Math.min(sim.instances, 16) })

// read-only views for the template
const instances = computed(() => { frame.value; return sim.instances })
const dropped = computed(() => { frame.value; return sim.dropped })
const wasted = computed(() => { frame.value; return sim.wasted })
const clicks = computed(() => { frame.value; return sim.clicks })
const pending = computed(() => { frame.value; return sim.pending })
</script>

<template>
  <div ref="root" class="scaler">
    <!-- level caption: keeps the ladder's teaching without the wall of text -->
    <div class="cap" :style="{ '--c': LEVELS[level].color }">
      <span class="chip" :style="{ background: LEVELS[level].color, color: LEVELS[level].ink }">
        {{ LEVELS[level].short }}
      </span>
      <span class="lname">{{ LEVELS[level].name }}</span>
      <span class="what">{{ domain.cells[levelKey] }}</span>
      <span v-if="TRANSITIONS[levelKey]" class="need">
        <b>+ needs</b> {{ TRANSITIONS[levelKey] }}
      </span>
    </div>

    <div class="chartwrap">
      <svg :viewBox="`0 0 ${W} ${H}`" class="chart" preserveAspectRatio="none">
        <polygon v-for="(p, i) in wasteBands" :key="'w' + i" :points="p" class="band waste" />
        <polygon v-for="(p, i) in errorBands" :key="'e' + i" :points="p" class="band err" />
        <polyline :points="ghost" class="ghost" />
        <polyline :points="capLine" class="cap-line" />
        <polyline :points="loadLine" class="load-line" />
        <line :x1="playX" :y1="ROOF - 8" :x2="playX" :y2="FLOOR" class="playhead" />
      </svg>

      <div v-if="pending" class="ask">
        <div class="ask-t">Unusual pattern</div>
        <div class="ask-b">Scale {{ pending.from }} → {{ pending.to }} instances?</div>
        <div class="ask-r">
          <button class="go" @click="resolve(true)">approve <kbd>a</kbd></button>
          <button @click="resolve(false)">deny</button>
        </div>
      </div>
    </div>

    <!-- the fleet itself: what is actually being scaled -->
    <div class="fleet">
      <div
        v-for="i in boxes" :key="i"
        class="inst"
        :class="{ hot: overloaded, idle: i > needed }"
      />
      <span class="fleet-n">{{ instances }} × instance</span>
    </div>

    <div class="foot">
      <div class="stats">
        <!-- pinned to en-US: on a German machine toLocaleString() renders 3548
             as "3.548", which reads as three-point-five to an English audience -->
        <span class="stat err"><b>{{ Math.round(dropped).toLocaleString('en-US') }}</b> dropped</span>
        <span class="stat waste"><b>€ {{ wasted.toFixed(2) }}</b> wasted</span>
        <span class="stat clicks"><b>{{ clicks }}</b> your clicks</span>
      </div>

      <div class="ctrls">
        <template v-if="levelKey === 'manual'">
          <button class="act" @click="bump(1)">+1</button>
          <button class="act" @click="bump(-1)">−1</button>
        </template>
        <button v-else-if="levelKey === 'assisted'" class="act" @click="scaleNow">run scaler</button>
        <span v-else class="auto">automatic</span>

        <button class="sm" :title="paused ? 'play' : 'pause'" @click="paused = !paused">
          {{ paused ? '▶' : '⏸' }}
        </button>
        <button class="sm" title="reset" @click="reset">⟲</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scaler { width: 100%; }

.cap {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.5rem;
  margin-bottom: 0.5rem; min-height: 2.6rem;
}
.chip { font-weight: 800; font-size: 0.8rem; padding: 2px 7px; border-radius: 999px; }
.lname { font-weight: 700; font-size: 1rem; }
.what { font-size: 0.92rem; opacity: 0.95; }
.need { font-size: 0.8rem; color: var(--ink-dim); }
.need b { color: var(--accent); font-weight: 700; }

.chartwrap { position: relative; }
.chart {
  width: 100%; height: 250px; display: block;
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel) 60%, transparent);
}
.ghost { fill: none; stroke: var(--ink-dim); stroke-width: 1.5; opacity: 0.22; stroke-dasharray: 4 5; }
.load-line { fill: none; stroke: var(--ink); stroke-width: 2.5; }
.cap-line { fill: none; stroke: #476BFF; stroke-width: 2; }
.band { stroke: none; }
.band.err { fill: #E5484D; opacity: 0.3; }
.band.waste { fill: #B0A79B; opacity: 0.28; }
.playhead { stroke: var(--accent); stroke-width: 1.5; opacity: 0.7; }

.ask {
  position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%);
  background: var(--panel); border: 2px solid var(--accent);
  border-radius: 12px; padding: 0.7rem 1rem; text-align: center;
  box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.35);
}
.ask-t { font-size: 0.75rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-dim); }
.ask-b { font-weight: 700; margin: 0.2rem 0 0.5rem; }
.ask-r { display: flex; gap: 0.4rem; justify-content: center; }
.ask-r button {
  border: 1px solid var(--panel-border); background: transparent; color: var(--ink);
  border-radius: 7px; padding: 0.25rem 0.7rem; cursor: pointer; font-size: 0.85rem;
}
.ask-r .go { background: var(--accent); border-color: var(--accent); font-weight: 700; }
kbd { font-size: 0.7em; opacity: 0.7; }

.fleet { display: flex; align-items: center; gap: 4px; margin: 0.55rem 0 0.4rem; min-height: 1.5rem; }
.inst {
  width: 15px; height: 20px; border-radius: 3px;
  background: #53DFA9; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
  transition: background 0.15s ease;
}
.inst.hot { background: #E5484D; }
.inst.idle { background: #B0A79B; opacity: 0.55; }
.fleet-n { font-size: 0.8rem; color: var(--ink-dim); margin-left: 0.4rem; }

.foot { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.stats { display: flex; gap: 1.1rem; font-size: 0.85rem; color: var(--ink-dim); }
.stat b { font-size: 1rem; color: var(--ink); font-variant-numeric: tabular-nums; }
.stat.err b { color: #E5484D; }
.stat.clicks b { color: var(--accent); }

.ctrls { display: flex; align-items: center; gap: 5px; }
.ctrls button {
  border: 1px solid var(--panel-border); background: var(--panel); color: var(--ink);
  border-radius: 7px; cursor: pointer; transition: background 0.12s ease;
}
.ctrls button:hover { background: rgba(148, 163, 184, 0.25); }
.act { padding: 0.3rem 0.8rem; font-weight: 700; font-size: 0.9rem; }
.sm { width: 2rem; height: 1.9rem; font-size: 0.85rem; }
.auto { font-size: 0.8rem; color: var(--ink-dim); font-style: italic; margin-right: 0.3rem; }
</style>
