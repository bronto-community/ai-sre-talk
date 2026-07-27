<script setup lang="ts">
import { ref, onMounted } from 'vue'
import rough from 'roughjs'

// The sitting Bronto from bronto.io with a hand-drawn speech bubble, the same
// pairing the site uses. The artwork sits in one corner of a mostly-empty
// canvas, so .tb-dino crops to its measured bounds (5% / 52.3% in, 71.3% x
// 42.2% of the file) rather than shipping the whitespace.
const svgEl = ref<SVGSVGElement | null>(null)
const INK = '#2B2620'

// bubble box + where its tail narrows down to the dino's head
const B = { x: 58, y: 14, w: 354, h: 138, r: 28 }
// tip stops short of the head (which starts ~193px down) so it points at Bronto
// rather than resting on him
const TAIL = { right: 202, left: 148, tipX: 100, tipY: 180 }

/** one continuous outline: rounded box with the tail spliced into its bottom edge */
function bubblePath() {
  const { x, y, w, h, r } = B
  return [
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H ${TAIL.right}`,
    `L ${TAIL.tipX} ${TAIL.tipY}`,
    `L ${TAIL.left} ${y + h}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    'Z',
  ].join(' ')
}

onMounted(() => {
  const svg = svgEl.value
  if (!svg) return
  const rc = rough.svg(svg)
  svg.appendChild(rc.path(bubblePath(), {
    roughness: 1.6, bowing: 1.1, strokeWidth: 2.4, stroke: INK,
    fill: '#fff', fillStyle: 'solid',
  }))
})
</script>

<template>
  <div class="tb">
    <svg ref="svgEl" class="tb-svg" viewBox="0 0 420 480" />
    <!-- one span, or each text node becomes its own flex item and the words scatter -->
    <div class="tb-text"><span><slot /></span></div>
    <div class="tb-dino" />
  </div>
</template>

<style scoped>
.tb { position: relative; width: 420px; height: 480px; flex-shrink: 0; }
.tb-svg { position: absolute; inset: 0; width: 100%; height: 100%; }

.tb-text {
  position: absolute; left: 58px; top: 14px; width: 354px; height: 138px;
  display: flex; align-items: center; justify-content: center;
  padding: 0 1.5rem; text-align: center;
  font-family: 'Kalam', cursive; font-size: 1.3rem; line-height: 1.3; color: var(--ink);
}

/* crop to the artwork's measured bounds */
.tb-dino {
  position: absolute; left: 0; top: 192px; width: 340px; height: 286px;
  background: url('/img/bronto-sitting.webp') no-repeat;
  background-size: 477px auto;
  background-position: -24px -355px;
}
</style>
