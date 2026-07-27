<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { onSlideEnter } from '@slidev/client'

// Holds its content back for `delay` ms after the slide is entered — used to let
// the van clear the frame before the CNCF card appears, so the two don't compete.
// Re-arms on every entry: Slidev keeps slides mounted, so a plain CSS animation
// or an onMounted timer would only ever fire the first time.
const props = withDefaults(defineProps<{ delay?: number }>(), { delay: 2250 })

const shown = ref(false)
let t: ReturnType<typeof setTimeout> | undefined

onSlideEnter(() => {
  clearTimeout(t)
  shown.value = false
  t = setTimeout(() => { shown.value = true }, props.delay)
})
onUnmounted(() => clearTimeout(t))
</script>

<template>
  <transition name="settle">
    <div v-if="shown"><slot /></div>
  </transition>
</template>

<style scoped>
.settle-enter-active { transition: opacity 0.45s ease, transform 0.45s cubic-bezier(.2,.8,.2,1); }
.settle-enter-from { opacity: 0; transform: translateY(14px); }
</style>
