<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

import { LEVELS, DOMAINS, TRANSITIONS } from '../data'
import {
  CAPACITY, CYCLE, MAX_LOAD, TIMEOUT, LAT_TARGET,
  loadAt, instancesFor, runScaler,
  newSim, tick, resolveAsk, humanScale, annualWaste, type Sim,
} from '../scaling-policies'

// "Scaling a service" as something you do, not something you read. The load
// curve runs on a real clock; each Slidev click hands more of the work to the
// system, until at L5 there is nothing left for you to press.
const props = defineProps<{ stage?: number }>()

const domain = computed(() => DOMAINS.find(d => d.key === 'resource-mgmt')!)

const level = ref(0)
const levelKey = computed(() => LEVELS[level.value].key)

// Chart geometry. Fixed viewBox, scaled by CSS, so it reads at any projector size.
const W = 1000
const H = 200, FLOOR = 178, ROOF = 14      // load chart
const LH = 100, LFLOOR = 82                // latency strip
const X = (t: number) => (t / CYCLE) * W
const Y = (v: number) => FLOOR - (v / MAX_LOAD) * (FLOOR - ROOF)
// Square-root scale: on a linear 0–2.5s axis the 0.3s objective sits at 12% of
// the strip and the whole "it's getting slow" story happens in a few pixels.
const LY = (v: number) =>
  LFLOOR - Math.sqrt(Math.min(v, TIMEOUT) / TIMEOUT) * (LFLOOR - 10)

// --- simulation state -------------------------------------------------------
// The sim is a plain object from scaling-policies, deliberately not a ref: its
// history grows to ~1500 samples and is rewritten every frame, which is exactly
// the shape deep reactivity is worst at. `frame` is the single reactive trigger.
let sim: Sim = newSim()
const frame = ref(0)
const running = ref(false)
const started = ref(false)

function reset() {
  sim = newSim()
  running.value = false
  started.value = false
  frame.value++
}

function start() {
  started.value = true
  running.value = true
}

// Each level replays the identical 25 seconds from a clean slate — and waits
// for you to start it, so the run happens when you are ready to talk over it.
watch(() => props.stage, s => {
  if (typeof s !== 'number') return
  level.value = Math.max(0, Math.min(LEVELS.length - 1, s))
  reset()
}, { immediate: true })

// --- the clock --------------------------------------------------------------
// The simulation always advances in these increments, independent of frame
// rate — see the accumulator in step(). This is the same dt the tests use.
const SIM_STEP = 1 / 60

let raf = 0
let last = 0
let visible = false
let acc = 0

function step(now: number) {
  raf = requestAnimationFrame(step)
  if (!last) last = now
  let dt = (now - last) / 1000
  last = now
  if (!visible || !running.value) return

  // Fixed timestep. Feeding a variable frame delta into the queue integration
  // makes the outcome depend on the projector's frame rate — the same run gave
  // a 0.74s latency peak in a throttled tab and 1.65s in the tests. Stepping a
  // constant SIM_STEP means what you rehearse is what the audience sees, and
  // what the tests assert.
  acc += Math.min(dt, 0.25)     // clamp: a stalled tab must not fast-forward
  let guard = 0
  while (acc >= SIM_STEP && guard++ < 20) {
    acc -= SIM_STEP
    if (!tick(sim, SIM_STEP, levelKey.value)) {   // one clean run per pass
      running.value = false
      return
    }
  }
  if (guard) frame.value++
}

// --- human controls ---------------------------------------------------------
function bump(n: number) {
  humanScale(sim, sim.instances + n)
  frame.value++
}
function scaleNow() {
  humanScale(sim, runScaler(loadAt(sim.t)))
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
    if (p.instances !== prev && prev !== -1) pts.push(`${X(p.t)},${Y(prev * CAPACITY)}`)
    pts.push(`${X(p.t)},${Y(p.instances * CAPACITY)}`)
    prev = p.instances
  }
  return pts.join(' ')
})

const latLine = computed(() => {
  frame.value
  return sim.history.map(p => `${X(p.t)},${LY(p.latency)}`).join(' ')
})

// Where latency is over objective: the "it's slow" band, which appears well
// before anything is actually lost.
const latBands = computed(() => {
  frame.value
  const out: string[] = []
  let run: typeof sim.history = []
  const flush = () => {
    if (run.length > 1) {
      const top = run.map(p => `${X(p.t)},${LY(p.latency)}`)
      const bot = [...run].reverse().map(p => `${X(p.t)},${LY(LAT_TARGET)}`)
      out.push([...top, ...bot].join(' '))
    }
    run = []
  }
  for (const p of sim.history) {
    if (p.latency > LAT_TARGET) run.push(p); else flush()
  }
  flush()
  return out
})

// Where requests are actually being lost.
const shedBands = computed(() => {
  frame.value
  const out: { x: number; w: number }[] = []
  let start: number | null = null
  let prev = 0
  for (const p of sim.history) {
    if (p.shedding && start === null) start = p.t
    if (!p.shedding && start !== null) { out.push({ x: X(start), w: X(p.t) - X(start) }); start = null }
    prev = p.t
  }
  if (start !== null) out.push({ x: X(start), w: X(prev) - X(start) })
  return out.filter(b => b.w > 0.5)
})

// Every trigger that fired, so you can see the gap between the load moving and
// the system reacting — it is a control loop, not an instant reflex.
const triggers = computed(() => {
  frame.value
  return sim.events.map(e => ({ ...e, x: X(e.t) }))
})
const lastTrigger = computed(() => { frame.value; return sim.events.at(-1) ?? null })

const playX = computed(() => { frame.value; return X(sim.t) })
const nowLoad = computed(() => { frame.value; return loadAt(sim.t) })
const needed = computed(() => instancesFor(nowLoad.value))
const instances = computed(() => { frame.value; return sim.instances })
const latency = computed(() => { frame.value; return sim.latency })
const peakLatency = computed(() => { frame.value; return sim.peakLatency })
const shedding = computed(() => { frame.value; return sim.shedding })
const slow = computed(() => latency.value > LAT_TARGET)
const dropped = computed(() => { frame.value; return sim.dropped })
const wasted = computed(() => { frame.value; return annualWaste(sim.idleSeconds) })
const clicks = computed(() => { frame.value; return sim.clicks })
const pending = computed(() => { frame.value; return sim.pending })
const boxes = computed(() => Math.min(instances.value, 16))
const done = computed(() => { frame.value; return started.value && !running.value && sim.t > 0 })
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
        <polyline :points="ghost" class="ghost" />
        <polyline :points="capLine" class="cap-line" />
        <polyline :points="loadLine" class="load-line" />
        <!-- when a trigger fired, and what it did -->
        <g v-for="(g, i) in triggers" :key="'g' + i" :class="['trig', g.kind]">
          <line :x1="g.x" :y1="ROOF" :x2="g.x" :y2="FLOOR" class="trig-l" />
          <polygon :points="`${g.x - 5},${FLOOR + 9} ${g.x + 5},${FLOOR + 9} ${g.x},${FLOOR + 1}`" />
        </g>
        <line :x1="playX" :y1="ROOF - 6" :x2="playX" :y2="FLOOR + 10" class="playhead" />
      </svg>

      <!-- latency: overload shows up here long before it shows up as errors -->
      <svg :viewBox="`0 0 ${W} ${LH}`" class="lat" preserveAspectRatio="none">
        <rect v-for="(b, i) in shedBands" :key="'s' + i"
              :x="b.x" :width="b.w" :y="6" :height="LFLOOR - 6" class="shed" />
        <polygon v-for="(p, i) in latBands" :key="'lb' + i" :points="p" class="lat-band" />
        <line :x1="0" :y1="LY(LAT_TARGET)" :x2="W" :y2="LY(LAT_TARGET)" class="lat-target" />
        <polyline :points="latLine" class="lat-line" />
        <line :x1="playX" :y1="6" :x2="playX" :y2="LFLOOR" class="playhead" />
      </svg>
      <div class="lat-key">
        <span>latency</span>
        <span class="lt">objective {{ LAT_TARGET }}s</span>
        <span class="to">timeout {{ TIMEOUT }}s</span>
      </div>

      <div v-if="!started" class="veil">
        <button class="startbtn" @click="start">Start L{{ level }}</button>
        <div class="veil-h">{{ CYCLE }}s, same every run</div>
      </div>
      <div v-else-if="done" class="veil soft">
        <button class="startbtn" @click="reset(); start()">Run again</button>
      </div>

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
        :class="{ hot: shedding, warm: slow && !shedding, idle: i > needed }"
      />
      <span class="fleet-n">{{ instances }} × instance</span>
      <span v-if="lastTrigger" class="trigpill" :class="lastTrigger.kind">
        {{ lastTrigger.kind === 'ask' ? 'asked' : 'trigger' }}
        {{ lastTrigger.from }} → {{ lastTrigger.to }}
        <i>t+{{ lastTrigger.t.toFixed(1) }}s</i>
      </span>
    </div>

    <div class="foot">
      <div class="stats">
        <span class="stat" :class="{ warn: slow, bad: shedding }">
          <b>{{ latency.toFixed(2) }}s</b> latency
        </span>
        <!-- latency returns to baseline, so the excursion is the memorable number -->
        <span class="stat" :class="{ warn: peakLatency > LAT_TARGET }">
          <b>{{ peakLatency.toFixed(2) }}s</b> peak
        </span>
        <!-- pinned to en-US: on a German machine toLocaleString() renders 3548
             as "3.548", which reads as three-point-five to an English audience -->
        <span class="stat err"><b>{{ Math.round(dropped).toLocaleString('en-US') }}</b> dropped</span>
        <!-- a 25s run wastes fractions of a cent; the standing annual cost is
             the number anyone actually acts on -->
        <span class="stat waste">
          <b>€{{ Math.round(wasted).toLocaleString('en-US') }}</b> wasted/yr
        </span>
        <span class="stat clicks"><b>{{ clicks }}</b> your clicks</span>
      </div>

      <div class="ctrls">
        <template v-if="levelKey === 'manual'">
          <button class="act" :disabled="!started" @click="bump(1)">+1</button>
          <button class="act" :disabled="!started" @click="bump(-1)">−1</button>
        </template>
        <button v-else-if="levelKey === 'assisted'" class="act" :disabled="!started" @click="scaleNow">
          run scaler
        </button>
        <span v-else class="auto">automatic</span>

        <button v-if="!started" class="sm go" title="start" @click="start">▶</button>
        <button v-else class="sm" :title="running ? 'pause' : 'play'" @click="running = !running">
          {{ running ? '⏸' : '▶' }}
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
  margin-bottom: 0.4rem; min-height: 2.4rem;
}
.chip { font-weight: 800; font-size: 0.8rem; padding: 2px 7px; border-radius: 999px; }
.lname { font-weight: 700; font-size: 1rem; }
.what { font-size: 0.9rem; opacity: 0.95; }
.need { font-size: 0.78rem; color: var(--ink-dim); }
.need b { color: var(--accent); font-weight: 700; }

.chartwrap { position: relative; }
.chart, .lat {
  width: 100%; display: block;
  background: color-mix(in srgb, var(--panel) 60%, transparent);
}
.chart { height: 208px; border-radius: 10px 10px 0 0; }
.lat { height: 104px; border-radius: 0 0 10px 10px; border-top: 1px solid var(--panel-border); }

.ghost { fill: none; stroke: var(--ink-dim); stroke-width: 1.5; opacity: 0.22; stroke-dasharray: 4 5; }
.load-line { fill: none; stroke: var(--ink); stroke-width: 2.5; }
.cap-line { fill: none; stroke: #476BFF; stroke-width: 2; }
.playhead { stroke: var(--accent); stroke-width: 1.5; opacity: 0.7; }

.trig .trig-l { stroke: #476BFF; stroke-width: 1; opacity: 0.28; stroke-dasharray: 2 4; }
.trig polygon { fill: #476BFF; opacity: 0.8; }
.trig.human .trig-l { stroke: var(--accent); }
.trig.human polygon { fill: var(--accent); }
.trig.ask .trig-l { stroke: #E5484D; opacity: 0.5; }
.trig.ask polygon { fill: #E5484D; }

.lat-line { fill: none; stroke: #7A6F63; stroke-width: 2; }
.lat-target { stroke: #53DFA9; stroke-width: 1.5; stroke-dasharray: 5 4; }
.lat-band { fill: #E8A33D; opacity: 0.35; stroke: none; }
.shed { fill: #E5484D; opacity: 0.18; }
.lat-key {
  display: flex; gap: 0.8rem; font-size: 0.68rem; color: var(--ink-dim);
  margin-top: 0.15rem;
}
.lat-key .lt { color: #3FAE85; }
.lat-key .to { color: #E5484D; }

.veil {
  position: absolute; inset: 0; display: flex; gap: 0.5rem;
  flex-direction: column; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--bg, #FAF7F2) 72%, transparent);
  border-radius: 10px;
}
.veil.soft { background: color-mix(in srgb, var(--bg, #FAF7F2) 45%, transparent); }
.startbtn {
  border: 2px solid var(--accent); background: var(--accent);
  color: #fff; font-weight: 800; font-size: 1rem;
  padding: 0.5rem 1.6rem; border-radius: 10px; cursor: pointer;
  box-shadow: 0 10px 24px -10px rgba(0, 0, 0, 0.4);
}
.veil-h { font-size: 0.75rem; color: var(--ink-dim); }

.ask {
  position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%);
  background: var(--panel); border: 2px solid var(--accent);
  border-radius: 12px; padding: 0.6rem 1rem; text-align: center;
  box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.35);
}
.ask-t { font-size: 0.72rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-dim); }
.ask-b { font-weight: 700; margin: 0.2rem 0 0.45rem; }
.ask-r { display: flex; gap: 0.4rem; justify-content: center; }
.ask-r button {
  border: 1px solid var(--panel-border); background: transparent; color: var(--ink);
  border-radius: 7px; padding: 0.22rem 0.7rem; cursor: pointer; font-size: 0.85rem;
}
.ask-r .go { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 700; }
kbd { font-size: 0.7em; opacity: 0.8; }

.fleet { display: flex; align-items: center; gap: 4px; margin: 0.4rem 0 0.3rem; min-height: 1.4rem; }
.inst {
  width: 14px; height: 18px; border-radius: 3px;
  background: #53DFA9; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
  transition: background 0.15s ease;
}
.inst.warm { background: #E8A33D; }
.inst.hot { background: #E5484D; }
.inst.idle { background: #B0A79B; opacity: 0.55; }
.fleet-n { font-size: 0.78rem; color: var(--ink-dim); margin-left: 0.4rem; }
.trigpill {
  font-size: 0.7rem; padding: 1px 8px; border-radius: 999px; margin-left: 0.4rem;
  background: color-mix(in srgb, #476BFF 16%, transparent); color: #2B45B8; font-weight: 700;
}
.trigpill i { font-style: normal; opacity: 0.65; margin-left: 3px; }
.trigpill.human { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); }
.trigpill.ask { background: color-mix(in srgb, #E5484D 16%, transparent); color: #C0343A; }

.foot { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.stats { display: flex; gap: 1rem; font-size: 0.8rem; color: var(--ink-dim); }
/* Radio Canada Big defaults to figure spacing that gives "." and "," a full
   digit slot, rendering "€1,325" as "€1 , 325" — reads as a typo from the back
   of a room. Force proportional figures. */
.stat b {
  font-size: 0.98rem; color: var(--ink);
  font-variant-numeric: proportional-nums;
  font-feature-settings: 'tnum' 0, 'pnum' 1;
}
.stat.warn b { color: #C9821F; }
.stat.bad b { color: #E5484D; }
.stat.err b { color: #E5484D; }
.stat.clicks b { color: var(--accent); }

.ctrls { display: flex; align-items: center; gap: 5px; }
.ctrls button {
  border: 1px solid var(--panel-border); background: var(--panel); color: var(--ink);
  border-radius: 7px; cursor: pointer; transition: background 0.12s ease;
}
.ctrls button:hover:not(:disabled) { background: rgba(148, 163, 184, 0.25); }
.ctrls button:disabled { opacity: 0.35; cursor: default; }
.ctrls .go { background: var(--accent); border-color: var(--accent); color: #fff; }
.act { padding: 0.28rem 0.75rem; font-weight: 700; font-size: 0.88rem; }
.sm { width: 1.9rem; height: 1.8rem; font-size: 0.82rem; }
.auto { font-size: 0.78rem; color: var(--ink-dim); font-style: italic; margin-right: 0.3rem; }
</style>
