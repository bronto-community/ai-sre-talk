<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { LEVELS, DOMAINS } from '../data'

const props = defineProps<{ claim?: boolean }>()

const selected = ref<{ domain: string; level: string } | null>(null)
const hasContent = (dk: string, lk: string) => !!DOMAINS.find(d => d.key === dk)?.cells[lk]

function select(domainKey: string, levelKey: string) {
  if (!hasContent(domainKey, levelKey)) return
  if (selected.value?.domain === domainKey && selected.value?.level === levelKey) selected.value = null
  else selected.value = { domain: domainKey, level: levelKey }
}

const detail = computed(() => {
  if (!selected.value) return null
  const d = DOMAINS.find(x => x.key === selected.value!.domain)!
  const l = LEVELS.find(x => x.key === selected.value!.level)!
  return { domain: d, level: l, text: d.cells[l.key] }
})

// ── "AI SRE" claim box ────────────────────────────────────────────────
const matrixEl = ref<HTMLElement | null>(null)
const expanded = ref(false)
const box = ref<{ left: number; top: number; width: number; height: number } | null>(null)

function cellRect(dk: string, lk: string) {
  return matrixEl.value?.querySelector(`[data-key="${dk}__${lk}"]`)?.getBoundingClientRect()
}
function measure() {
  if (!props.claim || !matrixEl.value) return
  const base = matrixEl.value.getBoundingClientRect()
  const l3 = cellRect('incident-response', 'conditional')
  const l5 = cellRect('incident-response', 'autonomy')
  if (!l3 || !l5 || !base.width) return
  // Slidev scales the slide via transform; convert screen-space deltas to local px.
  const s = base.width / matrixEl.value.offsetWidth || 1
  const left = (l3.left - base.left) / s
  const right = (l5.left - base.left + l5.width / 2) / s   // only half into L5
  const bottom = (l3.bottom - base.top) / s
  let top = (l3.top - base.top) / s
  if (expanded.value) {
    const prev = cellRect('incident-prevention', 'conditional')
    if (prev) top = (prev.top - base.top) / s
  }
  box.value = { left, top, width: right - left, height: bottom - top }
}

let ro: ResizeObserver
onMounted(() => {
  nextTick(measure)
  ro = new ResizeObserver(() => measure())
  if (matrixEl.value) ro.observe(matrixEl.value)
})
onUnmounted(() => ro?.disconnect())
watch(expanded, () => nextTick(measure))
</script>

<template>
  <div class="grid-wrap">
    <div ref="matrixEl" class="matrix">
      <!-- header row -->
      <div class="corner" />
      <div v-for="l in LEVELS" :key="l.key" class="col-head">
        <span class="lvl-chip" :style="{ background: l.color, color: l.ink }">{{ l.short }}</span>
        <span class="lvl-name" :class="{ aspir: l.aspirational }">{{ l.name }}</span>
      </div>

      <!-- domain rows -->
      <template v-for="d in DOMAINS" :key="d.key">
        <div class="row-head" :class="{ muted: d.key === 'more' }">{{ d.name }}</div>
        <button
          v-for="l in LEVELS"
          :key="d.key + l.key"
          class="cell"
          :class="{
            unset: !hasContent(d.key, l.key),
            active: selected?.domain === d.key && selected?.level === l.key,
          }"
          :data-key="d.key + '__' + l.key"
          :style="{ '--c': l.color }"
          @click="select(d.key, l.key)"
        >
          <span v-if="hasContent(d.key, l.key)" class="dot" />
        </button>
      </template>

      <!-- the "AI SRE" claim box -->
      <div
        v-if="props.claim && box"
        class="claim-box"
        :class="{ expanded }"
        :style="{ left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px' }"
      >
        <!-- The tag hangs off the box's BOTTOM edge. Incident Response is the last
             row, so that edge sits below the matrix — clear of every cell — and it
             doesn't move when the box expands upward. The box itself is click-through. -->
        <button class="cb-tag" @click="expanded = !expanded">
          <span class="cb-label">“AI SRE”</span>
          <span class="cb-hint">{{ expanded ? '↑ …now prevention too' : 'click to expand ↑' }}</span>
        </button>
      </div>
    </div>

    <!-- detail panel -->
    <transition name="fade" mode="out-in">
      <div v-if="detail" key="detail" class="detail">
        <div class="detail-head">
          <span class="pill" :style="{ background: detail.level.color, color: detail.level.ink }">{{ detail.level.name }}</span>
          <span class="detail-domain">{{ detail.domain.name }}</span>
        </div>
        <p class="detail-text">{{ detail.text }}</p>
      </div>
      <div v-else key="hint" class="detail hint">
        <p>Click any cell to see what that <b>Level × Domain</b> looks like.
          <template v-if="props.claim">The dashed box is where the market usually claims <b>“AI SRE”</b> lives — click it.</template>
        </p>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* gap leaves room for the claim tag hanging below the matrix */
.grid-wrap { display: flex; flex-direction: column; gap: 1.6rem; width: 100%; }

.matrix {
  position: relative;
  display: grid;
  grid-template-columns: minmax(9rem, 1.1fr) repeat(6, 1fr);
  gap: 5px;
  align-items: stretch;
}

.col-head { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; padding-bottom: 4px; }
.lvl-chip { font-weight: 800; font-size: 0.8rem; padding: 1px 8px; border-radius: 999px; }
.lvl-name { font-size: 0.66rem; line-height: 1.05; color: var(--ink-dim); }
.lvl-name.aspir { font-style: italic; }

.row-head { display: flex; align-items: center; font-size: 0.82rem; font-weight: 600; color: var(--ink); padding-right: 6px; }
.row-head.muted { color: var(--ink-dim); font-size: 1.1rem; }

.cell {
  position: relative;
  border: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--c) 14%, transparent);
  border-radius: 8px;
  min-height: 1.9rem;
  cursor: pointer;
  transition: transform 0.12s ease, background 0.15s ease, box-shadow 0.15s ease;
}
.cell:hover { transform: translateY(-2px); background: color-mix(in srgb, var(--c) 34%, transparent); }
.cell .dot { position: absolute; inset: 0; margin: auto; width: 10px; height: 10px; border-radius: 50%; background: var(--c); opacity: 0.9; }
.cell.active { background: color-mix(in srgb, var(--c) 55%, transparent); box-shadow: 0 0 0 2px var(--c); }

/* unset / not-yet-mapped cells */
.cell.unset {
  cursor: default;
  background: transparent;
  border-style: dashed;
  border-color: color-mix(in srgb, var(--ink-dim) 35%, transparent);
}
.cell.unset:hover { transform: none; background: transparent; }

.claim-box {
  position: absolute;
  border: 2px dashed var(--claim);
  background: color-mix(in srgb, var(--claim) 12%, transparent);
  border-radius: 12px;
  pointer-events: none;   /* cells underneath stay clickable */
  transition: top 0.35s cubic-bezier(.2,.8,.2,1), height 0.35s cubic-bezier(.2,.8,.2,1);
  z-index: 2;
}

.cb-tag {
  position: absolute;
  bottom: 0; left: 50%;
  transform: translate(-50%, 52%);
  pointer-events: auto;   /* …but the tag itself is the click target */
  cursor: pointer;
  display: flex; align-items: baseline; gap: 0.5rem; white-space: nowrap;
  padding: 1px 10px; border-radius: 999px;
  border: 1px dashed var(--claim);
  background: var(--bg);
  transition: background 0.15s ease;
}
.cb-tag:hover { background: var(--cream); }
.cb-label { font-family: 'Source Serif 4', Georgia, serif; font-weight: 600; font-size: 1rem; color: #9c2a10; }
.cb-hint { font-size: 0.68rem; color: var(--claim); font-weight: 600; }

.detail { border: 1px solid var(--panel-border); background: var(--panel); border-radius: 10px; padding: 0.55rem 0.9rem; min-height: 3rem; }
.detail.hint { color: var(--ink-dim); font-size: 0.85rem; }
.detail-head { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.detail-domain { font-weight: 700; }
.detail-text { margin: 0.45rem 0 0; font-size: 1rem; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
