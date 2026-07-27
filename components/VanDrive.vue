<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { onSlideEnter } from '@slidev/client'

// The Bronto van, used twice:
//   mode="exit"    — parked in the corner; when `go` flips true it drives off to
//                    the right and then emits `done` so the deck can advance.
//   mode="through" — on entering the slide it drives in from the left, straight
//                    across, and off the other side.
const props = withDefaults(defineProps<{
  mode?: 'exit' | 'through'
  go?: boolean
  /** true only while the deck is moving forwards — see the watcher */
  forward?: boolean
}>(), {
  mode: 'exit',
  go: false,
  forward: true,
})
const emit = defineEmits<{ (e: 'done'): void }>()

const EXIT_MS = 850
const THROUGH_MS = 2100
const OFF_RIGHT = 380        // clears the right edge from the parked position
const OFF_LEFT = -1150       // fully off the left edge of the slide

const x = ref(0)
const anim = ref(false)
let fired = false

function driveThrough() {
  anim.value = false
  x.value = OFF_LEFT
  // two frames so the start position paints before the transition begins
  requestAnimationFrame(() => requestAnimationFrame(() => {
    anim.value = true
    x.value = OFF_RIGHT
  }))
}

// Slidev keeps slides mounted, so onMounted fires once ever — the drive-through
// has to hang off slide entry or it only ever plays the first time.
if (props.mode === 'through') onSlideEnter(driveThrough)

onMounted(() => {
  if (props.mode === 'exit' && props.go) x.value = OFF_RIGHT   // returned past the drive-off
})

// Only on the false -> true edge, and only going forwards. Stepping BACK into
// this slide also takes clicks 0 -> max, which looks identical here; without the
// direction check the deck would immediately throw you forwards again.
watch(() => props.go, (now, before) => {
  if (props.mode !== 'exit') return
  if (now && !before) {
    anim.value = true
    x.value = OFF_RIGHT
    if (!fired && props.forward) {
      fired = true
      setTimeout(() => emit('done'), EXIT_MS)
    }
  } else if (!now) {
    anim.value = true
    x.value = 0
    fired = false
  }
})
</script>

<template>
  <img
    src="/img/dino-van.png"
    class="van"
    :data-mode="mode"
    :style="{
      transform: `translateX(${x}px)`,
      transition: anim
        ? `transform ${mode === 'through' ? THROUGH_MS : EXIT_MS}ms ${mode === 'through' ? 'linear' : 'cubic-bezier(.45,0,.9,.55)'}`
        : 'none',
    }"
  />
</template>

<style scoped>
.van {
  position: absolute; right: 24px; bottom: 24px;
  width: 230px; height: auto; opacity: 0.9;
  pointer-events: none; z-index: 5;
  will-change: transform;
}
</style>
