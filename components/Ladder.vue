<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { LEVELS, DOMAINS, TRANSITIONS } from '../data'

// Show one domain as a ladder you climb one step at a time.
const props = defineProps<{ domain: string }>()

const domain = computed(() => DOMAINS.find(d => d.key === props.domain)!)

// how many rungs are revealed (0 = none, LEVELS.length = all)
const shown = ref(1)
const listEl = ref<HTMLElement | null>(null)

// Keep the newest rung in view — the list scrolls inside a fixed-height box,
// so it never overflows the slide on any projector resolution.
watch(shown, async () => {
  await nextTick()
  listEl.value?.querySelector('.rung.latest')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
})

const canUp = computed(() => shown.value < LEVELS.length)
const canDown = computed(() => shown.value > 1)
function up() { if (canUp.value) shown.value++ }
function down() { if (canDown.value) shown.value-- }
function all() { shown.value = LEVELS.length }
function reset() { shown.value = 1 }
</script>

<template>
  <div class="ladder">
    <div class="controls">
      <span class="dom-name">{{ domain.name }}</span>
      <div class="btns">
        <button @click="reset" title="reset">⟲</button>
        <button :disabled="!canDown" @click="down">▼</button>
        <button :disabled="!canUp" @click="up">▲</button>
        <button @click="all" title="reveal all">↥</button>
      </div>
    </div>

    <ol ref="listEl" class="rungs">
      <transition-group name="rise">
        <li
          v-for="(l, i) in LEVELS"
          v-show="i < shown"
          :key="l.key"
          class="rung"
          :class="{ latest: i === shown - 1, aspir: l.aspirational }"
          :style="{ '--c': l.color }"
        >
          <div class="rail" />
          <div class="marker"><span class="chip" :style="{ background: l.color, color: l.ink }">{{ l.short }}</span></div>
          <div class="body">
            <div class="lvl">{{ l.name }}</div>
            <div class="what">{{ domain.cells[l.key] }}</div>
            <div v-if="TRANSITIONS[l.key]" class="need">
              <span class="need-label">+ needs</span> {{ TRANSITIONS[l.key] }}
            </div>
          </div>
        </li>
      </transition-group>
    </ol>
  </div>
</template>

<style scoped>
.ladder { width: 100%; }
.controls {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 0.6rem;
}
.dom-name { font-weight: 700; font-size: 1.1rem; }
.btns { display: flex; gap: 4px; }
.btns button {
  border: 1px solid var(--panel-border);
  background: var(--panel);
  color: var(--ink);
  border-radius: 6px;
  width: 2rem; height: 1.9rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.12s ease;
}
.btns button:hover:not(:disabled) { background: rgba(148,163,184,0.25); }
.btns button:disabled { opacity: 0.3; cursor: default; }

.rungs {
  list-style: none; margin: 0; padding: 0 0.2rem;
  /* column-reverse so L0 sits at the bottom and each new level appears ABOVE it —
     you climb the ladder upward, matching the ▲ control. Fixed height (not max-)
     keeps the stack anchored to the bottom instead of drifting as rungs appear. */
  /* in column-reverse the main axis starts at the BOTTOM, so flex-start anchors
     the stack there: L0 never moves, each new rung fills the space above it */
  display: flex; flex-direction: column-reverse; justify-content: flex-start;
  gap: 0.45rem;
  height: 370px; overflow-y: auto;
  scrollbar-width: none;                 /* hide scrollbar (Firefox) */
  scroll-padding-block: 0.5rem;
}
.rungs::-webkit-scrollbar { display: none; }  /* hide scrollbar (WebKit) */
.rung {
  position: relative;
  display: grid;
  grid-template-columns: 2.4rem 1fr;
  gap: 0.6rem;
  padding: 0.5rem 0.7rem 0.5rem 0;
  border-radius: 10px;
  align-items: start;
}
.rung.latest {
  background: color-mix(in srgb, var(--c) 12%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 55%, transparent);
}
.rail {
  position: absolute;
  left: 1.15rem; top: -0.5rem; bottom: -0.5rem;
  width: 2px;
  background: color-mix(in srgb, var(--c) 45%, transparent);
}
.marker { display: flex; justify-content: center; padding-top: 0.1rem; z-index: 1; }
.chip {
  color: #0b1220; font-weight: 800; font-size: 0.8rem;
  padding: 2px 7px; border-radius: 999px;
}
.lvl { font-weight: 700; font-size: 1rem; }
.rung.aspir .lvl { font-style: italic; }
.what { font-size: 0.92rem; color: var(--ink); opacity: 0.95; }
.need { font-size: 0.8rem; color: var(--ink-dim); margin-top: 0.15rem; }
.need-label {
  color: var(--accent); font-weight: 700; letter-spacing: 0.02em;
}

.rise-enter-active { transition: all 0.28s cubic-bezier(.2,.8,.2,1); }
.rise-enter-from { opacity: 0; transform: translateY(10px); }
</style>
