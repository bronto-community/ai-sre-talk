<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import rough from 'roughjs'
import { Bot } from 'lucide-vue-next'

// Bird's-eye view. A winding road from A to B; turn the wheel to drive along it.
// Then drop the robot on the wheel: it takes the first bends fine, then misses
// one and carries straight on off the screen.
const scene = ref<HTMLElement | null>(null)
const sceneSvg = ref<SVGSVGElement | null>(null)
const measure = ref<SVGPathElement | null>(null)
const carSvg = ref<SVGSVGElement | null>(null)
const wheelSvg = ref<SVGSVGElement | null>(null)
const wheelEl = ref<HTMLElement | null>(null)
const robotSvg = ref<SVGSVGElement | null>(null)

const INK = '#2B2620', SAPPHIRE = '#476BFF', DIM = '#B8AEA0'
const ASPHALT = '#EFEAE1'

const HALF_W = 25          // half the road width, px
const TURN_TO_B = 620      // degrees of wheel to get from A to B
const START = 0.02         // sit the car just inside the start line, not astride it

const wheelAngle = ref(0)
const progress = ref(START)
const mode = ref<'manual' | 'auto' | 'gone'>('manual')
const onWheel = ref(false)
const car = ref({ x: 0, y: 0, a: 0 })

const carStyle = computed(() => ({
  left: car.value.x + 'px',
  top: car.value.y + 'px',
  transform: `translate(-50%,-50%) rotate(${car.value.a}deg)`,
  transition:
    mode.value === 'gone' ? 'left 2s cubic-bezier(.5,0,1,.6), top 2s cubic-bezier(.5,0,1,.6)'
    : mode.value === 'auto' ? 'left .55s ease-in-out, top .55s ease-in-out, transform .55s ease-in-out'
    : 'left .07s linear, top .07s linear, transform .07s linear',
}))
const wheelStyle = computed(() => ({
  transform: `rotate(${wheelAngle.value}deg)`,
  transition:
    mode.value === 'gone' ? 'transform 2s cubic-bezier(.5,0,1,.6)'
    : mode.value === 'auto' ? 'transform .55s ease-in-out'
    : 'transform .06s linear',
}))

// ── road geometry ────────────────────────────────────────────────────────
function pathFor(W: number) {
  const y = (f: number) => 26 + f * 186          // vertical band the road winds in
  return [
    `M ${0.05 * W} ${y(0.72)}`,
    `C ${0.15 * W} ${y(0.72)}, ${0.15 * W} ${y(0.1)}, ${0.29 * W} ${y(0.1)}`,
    `C ${0.43 * W} ${y(0.1)}, ${0.41 * W} ${y(0.92)}, ${0.55 * W} ${y(0.92)}`,
    `C ${0.69 * W} ${y(0.92)}, ${0.67 * W} ${y(0.16)}, ${0.81 * W} ${y(0.16)}`,
    `C ${0.89 * W} ${y(0.16)}, ${0.91 * W} ${y(0.5)}, ${0.95 * W} ${y(0.5)}`,
  ].join(' ')
}

/** position + heading at t (0..1) along the road */
function sample(t: number) {
  const el = measure.value
  if (!el) return null
  const L = el.getTotalLength()
  if (!L) return null
  const d = Math.max(0, Math.min(1, t)) * L
  const p = el.getPointAtLength(d)
  const q = el.getPointAtLength(Math.min(L, d + 1.5))
  const r = el.getPointAtLength(Math.max(0, d - 1.5))
  return { x: p.x, y: p.y, a: Math.atan2(q.y - r.y, q.x - r.x) * 180 / Math.PI }
}
function place(t: number) {
  const s = sample(t)
  if (s) car.value = s
}

// ── manual steering ──────────────────────────────────────────────────────
let lastAng: number | null = null
function angleAt(e: PointerEvent) {
  const r = wheelEl.value!.getBoundingClientRect()
  return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI
}
function wheelDown(e: PointerEvent) {
  if (mode.value !== 'manual') return
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  lastAng = angleAt(e)
}
function wheelMove(e: PointerEvent) {
  if (lastAng === null || mode.value !== 'manual') return
  const a = angleAt(e)
  let d = a - lastAng
  while (d > 180) d -= 360
  while (d < -180) d += 360
  lastAng = a
  wheelAngle.value += d
  progress.value = Math.max(START, Math.min(1, START + wheelAngle.value / TURN_TO_B))
  place(progress.value)
}
function wheelUp() { lastAng = null }

// ── the robot takes over ─────────────────────────────────────────────────
const dragging = ref(false)
const robotPos = ref<{ x: number; y: number } | null>(null)
function localPoint(e: PointerEvent) {
  const r = scene.value!.getBoundingClientRect()
  const s = r.width / scene.value!.clientWidth || 1
  return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }
}
function robotDown(e: PointerEvent) {
  if (mode.value !== 'manual') return
  dragging.value = true
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  robotPos.value = localPoint(e)
}
function robotMove(e: PointerEvent) {
  if (dragging.value) robotPos.value = localPoint(e)
}
function robotUp(e: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  const w = wheelEl.value?.getBoundingClientRect()
  if (w) {
    const d = Math.hypot(e.clientX - (w.left + w.width / 2), e.clientY - (w.top + w.height / 2))
    if (d < w.width * 0.8) { engage(); return }
  }
  robotPos.value = null
}

let timer: ReturnType<typeof setInterval> | undefined
function engage() {
  onWheel.value = true
  robotPos.value = null
  mode.value = 'auto'
  let step = 0
  const from = progress.value
  timer = setInterval(() => {
    step++
    if (step <= 4) {
      progress.value = from + (0.62 - from) * (step / 4)   // takes the first bends fine
      wheelAngle.value += 95
      place(progress.value)
    } else {
      clearInterval(timer)
      // …then holds its heading straight through the next bend and keeps going
      mode.value = 'gone'
      const a = car.value.a * Math.PI / 180
      const far = 1800
      car.value = { x: car.value.x + Math.cos(a) * far, y: car.value.y + Math.sin(a) * far, a: car.value.a }
      wheelAngle.value += 1260
    }
  }, 620)
}

function reset() {
  clearInterval(timer)
  mode.value = 'manual'
  onWheel.value = false
  robotPos.value = null
  progress.value = START
  wheelAngle.value = 0
  place(START)
}

// ── hand-drawn rendering ─────────────────────────────────────────────────
function drawScene() {
  const svg = sceneSvg.value, cont = scene.value, mp = measure.value
  if (!svg || !cont || !mp) return
  const W = cont.clientWidth, H = cont.clientHeight
  if (!W || !H) return
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  mp.setAttribute('d', pathFor(W))       // geometry queries below see this immediately

  // clear everything except the invisible measuring path
  Array.from(svg.querySelectorAll('.gen')).forEach(n => n.remove())
  const rc = rough.svg(svg)
  const add = (n: SVGGElement) => { n.classList.add('gen'); svg.appendChild(n) }

  const L = mp.getTotalLength()
  const N = 150
  const left: [number, number][] = [], right: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const d = (i / N) * L
    const p = mp.getPointAtLength(d)
    const q = mp.getPointAtLength(Math.min(L, d + 1.5))
    const r = mp.getPointAtLength(Math.max(0, d - 1.5))
    const tx = q.x - r.x, ty = q.y - r.y
    const m = Math.hypot(tx, ty) || 1
    const nx = -ty / m, ny = tx / m
    left.push([p.x + nx * HALF_W, p.y + ny * HALF_W])
    right.push([p.x - nx * HALF_W, p.y - ny * HALF_W])
  }
  // one closed shape: down the left edge and back up the right — the caps at each
  // end read as the start and finish lines
  add(rc.polygon([...left, ...right.reverse()], {
    roughness: 1.5, bowing: 0.8, strokeWidth: 2.2, stroke: INK,
    fill: ASPHALT, fillStyle: 'solid',
  }))

  // dashed centre line
  for (let i = 0; i < N; i += 6) {
    const p = mp.getPointAtLength((i / N) * L)
    const q = mp.getPointAtLength(Math.min(L, ((i + 3) / N) * L))
    add(rc.line(p.x, p.y, q.x, q.y, { roughness: 1.2, strokeWidth: 1.6, stroke: DIM }))
  }
}
function drawCar() {
  const el = carSvg.value
  if (!el) return
  while (el.firstChild) el.removeChild(el.firstChild)
  const rc = rough.svg(el)
  const o = { roughness: 1.5, bowing: 1.1, strokeWidth: 2, stroke: INK }
  // wheels first, so the body sits on top of them
  ;[[11, 1], [11, 23], [33, 1], [33, 23]].forEach(([x, y]) => {
    el.appendChild(rc.rectangle(x, y, 9, 4, { ...o, strokeWidth: 1.4, fill: INK, fillStyle: 'solid' }))
  })
  el.appendChild(rc.rectangle(5, 4, 44, 20, { ...o, fill: '#fff', fillStyle: 'solid' }))
  el.appendChild(rc.rectangle(33, 7, 11, 14, { ...o, strokeWidth: 1.5, fill: '#DBF9EE', fillStyle: 'solid' }))
}
function drawWheel() {
  const el = wheelSvg.value
  if (!el) return
  while (el.firstChild) el.removeChild(el.firstChild)
  const rc = rough.svg(el)
  const o = { roughness: 1.7, bowing: 1.3, strokeWidth: 3, stroke: INK }
  el.appendChild(rc.circle(60, 60, 100, o))
  el.appendChild(rc.circle(60, 60, 26, { ...o, strokeWidth: 2.4 }))
  ;[[10, 60], [110, 60], [60, 110]].forEach(([x, y]) => {
    el.appendChild(rc.line(60, 60, x, y, { ...o, strokeWidth: 2.4 }))
  })
}
function drawRobot() {
  const el = robotSvg.value
  if (!el) return
  while (el.firstChild) el.removeChild(el.firstChild)
  const rc = rough.svg(el)
  el.appendChild(rc.rectangle(3, 3, 112, 46, {
    roughness: 1.7, bowing: 1.4, strokeWidth: 2.6, stroke: SAPPHIRE,
    fill: '#EAF0FF', fillStyle: 'solid',
  }))
}

// A / B labels, nudged off the road so the car never covers them
const marks = ref<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null)
function placeMarks() {
  const s0 = sample(0), s1 = sample(1)
  if (s0 && s1) marks.value = { a: { x: s0.x - 4, y: s0.y + 46 }, b: { x: s1.x + 6, y: s1.y - 44 } }
}

let ro: ResizeObserver
function relayout() { drawScene(); place(progress.value); placeMarks() }
onMounted(() => {
  relayout(); drawCar(); drawWheel(); drawRobot()
  ro = new ResizeObserver(relayout)
  if (scene.value) ro.observe(scene.value)
})
onUnmounted(() => { ro?.disconnect(); clearInterval(timer) })
</script>

<template>
  <div ref="scene" class="scene" @pointermove="robotMove" @pointerup="robotUp">
    <svg ref="sceneSvg" class="scenery">
      <path ref="measure" fill="none" stroke="none" />
    </svg>

    <template v-if="marks">
      <span class="marker" :style="{ left: marks.a.x + 'px', top: marks.a.y + 'px' }">A</span>
      <span class="marker" :style="{ left: marks.b.x + 'px', top: marks.b.y + 'px' }">B</span>
    </template>

    <div class="car" :style="carStyle">
      <svg ref="carSvg" viewBox="0 0 54 28" width="54" />
    </div>

    <div
      ref="wheelEl"
      class="wheel"
      :class="{ live: mode !== 'manual' }"
      @pointerdown="wheelDown"
      @pointermove="wheelMove"
      @pointerup="wheelUp"
    >
      <svg ref="wheelSvg" class="wheel-svg" viewBox="0 0 120 120" width="120" :style="wheelStyle" />
      <Bot v-if="onWheel" class="wheel-bot" :size="26" />
    </div>

    <div
      v-show="!onWheel"
      class="robot"
      :class="{ dragging }"
      :style="robotPos ? { left: robotPos.x + 'px', top: robotPos.y + 'px', transform: 'translate(-50%,-50%)' } : {}"
      @pointerdown="robotDown"
    >
      <svg ref="robotSvg" viewBox="0 0 118 52" width="118" />
      <span class="robot-face"><Bot :size="22" /> robot</span>
    </div>

    <div class="caption">
      <template v-if="mode === 'manual'">
        <span class="dim">turn the wheel to drive from</span>
        <b>A</b><span class="dim">to</span><b>B</b>
        <span class="dim">— then put the robot on the wheel</span>
      </template>
      <template v-else-if="mode === 'auto'">
        <span class="dim">…so far, so good.</span>
      </template>
      <template v-else>
        <span class="punch">It was fine — right up until the next bend.</span>
        <button class="reset" @click="reset">reset</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.scene {
  position: relative; width: 100%; height: 390px;
  overflow: hidden; touch-action: none; user-select: none;
}
.scenery { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }

.marker {
  position: absolute; transform: translate(-50%, -50%);
  font-family: 'Kalam', cursive; font-weight: 700; font-size: 1.5rem; color: var(--ink-dim);
}

.car { position: absolute; will-change: left, top, transform; }
.car svg { display: block; height: auto; }

.wheel {
  position: absolute; right: 40px; bottom: 34px;
  width: 120px; height: 120px; cursor: grab; touch-action: none;
}
.wheel:active { cursor: grabbing; }
.wheel.live { cursor: default; }
.wheel-svg { display: block; will-change: transform; }
.wheel-bot { position: absolute; inset: 0; margin: auto; color: var(--sapphire); }

.robot {
  position: absolute; right: 220px; bottom: 68px;
  cursor: grab; z-index: 3;
}
.robot.dragging { cursor: grabbing; }
.robot svg { display: block; height: auto; }
.robot-face {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center; gap: 0.35rem;
  font-family: 'Kalam', cursive; font-weight: 700; font-size: 1.05rem; color: #1B2E8A;
  pointer-events: none;
}

.caption {
  position: absolute; left: 2%; bottom: 10px;
  display: flex; align-items: center; gap: 0.55rem; font-size: 1.05rem;
}
.caption b { color: var(--sapphire); font-family: 'Kalam', cursive; font-size: 1.3rem; }
.dim { color: var(--ink-dim); }
.punch { font-family: 'Source Serif 4', Georgia, serif; font-size: 1.5rem; }
.reset {
  border: 1px solid var(--border); background: var(--surface); color: var(--ink);
  padding: 0.25rem 0.9rem; border-radius: 8px; cursor: pointer; font-family: 'Kalam', cursive;
}
</style>
