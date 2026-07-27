<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import rough from 'roughjs'
import { LEVELS } from '../data'

// Levels sit in a row; the technique each step ADDS is drawn as a hand-drawn
// half circle looping BELOW the two levels it connects. Horizontal space is
// tight, vertical space below is not — so the connectors go down there.
//
// All six levels show at once; `stage` reveals the connectors one click at a time.
const props = withDefaults(defineProps<{ stage?: number }>(), { stage: 0 })
const steps: Record<string, string> = {
  assisted: 'Code',
  linear: 'a trigger',
  conditional: 'an "if"',
  high: 'ML · LLMs',
  autonomy: 'trust',
}

const root = ref<HTMLElement | null>(null)
const band = ref<HTMLElement | null>(null)
const svgEl = ref<SVGSVGElement | null>(null)

type Label = { x: number; y: number; text: string }
const labels = ref<Label[]>([])

const INK = '#857B6E'
const SAPPHIRE = '#476BFF'

function draw() {
  const svg = svgEl.value, b = band.value, r = root.value
  if (!svg || !b || !r) return
  const W = b.clientWidth, H = b.clientHeight
  if (!W || !H) return
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  while (svg.firstChild) svg.removeChild(svg.firstChild)
  const rc = rough.svg(svg)

  const els = Array.from(r.querySelectorAll<HTMLElement>('.lvl'))
  if (els.length < 2) return
  // Slidev scales the slide via transform — divide screen deltas back to local px.
  const base = r.getBoundingClientRect()
  const s = base.width / r.offsetWidth || 1
  const centers = els.map(el => {
    const q = el.getBoundingClientRect()
    return (q.left + q.width / 2 - base.left) / s
  })

  const next: Label[] = []
  const upTo = Math.min(props.stage, centers.length - 1)
  for (let i = 0; i < upTo; i++) {
    const x1 = centers[i], x2 = centers[i + 1]
    const rad = (x2 - x1) / 2
    // sweep-flag 0 bows the arc downward, into the empty space under the row
    const d = `M ${x1} 0 A ${rad} ${rad} 0 0 0 ${x2} 0`
    svg.appendChild(rc.path(d, { roughness: 1.4, bowing: 1, strokeWidth: 2, stroke: INK }))
    // arrowhead at the far end — tangent there points straight up
    const head = { r: 1, strokeWidth: 2, stroke: INK }
    svg.appendChild(rc.line(x2, 0, x2 - 6, 11, { ...head, roughness: 1 }))
    svg.appendChild(rc.line(x2, 0, x2 + 6, 11, { ...head, roughness: 1 }))
    next.push({ x: (x1 + x2) / 2, y: rad, text: '+ ' + steps[LEVELS[i + 1].key] })
  }
  labels.value = next
}

let ro: ResizeObserver
onMounted(() => {
  nextTick(draw)
  ro = new ResizeObserver(() => draw())
  if (root.value) ro.observe(root.value)
})
onUnmounted(() => ro?.disconnect())
watch(() => props.stage, () => nextTick(draw))
</script>

<template>
  <div ref="root" class="flow-wrap">
    <div class="flow">
      <div
        v-for="l in LEVELS"
        :key="l.key"
        class="lvl"
        :class="{ aspir: l.aspirational }"
        :style="{ '--c': l.color }"
      >
        <span class="chip" :style="{ background: l.color, color: l.ink }">{{ l.short }}</span>
        <span class="name">{{ l.name }}</span>
      </div>
    </div>

    <div ref="band" class="arcs">
      <svg ref="svgEl" class="arc-svg" />
      <span
        v-for="(lb, i) in labels"
        :key="i"
        class="need"
        :style="{ left: lb.x + 'px', top: lb.y + 'px' }"
      >{{ lb.text }}</span>
    </div>
  </div>
</template>

<style scoped>
.flow-wrap { width: 100%; }

.flow { display: flex; align-items: stretch; gap: 0.55rem; width: 100%; }
.lvl {
  flex: 1 1 0; min-width: 0;
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  padding: 1.1rem 0.4rem;
  border: 1.5px solid color-mix(in srgb, var(--c) 60%, var(--border));
  background: color-mix(in srgb, var(--c) 9%, white);
  border-radius: 14px;
}
.lvl.aspir { border-style: dashed; }
.chip { font-weight: 800; font-size: 0.85rem; padding: 2px 9px; border-radius: 999px; }
.name { font-size: 0.92rem; font-weight: 600; text-align: center; line-height: 1.1; color: var(--ink); }

.arcs { position: relative; width: 100%; height: 132px; }
.arc-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.need {
  position: absolute;
  transform: translate(-50%, 2px);
  font-family: 'Kalam', cursive; font-size: 0.85rem; font-weight: 700;
  color: v-bind('SAPPHIRE');
  white-space: nowrap;
  background: var(--bg); padding: 0 6px;
}
</style>
