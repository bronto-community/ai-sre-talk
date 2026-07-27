<script setup lang="ts">
import { ref, onMounted, onUnmounted, markRaw, watch, nextTick } from 'vue'
import rough from 'roughjs'
import { Bell, MessageSquare, Zap, GitPullRequest, Lightbulb, Activity, Boxes, Cloud, Infinity as InfinityIcon } from 'lucide-vue-next'

// Common "AI SRE" architecture, hand-drawn. Three lanes:
//   left = triggers · center = LLM + tools (fanned below) · right = outputs.
// Fixed logical size (no vh) so it scales identically on every screen.
//
// Built up one Slidev click at a time:
//   0 empty · 1 inputs · 2 the LLM · 3 its tools · 4 outputs
const props = withDefaults(defineProps<{ stage?: number }>(), { stage: 0 })

const wrap = ref<HTMLElement | null>(null)
const overlay = ref<SVGSVGElement | null>(null)

const STAGE: Record<Kind, number> = {
  trigger: 1, llm: 2, cat: 3, more: 3, eg: 3, out: 4,
}
const shown = (k: Kind) => props.stage >= STAGE[k]

type Kind = 'trigger' | 'llm' | 'out' | 'cat' | 'eg' | 'more'
type Box = { id: string; l: number; t: number; w: number; h: number; label: string; kind: Kind; under?: string; logo?: string; icon?: any }
const boxes: Box[] = [
  // left lane — triggers (nothing sits below them)
  { id: 'alerts', l: 1, t: 4, w: 15, h: 14, label: 'Alerts', kind: 'trigger', icon: markRaw(Bell) },
  { id: 'prompts', l: 1, t: 21, w: 15, h: 14, label: 'Prompts', kind: 'trigger', icon: markRaw(MessageSquare) },
  { id: 'events', l: 1, t: 38, w: 15, h: 14, label: 'Events', kind: 'trigger', icon: markRaw(Zap) },
  // center lane — the LLM
  { id: 'llm', l: 40, t: 5, w: 20, h: 18, label: 'LLM agent', kind: 'llm' },
  // right lane — outputs
  { id: 'fix', l: 84, t: 6, w: 15, h: 14, label: 'a fix (PR)', kind: 'out', icon: markRaw(GitPullRequest) },
  { id: 'hyp', l: 84, t: 25, w: 15, h: 14, label: 'hypotheses', kind: 'out', icon: markRaw(Lightbulb) },
  // center lane — five tool categories, narrow, centered under the LLM
  { id: 'obs', l: 24, t: 45, w: 12.5, h: 14, label: 'Observability', kind: 'cat', icon: markRaw(Activity) },
  { id: 'cls', l: 37, t: 45, w: 12.5, h: 14, label: 'Cluster', kind: 'cat', icon: markRaw(Boxes) },
  { id: 'cld', l: 50, t: 45, w: 12.5, h: 14, label: 'Cloud APIs', kind: 'cat', icon: markRaw(Cloud) },
  { id: 'ci', l: 63, t: 45, w: 12.5, h: 14, label: 'CI / CD', kind: 'cat', icon: markRaw(InfinityIcon) },
  { id: 'more', l: 76.5, t: 45, w: 7, h: 14, label: '…', kind: 'more' },
  // an example (with logo) under each named category
  { id: 'eg-obs', l: 24, t: 64, w: 12.5, h: 15, label: 'Bronto MCP', kind: 'eg', under: 'obs', logo: '/img/bronto-dino.png' },
  { id: 'eg-cls', l: 37, t: 64, w: 12.5, h: 15, label: 'K8s MCP', kind: 'eg', under: 'cls', logo: '/img/logo-k8s.svg' },
  { id: 'eg-cld', l: 50, t: 64, w: 12.5, h: 15, label: 'AWS API', kind: 'eg', under: 'cld', logo: '/img/logo-aws.svg' },
  { id: 'eg-ci', l: 63, t: 64, w: 12.5, h: 15, label: 'GitHub CLI', kind: 'eg', under: 'ci', logo: '/img/logo-github.svg' },
]
const arrows: [string, string][] = [
  ['alerts', 'llm'], ['prompts', 'llm'], ['events', 'llm'],
  ['llm', 'fix'], ['llm', 'hyp'],
]
const cats = ['obs', 'cls', 'cld', 'ci', 'more']

const INK = '#2B2620', SAPPHIRE = '#476BFF', GREEN = '#1B7A55', DIM = '#B8AEA0', AMBER = '#D9930A'

function draw() {
  const svg = overlay.value, cont = wrap.value
  if (!svg || !cont) return
  const W = cont.clientWidth, H = cont.clientHeight
  if (!W || !H) return
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  while (svg.firstChild) svg.removeChild(svg.firstChild)
  const rc = rough.svg(svg)
  const px = (b: Box) => ({ x: (b.l / 100) * W, y: (b.t / 100) * H, w: (b.w / 100) * W, h: (b.h / 100) * H })
  const at = (id: string) => px(boxes.find(b => b.id === id)!)

  boxes.forEach(b => {
    if (b.kind === 'more' || !shown(b.kind)) return
    const p = px(b)
    const stroke = b.kind === 'llm' ? SAPPHIRE : b.kind === 'out' ? GREEN : b.kind === 'trigger' ? AMBER : b.kind === 'eg' ? DIM : INK
    const sw = b.kind === 'eg' ? 1.6 : 2
    svg.appendChild(rc.rectangle(p.x, p.y, p.w, p.h, { roughness: 1.6, bowing: 1.2, strokeWidth: sw, stroke }))
  })

  const arrow = (x1: number, y1: number, x2: number, y2: number, color: string) => {
    svg.appendChild(rc.line(x1, y1, x2, y2, { roughness: 1.3, strokeWidth: 2, stroke: color }))
    const a = Math.atan2(y2 - y1, x2 - x1), L = 10
    svg.appendChild(rc.line(x2, y2, x2 - L * Math.cos(a - 0.4), y2 - L * Math.sin(a - 0.4), { roughness: 1, strokeWidth: 2, stroke: color }))
    svg.appendChild(rc.line(x2, y2, x2 - L * Math.cos(a + 0.4), y2 - L * Math.sin(a + 0.4), { roughness: 1, strokeWidth: 2, stroke: color }))
  }
  arrows.forEach(([from, to]) => {
    const isOut = to === 'fix' || to === 'hyp'
    // a trigger arrow needs the LLM on screen; an output arrow needs the outputs
    if (!shown(isOut ? 'out' : 'llm')) return
    const a = at(from), b = at(to)
    const color = isOut ? GREEN : AMBER
    arrow(a.x + a.w, a.y + a.h / 2, b.x, b.y + b.h / 2, color)
  })

  if (shown('cat')) {
    // five lines fanning from the LLM to each tool category
    const llm = at('llm')
    const fanX = llm.x + llm.w / 2, fanY = llm.y + llm.h
    cats.forEach(id => { const c = at(id); arrow(fanX, fanY, c.x + c.w / 2, c.y, INK) })
    // thin connector: each category to its example
    boxes.filter(b => b.kind === 'eg').forEach(eg => {
      const c = at(eg.under!), e = at(eg.id)
      svg.appendChild(rc.line(c.x + c.w / 2, c.y + c.h, e.x + e.w / 2, e.y, { roughness: 1.1, strokeWidth: 1.4, stroke: DIM }))
    })
  }
}

let ro: ResizeObserver
onMounted(() => {
  draw()
  ro = new ResizeObserver(() => draw())
  if (wrap.value) ro.observe(wrap.value)
})
onUnmounted(() => ro?.disconnect())
watch(() => props.stage, () => nextTick(draw))

const styleOf = (b: Box) => ({ left: b.l + '%', top: b.t + '%', width: b.w + '%', height: b.h + '%' })
</script>

<template>
  <div ref="wrap" class="wrap">
    <svg ref="overlay" class="overlay" />
    <div v-for="b in boxes" v-show="shown(b.kind)" :key="b.id" class="box" :class="b.kind" :style="styleOf(b)">
      <img v-if="b.logo" :src="b.logo" class="logo" />
      <component :is="b.icon" v-if="b.icon" class="bicon" :size="20" />
      <span>{{ b.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.wrap { position: relative; width: 100%; height: 380px; margin-top: 0.4rem; }
.overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.box {
  position: absolute;
  display: flex; align-items: center; justify-content: center; gap: 0.35rem;
  font-family: 'Kalam', cursive; font-weight: 700; color: var(--ink);
  text-align: center; line-height: 1.02; padding: 0 0.2rem;
}
.box.trigger, .box.cat { font-size: clamp(0.62rem, 1.1vw, 0.92rem); }
.box.cat { flex-direction: column; gap: 0.2rem; }
.box.cat .bicon { color: var(--sapphire); opacity: 0.85; }
.box.trigger { color: #7A5200; }
.box.llm { color: #1B2E8A; font-size: 1.4rem; }
.box.out { color: #12563B; font-size: clamp(0.7rem, 1.1vw, 0.95rem); }
.box .bicon { flex-shrink: 0; }
.box.trigger .bicon { color: #D9930A; }
.box.out .bicon { color: #1B7A55; }
.box.eg {
  flex-direction: column; gap: 0.25rem;
  font-family: 'Radio Canada Big', sans-serif; font-weight: 600;
  font-size: clamp(0.6rem, 0.95vw, 0.78rem); color: var(--ink-dim);
}
.box.eg .logo { width: clamp(18px, 2vw, 26px); height: auto; }
.box.more { font-size: 1.5rem; color: var(--ink-dim); }
</style>
