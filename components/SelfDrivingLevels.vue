<script setup lang="ts">
import { ref } from 'vue'

// The SAE self-driving levels — the analogy, on its own terms.
// (Deliberately NOT mapped to our reliability levels.)
const sae = [
  { n: 0, name: 'No automation',          car: 'You do everything.' },
  { n: 1, name: 'Driver assistance',       car: 'Cruise control or lane-keep — one thing, you supervise.' },
  { n: 2, name: 'Partial automation',      car: 'Steer + speed together, eyes always on the road.' },
  { n: 3, name: 'Conditional automation',  car: 'Drives itself in some conditions; ready to take over.' },
  { n: 4, name: 'High automation',         car: 'No driver needed — inside its mapped domain.' },
  { n: 5, name: 'Full automation',         car: 'No steering wheel. Anywhere, any conditions.' },
]

const active = ref<number | null>(null)
function pick(n: number) { active.value = active.value === n ? null : n }

// a cool -> warm ramp, independent of our brand level colors
const ramp = ['#B0A79B', '#9DB0C9', '#7E9BD8', '#5C86E8', '#476BFF', '#2E4ED8']
</script>

<template>
  <div class="rows">
    <button
      v-for="(s, i) in sae"
      :key="s.n"
      class="lvl"
      :class="{ active: active === s.n }"
      :style="{ '--c': ramp[i] }"
      @click="pick(s.n)"
    >
      <span class="chip" :style="{ background: ramp[i] }">L{{ s.n }}</span>
      <span class="name">{{ s.name }}</span>
      <transition name="exp">
        <span v-if="active === s.n" class="detail">{{ s.car }}</span>
      </transition>
    </button>
  </div>
</template>

<style scoped>
.rows { display: flex; flex-direction: column; gap: 0.5rem; }
.lvl {
  display: grid;
  grid-template-columns: 3rem 15rem 1fr;
  align-items: center;
  gap: 1rem;
  text-align: left;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 12px;
  padding: 0.7rem 1rem;
  cursor: pointer;
  color: var(--ink);
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}
.lvl:hover { border-color: var(--c); }
.lvl.active { box-shadow: inset 0 0 0 2px var(--c); }
.chip { color: #fff; font-weight: 800; font-size: 0.85rem; padding: 3px 9px; border-radius: 999px; width: fit-content; }
.name { font-weight: 600; font-size: 1.15rem; }
.detail { color: var(--ink-dim); font-size: 1rem; }

.exp-enter-active, .exp-leave-active { transition: all 0.2s ease; }
.exp-enter-from, .exp-leave-to { opacity: 0; transform: translateX(-6px); }
</style>
