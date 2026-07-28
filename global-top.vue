<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useNav } from '@slidev/client'

/**
 * Slidev disables every keyboard shortcut while a <button> or <a> holds focus:
 *
 *   isOnFocus = ['BUTTON','A'].includes(activeElement.tagName)
 *
 * So one click on a ladder control, a map cell, a player card or even a link
 * leaves the arrow keys dead until you happen to click bare background. Mid-talk
 * that reads as the deck having frozen.
 *
 * Two layers of defence:
 *  1. hand focus back after any click, which fixes the cause deck-wide;
 *  2. a always-available click target to advance, for when something still eats
 *     the keys.
 */
const { next, prev } = useNav()

// 1 — release focus after a click anywhere.
// pointerup, not click: it still fires when a handler stops click propagation.
// Deferred with a timeout rather than rAF so it also runs when the tab is not
// painting, and so the element's own focus and handlers go first.
function releaseFocus(e: PointerEvent) {
  const el = e.target as HTMLElement | null
  if (el?.closest('input, textarea, select, [contenteditable]')) return
  setTimeout(() => {
    const active = document.activeElement as HTMLElement | null
    if (active && ['BUTTON', 'A'].includes(active.tagName)) active.blur()
  }, 0)
}

const hint = ref(false)
let t: ReturnType<typeof setTimeout> | undefined
function nudge() {
  hint.value = true
  clearTimeout(t)
  t = setTimeout(() => { hint.value = false }, 1800)
}

onMounted(() => {
  window.addEventListener('pointerup', releaseFocus, true)
  window.addEventListener('mousemove', nudge, { passive: true })
})
onUnmounted(() => {
  window.removeEventListener('pointerup', releaseFocus, true)
  window.removeEventListener('mousemove', nudge)
  clearTimeout(t)
})
</script>

<template>
  <!-- 2 — the escape hatch. Fades in on mouse movement, so it is there the moment
       you reach for it and invisible while you are just presenting. -->
  <div class="navsafe" :class="{ show: hint }">
    <button class="ns-btn" title="previous slide" @click="prev()">‹</button>
    <button class="ns-btn" title="next slide" @click="next()">›</button>
  </div>
</template>

<style scoped>
.navsafe {
  position: fixed; right: 14px; bottom: 12px; z-index: 60;
  display: flex; gap: 6px;
  /* faint but always clickable: as an escape hatch it is useless if you have to
     wake it up first, and it must never be the thing that is stuck */
  opacity: 0.14;
  transition: opacity 0.25s ease;
}
.navsafe.show, .navsafe:hover { opacity: 1; }

.ns-btn {
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(43, 38, 32, 0.16);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(4px);
  color: #2B2620; font-size: 1.1rem; line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease;
}
.ns-btn:hover { background: #fff; }
</style>
