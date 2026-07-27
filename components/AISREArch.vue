<script setup lang="ts">
// The "common AI SRE architecture" as a clean, static diagram:
// inputs -> LLM (+ tools) -> output.
const inputs = ['Alerts', 'Human prompts', 'Events']
const tools = ['Observability', 'Live cluster', 'Cloud APIs', 'Git / CI-CD']
const outputs = ['A fix (PR)', 'Ranked hypotheses']
</script>

<template>
  <div class="flow">
    <div class="col">
      <div class="col-title">Triggers</div>
      <div v-for="i in inputs" :key="i" class="node">{{ i }}</div>
    </div>

    <div class="arrow">→</div>

    <div class="mid">
      <div class="node llm">LLM agent</div>
      <div class="tool-grid">
        <div v-for="t in tools" :key="t" class="node tool">{{ t }}</div>
      </div>
      <div class="tool-label">tools · mostly MCP</div>
    </div>

    <div class="arrow">→</div>

    <div class="col">
      <div class="col-title">Output</div>
      <div v-for="o in outputs" :key="o" class="node out">{{ o }}</div>
    </div>
  </div>
</template>

<style scoped>
.flow {
  display: grid;
  grid-template-columns: auto 2.5rem 1.4fr 2.5rem auto;
  gap: 0.6rem;
  align-items: center;
}
.col { display: flex; flex-direction: column; gap: 0.5rem; }
.col-title { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-dim); }
.mid { display: flex; flex-direction: column; gap: 0.5rem; align-items: stretch; }

.node {
  font-size: 0.95rem;
  padding: 0.5rem 0.8rem;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
}
.node.llm {
  font-size: 1.2rem; font-weight: 700; text-align: center;
  background: color-mix(in srgb, var(--sapphire) 16%, white);
  border-color: var(--sapphire);
  padding: 0.8rem;
}
.node.out { background: color-mix(in srgb, var(--mint) 26%, white); border-color: var(--mint); }
.tool-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.node.tool { font-size: 0.85rem; text-align: center; color: var(--ink-dim); }
.tool-label { font-size: 0.7rem; color: var(--ink-dim); text-align: center; letter-spacing: 0.04em; }

.arrow { display: flex; align-items: center; justify-content: center; font-size: 1.8rem; color: var(--ink-dim); }
</style>
