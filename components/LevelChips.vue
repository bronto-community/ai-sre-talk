<script setup lang="ts">
import { LEVELS } from '../data'

// A compact L0 -> L5 strip, used to tease the levels on the section divider.
// Reads the same source as the flow and the map, so it can't drift out of sync.
</script>

<template>
  <div class="chips">
    <template v-for="(l, i) in LEVELS" :key="l.key">
      <span
        class="chip"
        :class="{ aspir: l.aspirational }"
        :style="{ background: l.color, color: l.ink }"
      >{{ l.short }}</span>
      <span v-if="i < LEVELS.length - 1" class="tick">›</span>
    </template>
  </div>
</template>

<style scoped>
.chips { display: flex; align-items: center; gap: 0.4rem; }
.chip {
  font-weight: 800; font-size: 0.85rem;
  padding: 3px 11px; border-radius: 999px;
}
.chip.aspir { box-shadow: inset 0 0 0 1.5px #fff; opacity: 0.85; }
.tick { color: var(--ink-dim); font-size: 0.9rem; }
</style>
