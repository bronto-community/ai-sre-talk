<script setup lang="ts">
import { onMounted } from 'vue'
import { inject as injectAnalytics } from '@vercel/analytics'
import { injectSpeedInsights } from '@vercel/speed-insights'

/**
 * Vercel Web Analytics + Speed Insights.
 *
 * Slidev renders global-bottom.vue on every slide, so injecting once here covers
 * the whole deck. These feed the Vercel Drains (collection=vercel, dataset=ai-sre-talk).
 *
 * We use the framework-agnostic inject() functions rather than the Vue-component
 * variants on purpose: those import `useRoute` from vue-router, which Slidev keeps
 * as a private nested dependency — bundling the Vue components pulls in a second,
 * unresolvable vue-router copy and breaks the build. inject() needs no router; the
 * analytics beacon patches history navigation, so per-slide views are still tracked.
 *
 * mode 'auto' logs to the console in dev (slidev --open) and only sends beacons on
 * the deployed site, so local runs never emit data.
 */
onMounted(() => {
  injectAnalytics({ mode: 'auto' })
  injectSpeedInsights()
})
</script>

<template>
  <!-- no visible output; both SDKs inject their own beacon scripts -->
</template>
