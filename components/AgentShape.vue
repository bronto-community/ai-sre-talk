<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import rough from 'roughjs'

// The opening architecture stripped to its bones: input, agent, tools, output.
// Same hand-drawn language and the same colour coding as AISREArchSketch, so it
// reads as the same picture with the detail taken away.
const wrap = ref<HTMLElement | null>(null)
const overlay = ref<SVGSVGElement | null>(null)

const INK = '#2B2620', SAPPHIRE = '#476BFF', GREEN = '#1B7A55', AMBER = '#D9930A'

type Box = { id: string; l: number; t: number; w: number; h: number; label: string; kind: string }
const boxes: Box[] = [
  { id: 'in',    l: 1,  t: 26, w: 21, h: 22, label: 'input',  kind: 'in' },
  { id: 'agent', l: 37, t: 26, w: 24, h: 22, label: 'agent',  kind: 'agent' },
  { id: 'tools', l: 37, t: 70, w: 24, h: 22, label: 'tools',  kind: 'tools' },
  { id: 'out',   l: 77, t: 26, w: 21, h: 22, label: 'output', kind: 'out' },
]

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
  const stroke = (k: string) => k === 'agent' ? SAPPHIRE : k === 'out' ? GREEN : k === 'in' ? AMBER : INK

  boxes.forEach(b => {
    const p = px(b)
    svg.appendChild(rc.rectangle(p.x, p.y, p.w, p.h, {
      roughness: 1.6, bowing: 1.2, strokeWidth: 2.4, stroke: stroke(b.kind),
    }))
  })

  const arrow = (x1: number, y1: number, x2: number, y2: number, color: string) => {
    svg.appendChild(rc.line(x1, y1, x2, y2, { roughness: 1.3, strokeWidth: 2.2, stroke: color }))
    const a = Math.atan2(y2 - y1, x2 - x1), L = 11
    svg.appendChild(rc.line(x2, y2, x2 - L * Math.cos(a - 0.4), y2 - L * Math.sin(a - 0.4), { roughness: 1, strokeWidth: 2.2, stroke: color }))
    svg.appendChild(rc.line(x2, y2, x2 - L * Math.cos(a + 0.4), y2 - L * Math.sin(a + 0.4), { roughness: 1, strokeWidth: 2.2, stroke: color }))
  }

  const i = at('in'), a = at('agent'), o = at('out'), t = at('tools')
  arrow(i.x + i.w, i.y + i.h / 2, a.x, a.y + a.h / 2, AMBER)
  arrow(a.x + a.w, a.y + a.h / 2, o.x, o.y + o.h / 2, GREEN)
  arrow(a.x + a.w / 2, a.y + a.h, t.x + t.w / 2, t.y, INK)
}

let ro: ResizeObserver
onMounted(() => {
  draw()
  ro = new ResizeObserver(() => draw())
  if (wrap.value) ro.observe(wrap.value)
})
onUnmounted(() => ro?.disconnect())

const styleOf = (b: Box) => ({ left: b.l + '%', top: b.t + '%', width: b.w + '%', height: b.h + '%' })
</script>

<template>
  <div ref="wrap" class="wrap">
    <svg ref="overlay" class="overlay" />
    <div v-for="b in boxes" :key="b.id" class="box" :class="b.kind" :style="styleOf(b)">
      {{ b.label }}
    </div>
  </div>
</template>

<style scoped>
.wrap { position: relative; width: 100%; height: 260px; }
.overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.box {
  position: absolute;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Kalam', cursive; font-weight: 700; font-size: 1.25rem;
}
.box.in { color: #7A5200; }
.box.agent { color: #1B2E8A; }
.box.out { color: #12563B; }
.box.tools { color: var(--ink); }
</style>
