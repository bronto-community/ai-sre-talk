<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import rough from 'roughjs'
import { Bot, User } from 'lucide-vue-next'

// Bird's-eye view. Choose your player — a human or an LLM — and it takes the
// wheel from the start of the road. The human steers A -> B by turning the
// wheel. The LLM takes the first bends fine, then misses one and carries
// straight on off the screen.
// Frogs hop across the lane towards the pond. Run one over and it stays there.
const scene = ref<HTMLElement | null>(null)
const sceneSvg = ref<SVGSVGElement | null>(null)
const measure = ref<SVGPathElement | null>(null)
const carSvg = ref<SVGSVGElement | null>(null)
const wheelSvg = ref<SVGSVGElement | null>(null)
const wheelEl = ref<HTMLElement | null>(null)

const INK = '#2B2620', SAPPHIRE = '#476BFF', DIM = '#B8AEA0'
const ASPHALT = '#EFEAE1'
const LEAF = ['#3E7D4F', '#4F9160', '#68A874']

const HALF_W = 24          // half the road width, px
const TURN_TO_B = 620      // degrees of wheel to get from A to B
const START = 0.02         // sit the car just inside the start line
const N_LIVE = 3           // how many frogs are hopping at once
const MAX_SPLATS = 8
const HOP = 20             // px per hop
const SQUASH_R = 20        // how close the car has to pass

type Player = 'human' | 'llm'
const player = ref<Player | null>(null)
const mode = ref<'idle' | 'manual' | 'arrived' | 'auto' | 'gone'>('idle')
const wheelAngle = ref(0)
const progress = ref(START)
const car = ref({ x: -999, y: -999, a: 0 })

const snap = ref(false)   // teleport, don't animate, when resetting to the start
const carStyle = computed(() => ({
  left: car.value.x + 'px',
  top: car.value.y + 'px',
  transform: `translate(-50%,-50%) rotate(${car.value.a}deg)`,
  transition:
    snap.value ? 'none'
    : mode.value === 'gone' ? 'left 1.3s cubic-bezier(.5,0,1,.6), top 1.3s cubic-bezier(.5,0,1,.6)'
    : mode.value === 'auto' ? 'left .55s ease-in-out, top .55s ease-in-out, transform .55s ease-in-out'
    : 'left .07s linear, top .07s linear, transform .07s linear',
}))
const wheelStyle = computed(() => ({
  transform: `rotate(${wheelAngle.value}deg)`,
  transition:
    mode.value === 'gone' ? 'transform 1.3s cubic-bezier(.5,0,1,.6)'
    : mode.value === 'auto' ? 'transform .55s ease-in-out'
    : 'transform .06s linear',
}))

// ── road geometry ────────────────────────────────────────────────────────
function pathFor(W: number) {
  const y = (f: number) => 30 + f * 160
  return [
    `M ${0.05 * W} ${y(0.72)}`,
    `C ${0.15 * W} ${y(0.72)}, ${0.15 * W} ${y(0.1)}, ${0.29 * W} ${y(0.1)}`,
    `C ${0.43 * W} ${y(0.1)}, ${0.41 * W} ${y(0.92)}, ${0.55 * W} ${y(0.92)}`,
    `C ${0.69 * W} ${y(0.92)}, ${0.67 * W} ${y(0.16)}, ${0.81 * W} ${y(0.16)}`,
    `C ${0.89 * W} ${y(0.16)}, ${0.91 * W} ${y(0.5)}, ${0.95 * W} ${y(0.5)}`,
  ].join(' ')
}
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

// road spine + pond, shared between drawing and the frog logic
type Spine = { x: number; y: number; nx: number; ny: number }
let spine: Spine[] = []
const pond = ref({ x: 0, y: 0, rx: 32, ry: 21 })

function nearest(x: number, y: number) {
  let best: Spine | null = null, bd = Infinity
  for (const s of spine) {
    const d = Math.hypot(s.x - x, s.y - y)
    if (d < bd) { bd = d; best = s }
  }
  return { s: best, d: bd }
}
/** which side of the road a point is on (+1 / -1) */
function sideOf(x: number, y: number) {
  const { s } = nearest(x, y)
  if (!s) return 0
  return Math.sign((x - s.x) * s.nx + (y - s.y) * s.ny)
}

// ── frogs ────────────────────────────────────────────────────────────────
type Frog = { id: number; x: number; y: number; a: number; dead: boolean }
const frogs = ref<Frog[]>([])
let frogId = 0

function spawnFrog(): Frog | null {
  const cont = scene.value
  if (!cont || !spine.length) return null
  const W = cont.clientWidth
  const pondSide = sideOf(pond.value.x, pond.value.y)
  for (let i = 0; i < 250; i++) {
    const x = 20 + Math.random() * (W - 40)
    const y = 16 + Math.random() * 200
    if (nearest(x, y).d < HALF_W + 16) continue          // not standing on the road
    if (sideOf(x, y) === pondSide) continue              // must have the road to cross
    if (Math.hypot(x - pond.value.x, y - pond.value.y) < 170) continue
    return { id: ++frogId, x, y, a: 0, dead: false }
  }
  return null
}
function refillFrogs() {
  let guard = 0
  while (frogs.value.filter(f => !f.dead).length < N_LIVE && guard++ < 10) {
    const f = spawnFrog()
    if (!f) break
    frogs.value.push(f)
  }
}
function hopFrogs() {
  const arrived: number[] = []
  for (const f of frogs.value) {
    if (f.dead) continue
    const dx = pond.value.x - f.x, dy = pond.value.y - f.y
    const d = Math.hypot(dx, dy) || 1
    f.a = Math.atan2(dy, dx) * 180 / Math.PI + 90        // sprite faces "up"
    if (d < 26) { arrived.push(f.id); continue }         // made it — into the pond
    const step = Math.min(HOP, d)
    f.x += (dx / d) * step
    f.y += (dy / d) * step
  }
  if (arrived.length) frogs.value = frogs.value.filter(f => !arrived.includes(f.id))
  const splats = frogs.value.filter(f => f.dead)
  if (splats.length > MAX_SPLATS) {
    const drop = new Set(splats.slice(0, splats.length - MAX_SPLATS).map(f => f.id))
    frogs.value = frogs.value.filter(f => !drop.has(f.id))
  }
  refillFrogs()
}

/** distance from a point to the segment the car just swept through */
function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const vx = x2 - x1, vy = y2 - y1
  const len2 = vx * vx + vy * vy
  if (!len2) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * vx + (py - y1) * vy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy))
}
function squash(from: { x: number; y: number }, to: { x: number; y: number }) {
  // smear the splat along the direction the car was travelling
  const dir = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI
  for (const f of frogs.value) {
    if (!f.dead && distToSeg(f.x, f.y, from.x, from.y, to.x, to.y) < SQUASH_R) {
      f.dead = true
      f.a = dir
    }
  }
}

function place(t: number) {
  const s = sample(t)
  if (s) car.value = s
}

// Collision runs off the car's RENDERED position, once per frame. Setting
// car.value only starts a CSS transition — checking there would flatten frogs
// up to a second before the car visibly reaches them, and the whole runaway
// path at once. Reading the real rect keeps the squash in step with the pixels.
const carEl = ref<HTMLElement | null>(null)
let raf = 0
let lastFrame: { x: number; y: number } | null = null
let settle = 0            // frames to ignore right after a reset

function trackCar() {
  raf = requestAnimationFrame(trackCar)
  const el = carEl.value, cont = scene.value
  if (!el || !cont || !player.value) { lastFrame = null; return }
  const r = el.getBoundingClientRect()
  if (!r.width) { lastFrame = null; return }        // hidden (not started, or exploded)
  const base = cont.getBoundingClientRect()
  const s = base.width / cont.clientWidth || 1
  const now = {
    x: (r.left + r.width / 2 - base.left) / s,
    y: (r.top + r.height / 2 - base.top) / s,
  }
  if (settle > 0) settle--
  else if (lastFrame) squash(lastFrame, now)
  lastFrame = now
}

// ── the crash ────────────────────────────────────────────────────────────
const boom = ref<{ x: number; y: number } | null>(null)
const boomSvg = ref<SVGSVGElement | null>(null)
let boomAt: { x: number; y: number } | null = null
let boomTimer: ReturnType<typeof setTimeout> | undefined

/** where a ray from (x,y) at angle `a` leaves the scene, pulled just inside */
function exitPoint(x: number, y: number, a: number) {
  const cont = scene.value
  if (!cont) return null
  const W = cont.clientWidth, H = cont.clientHeight
  const dx = Math.cos(a), dy = Math.sin(a)
  let best = Infinity
  for (const t of [dx > 0 ? (W - x) / dx : dx < 0 ? -x / dx : Infinity,
                   dy > 0 ? (H - y) / dy : dy < 0 ? -y / dy : Infinity]) {
    if (t > 0 && t < best) best = t
  }
  if (!isFinite(best)) return null
  const inset = Math.max(0, best - 84)     // keep the whole blast on screen
  return { x: x + dx * inset, y: y + dy * inset }
}

// ── choosing a player ────────────────────────────────────────────────────
let timer: ReturnType<typeof setInterval> | undefined
function pick(p: Player) {
  clearInterval(timer)
  clearTimeout(boomTimer)
  boom.value = null
  boomAt = null
  player.value = p
  progress.value = START            // always from the beginning
  wheelAngle.value = 0
  frogs.value = []                  // clear the previous run's roadkill
  refillFrogs()
  // teleport back to A rather than driving there, and don't count that as a pass
  snap.value = true
  settle = 8
  lastFrame = null
  place(START)
  nextTick(() => requestAnimationFrame(() => { snap.value = false }))
  if (p === 'human') { mode.value = 'manual'; return }
  mode.value = 'auto'
  let step = 0
  timer = setInterval(() => {
    step++
    if (step <= 4) {
      progress.value = START + (0.62 - START) * (step / 4)   // first bends look great
      wheelAngle.value += 95
      place(progress.value)
    } else {
      clearInterval(timer)
      // …then it holds its heading straight through the next bend
      mode.value = 'gone'
      const a = car.value.a * Math.PI / 180
      const edge = exitPoint(car.value.x, car.value.y, a)
      // aim just past where it leaves the frame, so the bang lands on cue
      const run = edge ? Math.hypot(edge.x - car.value.x, edge.y - car.value.y) + 150 : 1800
      // frogs in its path get flattened as it actually passes them (see trackCar)
      car.value = { x: car.value.x + Math.cos(a) * run, y: car.value.y + Math.sin(a) * run, a: car.value.a }
      wheelAngle.value += 1260
      if (edge) boomAt = edge
      boomTimer = setTimeout(() => { if (boomAt) boom.value = boomAt }, 1120)
    }
  }, 620)
}

// ── manual steering ──────────────────────────────────────────────────────
let lastAng: number | null = null
/** angle of the pointer about the wheel centre, plus how far out it is */
function polarAt(e: PointerEvent) {
  const r = wheelEl.value!.getBoundingClientRect()
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2)
  return { a: Math.atan2(dy, dx) * 180 / Math.PI, r: Math.hypot(dx, dy) }
}
const DEAD_ZONE = 16   // near the hub the angle is unstable — ignore it there
function wheelDown(e: PointerEvent) {
  if (mode.value !== 'manual') return
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  const p = polarAt(e)
  lastAng = p.r < DEAD_ZONE ? null : p.a
}
function wheelMove(e: PointerEvent) {
  if (mode.value !== 'manual') return
  const p = polarAt(e)
  if (p.r < DEAD_ZONE) return                    // too close to the hub to be meaningful
  if (lastAng === null) { lastAng = p.a; return }
  let d = p.a - lastAng
  while (d > 180) d -= 360
  while (d < -180) d += 360
  lastAng = p.a
  d = Math.max(-45, Math.min(45, d))             // no wild jumps if they cross the hub
  wheelAngle.value += d
  progress.value = Math.max(START, Math.min(1, START + wheelAngle.value / TURN_TO_B))
  place(progress.value)
  if (progress.value >= 0.999) mode.value = 'arrived'
}
function wheelUp() { lastAng = null }

// ── hand-drawn rendering ─────────────────────────────────────────────────
function rng(seed: number) {          // deterministic, so the scenery never jitters
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function drawScene() {
  const svg = sceneSvg.value, cont = scene.value, mp = measure.value
  if (!svg || !cont || !mp) return
  const W = cont.clientWidth, H = cont.clientHeight
  if (!W || !H) return
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  mp.setAttribute('d', pathFor(W))     // geometry queries below see this at once
  pond.value = { x: 0.10 * W, y: 48, rx: 32, ry: 21 }

  Array.from(svg.querySelectorAll('.gen')).forEach(n => n.remove())
  const rc = rough.svg(svg)
  const add = (n: SVGGElement) => { n.classList.add('gen'); svg.appendChild(n) }

  const L = mp.getTotalLength()
  const N = 150
  spine = []
  for (let i = 0; i <= N; i++) {
    const d = (i / N) * L
    const p = mp.getPointAtLength(d)
    const q = mp.getPointAtLength(Math.min(L, d + 1.5))
    const r = mp.getPointAtLength(Math.max(0, d - 1.5))
    const tx = q.x - r.x, ty = q.y - r.y
    const m = Math.hypot(tx, ty) || 1
    spine.push({ x: p.x, y: p.y, nx: -ty / m, ny: tx / m })
  }

  // trees first, so the road sits on top of any crowding the verge
  const rand = rng(1337)
  const trees: { x: number; y: number; r: number }[] = []
  for (let tries = 0; tries < 700 && trees.length < 14; tries++) {
    const x = rand() * W, y = 10 + rand() * 190
    if (nearest(x, y).d < HALF_W + 32) continue
    if (Math.hypot(x - pond.value.x, y - pond.value.y) < 78) continue
    if (trees.some(t => Math.hypot(t.x - x, t.y - y) < 70)) continue
    trees.push({ x, y, r: 12 + rand() * 7 })
  }
  trees.forEach((t, i) => {
    const c = LEAF[i % LEAF.length]
    add(rc.circle(t.x, t.y, t.r * 2, {
      roughness: 2, bowing: 1.4, strokeWidth: 1.6, stroke: '#2F5E3C', fill: c, fillStyle: 'solid',
    }))
    add(rc.circle(t.x + t.r * 0.35, t.y - t.r * 0.3, t.r * 1.1, {
      roughness: 2.2, strokeWidth: 1.2, stroke: '#2F5E3C', fill: c, fillStyle: 'solid',
    }))
  })

  // the pond the frogs are heading for
  add(rc.ellipse(pond.value.x, pond.value.y, pond.value.rx * 2, pond.value.ry * 2, {
    roughness: 1.9, bowing: 1.3, strokeWidth: 2, stroke: '#2F6D8F', fill: '#BFE3F2', fillStyle: 'solid',
  }))
  add(rc.line(pond.value.x - 12, pond.value.y + 4, pond.value.x + 4, pond.value.y + 4,
    { roughness: 1.6, strokeWidth: 1.3, stroke: '#5FA3C4' }))

  // the road: one closed shape down the left edge and back up the right
  const left = spine.map(s => [s.x + s.nx * HALF_W, s.y + s.ny * HALF_W] as [number, number])
  const right = spine.map(s => [s.x - s.nx * HALF_W, s.y - s.ny * HALF_W] as [number, number])
  add(rc.polygon([...left, ...right.reverse()], {
    roughness: 1.5, bowing: 0.8, strokeWidth: 2.2, stroke: INK, fill: ASPHALT, fillStyle: 'solid',
  }))
  for (let i = 0; i < N; i += 6) {
    const p = spine[i], q = spine[Math.min(N, i + 3)]
    add(rc.line(p.x, p.y, q.x, q.y, { roughness: 1.2, strokeWidth: 1.6, stroke: DIM }))
  }
}

function drawCar() {
  const el = carSvg.value
  if (!el) return
  while (el.firstChild) el.removeChild(el.firstChild)
  const rc = rough.svg(el)
  const o = { roughness: 1.5, bowing: 1.1, strokeWidth: 2, stroke: INK }
  ;[[11, 1], [11, 23], [33, 1], [33, 23]].forEach(([x, y]) => {
    el.appendChild(rc.rectangle(x, y, 9, 4, { ...o, strokeWidth: 1.4, fill: INK, fillStyle: 'solid' }))
  })
  el.appendChild(rc.rectangle(5, 4, 44, 20, { ...o, fill: '#fff', fillStyle: 'solid' }))
  el.appendChild(rc.rectangle(33, 7, 11, 14, { ...o, strokeWidth: 1.5, fill: '#DBF9EE', fillStyle: 'solid' }))
}
function drawBoom() {
  const el = boomSvg.value
  if (!el) return
  while (el.firstChild) el.removeChild(el.firstChild)
  const rc = rough.svg(el)
  // two spiky bursts, one inside the other
  const star = (spikes: number, rOut: number, rIn: number, rot: number) => {
    const pts: [number, number][] = []
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 ? rIn : rOut
      const t = rot + (i * Math.PI) / spikes
      pts.push([70 + Math.cos(t) * r, 70 + Math.sin(t) * r])
    }
    return pts
  }
  el.appendChild(rc.polygon(star(11, 66, 34, 0.15), {
    roughness: 2.1, bowing: 1.4, strokeWidth: 2.4, stroke: '#B3400F',
    fill: '#F5A524', fillStyle: 'solid',
  }))
  el.appendChild(rc.polygon(star(9, 40, 19, 0.5), {
    roughness: 2.2, bowing: 1.3, strokeWidth: 2, stroke: '#B3400F',
    fill: '#F5512E', fillStyle: 'solid',
  }))
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

const marks = ref<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null)
const splatCount = computed(() => frogs.value.filter(f => f.dead).length)

let ro: ResizeObserver
let hop: ReturnType<typeof setInterval> | undefined
function relayout() {
  drawScene()
  place(progress.value)
  const s0 = sample(0), s1 = sample(1)
  if (s0 && s1) marks.value = { a: { x: s0.x - 6, y: s0.y + 44 }, b: { x: s1.x + 8, y: s1.y - 42 } }
  refillFrogs()
}
onMounted(() => {
  relayout(); drawCar(); drawWheel()
  ro = new ResizeObserver(relayout)
  if (scene.value) ro.observe(scene.value)
  hop = setInterval(hopFrogs, 520)
  raf = requestAnimationFrame(trackCar)
})
onUnmounted(() => {
  ro?.disconnect(); clearInterval(timer); clearInterval(hop); clearTimeout(boomTimer)
  cancelAnimationFrame(raf)
})
// the burst only exists in the DOM once it has gone off — draw it then
watch(boom, v => { if (v) nextTick(drawBoom) })
</script>

<template>
  <div ref="scene" class="scene">
    <svg ref="sceneSvg" class="scenery">
      <path ref="measure" fill="none" stroke="none" />
    </svg>

    <template v-if="marks">
      <span class="marker" :style="{ left: marks.a.x + 'px', top: marks.a.y + 'px' }">A</span>
      <span class="marker" :style="{ left: marks.b.x + 'px', top: marks.b.y + 'px' }">B</span>
    </template>

    <div
      v-for="f in frogs"
      :key="f.id"
      class="frog"
      :class="{ dead: f.dead }"
      :style="{ left: f.x + 'px', top: f.y + 'px', transform: `translate(-50%,-50%) rotate(${f.a}deg)` }"
    >
      <svg v-if="!f.dead" viewBox="0 0 18 16" width="27">
        <ellipse cx="9" cy="9" rx="6" ry="5" fill="#5FB45F" stroke="#2F5E3C" stroke-width="1.2" />
        <circle cx="6.4" cy="4.2" r="2.1" fill="#5FB45F" stroke="#2F5E3C" stroke-width="1.1" />
        <circle cx="11.6" cy="4.2" r="2.1" fill="#5FB45F" stroke="#2F5E3C" stroke-width="1.1" />
        <circle cx="6.4" cy="4.2" r="0.8" fill="#1D3B26" />
        <circle cx="11.6" cy="4.2" r="0.8" fill="#1D3B26" />
        <path d="M2.5 12.5 L0.8 15 M15.5 12.5 L17.2 15" stroke="#2F5E3C" stroke-width="1.2" fill="none" />
      </svg>
      <!-- squashed -->
      <svg v-else viewBox="0 0 22 16" width="33">
        <ellipse cx="11" cy="8" rx="10" ry="3.2" fill="#98A375" stroke="#5A6340" stroke-width="1.1" />
        <path d="M2 8 L0.2 6.2 M20 8 L21.8 6.2 M5 10.6 L3.6 12.8 M17 10.6 L18.4 12.8"
              stroke="#5A6340" stroke-width="1.1" fill="none" />
        <path d="M7 6.4 L9 9 M9 6.4 L7 9 M13 6.4 L15 9 M15 6.4 L13 9"
              stroke="#3A2F22" stroke-width="1.2" fill="none" />
      </svg>
    </div>

    <div v-if="boom" class="boom" :style="{ left: boom.x + 'px', top: boom.y + 'px' }">
      <svg ref="boomSvg" viewBox="0 0 140 140" width="140" />
      <span class="boom-word">BOOM</span>
    </div>

    <div v-show="player && !boom" ref="carEl" class="car" :style="carStyle">
      <svg ref="carSvg" viewBox="0 0 54 28" width="54" />
    </div>

    <div class="picker">
      <div class="picker-title">choose your player</div>
      <div class="cards">
        <button class="card" :class="{ on: player === 'human' }" @click="pick('human')">
          <User :size="26" /><span>Human</span>
        </button>
        <button class="card" :class="{ on: player === 'llm' }" @click="pick('llm')">
          <Bot :size="26" /><span>LLM</span>
        </button>
      </div>
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
      <User v-if="player === 'human'" class="wheel-driver" :size="26" />
      <Bot v-else-if="player === 'llm'" class="wheel-driver bot" :size="26" />
    </div>

    <div class="caption">
      <span v-if="mode === 'idle'" class="dim">pick a driver to start from <b>A</b></span>
      <span v-else-if="mode === 'manual'" class="dim">turn the wheel to get from <b>A</b> to <b>B</b></span>
      <span v-else-if="mode === 'arrived'" class="punch">Made it — all the way to B.</span>
      <!-- hold the line until the bang actually lands -->
      <span v-else-if="mode === 'auto' || !boom" class="dim">…so far, so good.</span>
      <span v-else class="punch apology">
        You're absolutely right — I should not have driven off the road.
      </span>
      <span v-if="splatCount" class="toll">{{ splatCount }} frog{{ splatCount > 1 ? 's' : '' }} flattened</span>
    </div>
  </div>
</template>

<style scoped>
.scene {
  position: relative; width: 100%; height: 400px;
  overflow: hidden; touch-action: none; user-select: none;
}
.scenery { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }

.marker {
  position: absolute; transform: translate(-50%, -50%);
  font-family: 'Kalam', cursive; font-weight: 700; font-size: 1.5rem; color: var(--ink-dim);
}

.frog { position: absolute; pointer-events: none; transition: left .42s ease-out, top .42s ease-out; }
.frog.dead { transition: none; }
.frog svg { display: block; height: auto; }

.boom {
  position: absolute; transform: translate(-50%, -50%);
  pointer-events: none; z-index: 4;
  display: grid; place-items: center;
  animation: pop .32s cubic-bezier(.2,1.5,.4,1) both;
}
.boom svg { display: block; height: auto; grid-area: 1 / 1; }
.boom-word {
  grid-area: 1 / 1;
  font-family: 'Kalam', cursive; font-weight: 700; font-size: 1.7rem;
  color: #FFF6E5; text-shadow: 0 2px 0 #B3400F;
  transform: rotate(-8deg);
}
@keyframes pop {
  from { opacity: 0; transform: translate(-50%, -50%) scale(.25); }
  to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

.car { position: absolute; will-change: left, top, transform; z-index: 2; }
.car svg { display: block; height: auto; }

.picker { position: absolute; left: 2%; bottom: 78px; }
.picker-title {
  font-family: 'Kalam', cursive; font-size: 1rem; color: var(--ink-dim); margin-bottom: 0.4rem;
}
.cards { display: flex; gap: 0.7rem; }
.card {
  display: flex; align-items: center; gap: 0.45rem;
  padding: 0.5rem 1rem; border-radius: 12px; cursor: pointer;
  border: 2px solid var(--border); background: var(--surface); color: var(--ink);
  font-family: 'Kalam', cursive; font-weight: 700; font-size: 1.05rem;
  transition: border-color .15s ease, background .15s ease, transform .12s ease;
}
.card:hover { transform: translateY(-2px); }
.card.on { border-color: var(--sapphire); background: #EAF0FF; color: #1B2E8A; }

.wheel {
  position: absolute; right: 40px; bottom: 36px;
  width: 120px; height: 120px; cursor: grab; touch-action: none;
}
.wheel:active { cursor: grabbing; }
.wheel.live { cursor: default; }
.wheel-svg { display: block; will-change: transform; }
.wheel-driver { position: absolute; inset: 0; margin: auto; color: var(--ink); }
.wheel-driver.bot { color: var(--sapphire); }

.caption {
  position: absolute; left: 2%; bottom: 14px; right: 190px;
  display: flex; align-items: baseline; gap: 0.8rem; flex-wrap: wrap;
  font-size: 1.05rem;
}
.caption b { color: var(--sapphire); font-family: 'Kalam', cursive; font-size: 1.2rem; }
.dim { color: var(--ink-dim); }
.punch { font-family: 'Source Serif 4', Georgia, serif; font-size: 1.5rem; }
/* the LLM's mea culpa runs long — size it to fit on one line */
.punch.apology { font-size: 1.2rem; font-style: italic; color: var(--ink-dim); }
.toll { font-family: 'Kalam', cursive; font-size: 0.95rem; color: #9c2a10; }
</style>
