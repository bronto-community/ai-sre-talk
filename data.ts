// Single source of truth for the "Levels of Service Reliability Automation" model.
// Edit here and every interactive component (grid, ladders, self-driving strip) updates.

export interface Level {
  key: string
  short: string      // short label used in tight spaces
  name: string       // full name
  color: string      // Bronto ramp: neutral -> Sapphire -> Mint -> Lime
  ink: string        // readable text color for a chip filled with `color`
  aspirational?: boolean
}

// 0 -> 5, following the Bronto brand gradient (Electric Sapphire → Tropical Mint → Lemon Lime).
export const LEVELS: Level[] = [
  { key: 'manual',      short: 'L0', name: 'Manual',                  color: '#B0A79B', ink: '#2B2620' },
  { key: 'assisted',    short: 'L1', name: 'Assisted',                color: '#859EFF', ink: '#0A1B4D' },
  { key: 'linear',      short: 'L2', name: 'Linear Automation',       color: '#476BFF', ink: '#FFFFFF' },
  { key: 'conditional', short: 'L3', name: 'Conditional Automation',  color: '#53DFA9', ink: '#06281E' },
  { key: 'high',        short: 'L4', name: 'High Automation',         color: '#A6E05A', ink: '#2B3A08' },
  { key: 'autonomy',    short: 'L5', name: 'Full Autonomy',           color: '#CDE519', ink: '#3A3D08', aspirational: true },
]

// What technique you must ADD to climb from the previous level to this one.
export const TRANSITIONS: Record<string, string> = {
  assisted:    'Code — turn manual steps into software',
  linear:      'A trigger that calls your (linear) script',
  conditional: 'An "if" (or a chain of them) — branching',
  high:        'Sophisticated methods: probabilistic, ML, LLMs',
  autonomy:    'Trust: false judgment is rare and never fatal',
}

export interface Domain {
  key: string
  name: string
  // one cell description per level key
  cells: Record<string, string>
}

export const DOMAINS: Domain[] = [
  {
    key: 'instrumentation',
    name: 'Instrumentation',
    cells: {
      manual:      'Add SDKs & spans into the code yourself.',
      assisted:    'Code completion suggests instrumentation.',
      linear:      'Instrumentation libraries do the wiring.',
      conditional: 'Auto-instrumentation, injectors, runtime re-instrumentation.',
      high:        'Instrumentation LLMs decide what to capture.',
      autonomy:    'System decides at build & runtime what it needs. (????)',
    },
  },
  {
    // deliberately unmapped for now
    key: 'reliable-code',
    name: 'Reliable Code',
    cells: {},
  },
  {
    key: 'resource-mgmt',
    name: 'Resource Management',
    cells: {
      manual:      'You add more instances by hand.',
      assisted:    'A one-shot script scales when you run it.',
      linear:      'High load adds an instance, low load takes one away.',
      conditional: 'Add instances proportionally to the load.',
      high:        'ML picks scale from load, errors, latency, seasonality; asks if implausible.',
      autonomy:    'Decides when & how to scale, sound even in corner cases.',
    },
  },
  {
    // deliberately unmapped for now
    key: 'capacity-planning',
    name: 'Capacity Planning',
    cells: {},
  },
  {
    // signals there are many more domains than we can fit
    key: 'more',
    name: '…',
    cells: {},
  },
  {
    // Prevention sits directly above Response so the "AI SRE" claim box can
    // expand from one into the other across adjacent rows.
    key: 'incident-prevention',
    name: 'Incident Prevention',
    cells: {
      manual:      'Humans spot risks in review & retros.',
      assisted:    'Scripts surface known bad patterns on demand.',
      linear:      'Alerts on precursor thresholds fire runbooks.',
      conditional: 'If precursor conditions match, it mitigates by itself.',
      high:        'Models spot anomalies and precursors early.',
      autonomy:    'Prevents incidents before they surface.',
    },
  },
  {
    key: 'incident-response',
    name: 'Incident Response',
    cells: {
      manual:      'No alerting — human finds it, digs, fixes it all.',
      assisted:    'No alerting — scripts help understand & maybe fix.',
      linear:      'Alerting wakes a human, who runs a basic script.',
      conditional: 'Alerting fires; if conditions match it remediates itself.',
      high:        'LLMs & friends triage; often fix, often send a hypothesis to a human.',
      autonomy:    'Self-healing: addresses issues & precursors automatically.',
    },
  },
]
