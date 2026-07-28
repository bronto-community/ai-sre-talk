---
theme: default
title: Reliability from Manual to Autopilot
info: |
  ## Reliability from Manual to Autopilot
  Levels of Service Reliability Automation. Reflects the current state of a CNCF white paper draft.
colorSchema: light
transition: slide-left
mdc: true
class: text-left
favicon: /img/bronto-dino.png
fonts:
  sans: Radio Canada Big
  serif: Source Serif 4
  mono: Geist Mono
  # Bronto brand fonts, fetched from Google Fonts by Slidev
---

<div class="title-hero">
  <img src="/img/confetti-left.png" class="confetti c-left" />
  <img src="/img/confetti-right.png" class="confetti c-right" />

# Reliability:<br>Manual → Autopilot

</div>

<div class="subtitle">Levels of Service Reliability Automation</div>

<a href="https://bronto.io" target="_blank" rel="noopener" class="abs-bl m-10 brand-logo-link">
  <img src="/img/bronto-logo.webp" class="brand-logo" />
</a>

<style>
.title-hero { position: relative; display: inline-block; }
.title-hero h1 { font-size: 4.6rem; line-height: 1.02; }
.subtitle { margin-top: 1.6rem; font-size: 1.3rem; color: var(--ink-dim); }
.confetti { position: absolute; width: 118px; height: auto; pointer-events: none; }
.c-left { top: -78px; left: -18px; }
.c-right { top: 30%; right: -158px; transform: translateY(-50%); }
.brand-logo-link { display: inline-block; line-height: 0; transition: opacity 0.15s ease; }
.brand-logo-link:hover { opacity: 0.7; }
.brand-logo { width: 150px; height: auto; }
</style>

<!--
My point of view right now; the paper is still evolving, mistakes are mine.
Not here to trash "AI SRE" — cautious optimist.
-->

---
layout: center
---

<SectionCard
  kicker="Part one"
  title="Setting the scene"
  art="/img/dino-blocks.png"
>
  <div class="sc-list">
    <span>What people mean by "AI SRE"</span>
    <span>Why that's a narrow slice</span>
    <span>What self-driving cars are actually made of</span>
  </div>
</SectionCard>

---
clicks: 5
---

# What people mean by "AI SRE"

<AISREArchSketch :stage="$clicks" class="mt-2" />

<div v-click="5" class="arch-verdict">An agentic loop for incident response.</div>

<style>
.arch-verdict {
  margin-top: 0.6rem; text-align: center;
  font-family: 'Source Serif 4', Georgia, serif; font-size: 1.6rem; color: var(--sapphire);
}
</style>

<!--
Inputs on the left, the LLM in the middle, tools (mostly MCP) underneath,
and ideally a fix (a PR) on the right. That's a fine picture. But it's narrow.
-->

---
layout: center
class: text-center
---

<div class="but">That's a narrow slice.</div>

<div class="claims">
  <div class="claim-row">
    <span class="narrow">SRE = incident response</span>
    <span class="arrow">is really</span>
    <span class="broad">a whole engineering discipline</span>
  </div>
  <div class="claim-row">
    <span class="narrow">AI = the LLM</span>
    <span class="arrow">is really</span>
    <span class="broad">one tool among many</span>
  </div>
</div>

<style>
.but { font-family: 'Source Serif 4', Georgia, serif; font-size: 2.4rem; margin-bottom: 2.5rem; }
.claims { display: flex; flex-direction: column; gap: 1.6rem; align-items: center; }
.claim-row { display: flex; align-items: center; gap: 1.4rem; font-size: 1.5rem; }
.narrow { color: var(--ink-dim); text-decoration: line-through; text-decoration-color: var(--claim); }
.arrow { font-size: 0.95rem; color: var(--ink-dim); font-style: italic; }
.broad { color: var(--sapphire); font-weight: 700; }
</style>

<!--
Two independent over-simplifications. The talk widens both axes.
-->

---
layout: center
class: text-center
---

<div class="name-slide">
  <div class="row">
    <span class="phrase struck">"AI SRE"</span>
    <span class="note">sounds like replacing the people</span>
  </div>
  <div class="down">↓</div>
  <div class="row">
    <span class="phrase keep">AI <em>for</em> SRE</span>
    <span class="note">tools that support the discipline</span>
  </div>
</div>

<style>
.name-slide { display: flex; flex-direction: column; align-items: center; gap: 1.2rem; }
.name-slide .row { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
.name-slide .phrase { font-family: 'Source Serif 4', Georgia, serif; font-size: 2.8rem; color: var(--ink-dim); }
.name-slide .phrase.struck { text-decoration: line-through; text-decoration-color: var(--claim); text-decoration-thickness: 2px; }
.name-slide .phrase.keep { color: var(--sapphire); }
.name-slide .note { font-family: 'Radio Canada Big', sans-serif; font-size: 1rem; color: var(--ink-dim); }
.name-slide .down { font-size: 1.8rem; color: var(--ink-dim); }
</style>

<!--
Not the right term, but it's what the room knows. Not being pedantic — just precise.
(I'll still say "AI SRE" — say this out loud.)
-->

---

<h1 class="drive-title">Who's driving?</h1>

<DriveTheCar class="mt-2" />

<style>
.drive-title { font-size: 2.4rem; }
</style>

<!--
Pick "Human" — let someone from the audience turn the wheel and get from A to B.
Then pick "LLM": it takes the first bends fine, then holds its heading through the
next one and leaves the road. Frogs crossing to the pond; run one over and it stays
squashed. Point: control is earned, not assumed — and the failure is the interesting part.
-->

---
clicks: 8
---

# A self-driving car is built from many pieces

<div class="blocks">
  <div class="grp">
    <div class="grp-tag" style="--g:var(--ink-dim)">Not AI</div>
    <div v-click class="chip">Automatic gearbox</div>
    <div v-click class="chip">Rain sensor</div>
    <div v-click class="chip">Anti-lock brakes</div>
  </div>
  <div class="grp">
    <div class="grp-tag" style="--g:var(--mint)">AI</div>
    <div v-click class="chip">Adaptive cruise</div>
    <div v-click class="chip">Lane keeping</div>
    <div v-click class="chip">Self-parking</div>
  </div>
</div>

<div v-click class="closer">Autonomous driving is a thought-out combination of different kinds of automations, AI is only one of them.</div>

<VanDrive
  :go="$clicks >= 8"
  :forward="$slidev.nav.clicksDirection > 0"
  @done="$slidev.nav.next()"
/>

<style>
.blocks { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-top: 2rem; max-width: 42rem; }
.grp { display: flex; flex-direction: column; gap: 0.7rem; }
.grp-tag {
  font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--g); padding-bottom: 0.3rem; border-bottom: 2px solid var(--g);
}
.chip {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; padding: 0.7rem 0.9rem; font-size: 1.1rem; font-weight: 600;
}
.closer { margin-top: 2.2rem; font-size: 1.4rem; font-family: 'Source Serif 4', Georgia, serif; max-width: 46rem; line-height: 1.35; }
</style>

<!--
The examples: gearbox and rain sensor need no AI; lane-keep/self-park are ML, not LLMs.
Point: don't reach for an LLM where a control loop or a bit of ML will do.
-->

---
layout: center
class: text-center
---

<!-- the van drives through first; the card lands once it's clear -->
<RevealAfter :delay="2250">
  <div class="cta">
    <img src="/img/dino-blocks.png" class="cta-dino" />
    <div class="cta-body">
      <div class="cta-kicker">An early ask</div>
      <h2 class="cta-title">Shape the CNCF white&nbsp;paper</h2>
      <p class="cta-sub">This talk reflects a paper we're actively writing. Contributors very welcome.</p>
      <a class="cta-link" href="https://github.com/cncf/toc/issues/1984" target="_blank">
        github.com/cncf/toc/issues/1984
      </a>
    </div>
  </div>
</RevealAfter>

<VanDrive mode="through" />

<style>
.cta {
  display: flex; align-items: center; gap: 2.5rem;
  border: 1px solid var(--border); background: var(--surface);
  border-radius: 18px; padding: 2rem 2.5rem; max-width: 46rem; margin: 0 auto;
  box-shadow: 0 20px 50px -30px rgba(43,38,32,0.4);
}
.cta-dino { width: 150px; height: auto; flex-shrink: 0; }
.cta-body { text-align: left; }
.cta-kicker { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--sapphire); }
.cta-title { font-family: 'Source Serif 4', Georgia, serif; font-size: 2rem; margin: 0.3rem 0 0.5rem; }
.cta-sub { color: var(--ink-dim); margin: 0 0 1rem; }
.cta-link {
  display: inline-flex; align-items: center; gap: 0.5rem;
  font-family: 'Geist Mono', monospace; font-size: 1rem;
  background: var(--sapphire); color: #fff; text-decoration: none;
  padding: 0.55rem 1rem; border-radius: 10px;
}
.cta-link::before { content: '→'; }
</style>

---
layout: center
---

<SectionCard
  kicker="Part two"
  title="Levels of Service Reliability Automation"
  art="/img/dino-space.png"
>
  <LevelChips />
</SectionCard>

---
clicks: 6
---

# The levels — and what moves you up one

<LevelsFlow :stage="$clicks" class="mt-10" />

<div v-click="6" class="mt-6 draft-note">
Each step up <b>adds a technique</b> — and adds complexity. It's about reaching the <b>necessary</b> level, not always the top.
</div>

<!--
Manual→Linear is often easy. Going to Conditional can already get MUCH more complicated.
Full Autonomy (dashed) is aspirational — you won't always need it.
-->

---
layout: full
---

# The map: Levels × Domains

<div class="px-8 pb-4">
  <LevelsGrid :claim="true" />
</div>

<!--
Hero slide. Click cells for detail. The dashed box = where the market claims "AI SRE" sits
(Incident Response, ~L3 through L4, halfway into L5). Click it to expand into Prevention —
some vendors are gladly moving that way. Empty rows (Reliable Code, Capacity Planning, …) are
deliberately unset.
-->

---
layout: center
---

<SectionCard
  kicker="Part three"
  title="Examples"
  art="/img/dino-scientist.png"
>
  <div class="sc-list">
    <span>Scaling a service</span>
    <span>Instrumentation</span>
    <span>Incidents</span>
  </div>
</SectionCard>

---
clicks: 5
---

# Example: Scaling a service

<ScaleTheService :stage="$clicks" class="mt-2" />

<!--
Arrows change LEVEL. Each level waits for Start, then runs the same 25s —
rehearse against it. The load ahead is NOT drawn: the room can't read the
spike coming, which is what makes watching someone play L0 worth anything.

Overload queues before it fails: the lower strip is latency. It crosses the
0.3s objective (amber) long before anything is dropped at the 2.5s timeout.
"Slow" and "down" are different failures — only L0/L1 ever reach "down".

Blue triangles are the trigger firing — mind the gap between the load moving
and the system reacting. It's a control loop, not a reflex. Amber triangles
are guardrail trips. The dashed amber lines are the min/max fleet bounds.

L0  click +1/-1 while talking. You WILL fall behind. ~13,250 dropped.
L1  one click, right size — the script sizes it, you still have to notice.
L2  a fixed step cannot climb a steep ramp: it needs +9 instances in 2s and
    adds one per second, still under water ten seconds later. The ONLY
    automated level that loses requests: ~400 dropped, and the most waste.
L3  jumps straight to the right size, so it loses nothing. But its precision
    leaves no slack — the collapse at t~17 fools it into giving capacity away
    and the rebound catches it: 1.65s peak, worst of the levels that stay dry.
    More sophistication, a NEW failure mode.
L4  scales on latency, not just arrivals, so it drains the backlog L3 can't
    see: 0.72s peak. But the model runs away in BOTH directions — it wants 20
    instances up the ramp (ceiling holds it at 18) and ZERO at the cliff
    (floor holds it at 2). Four alerts. It doesn't fail, it gets contained,
    and someone now owns a page. That's the real cost of L4: attention.
L5  same model, plus the judgment not to act on it: leads a ramp, never a
    fall, and stops trusting the slope once it spots the anomaly. Never trips
    a guardrail, never pages anyone, best latency (0.24s), least waste.

The guardrail is the point. You don't hand a confident model the throttle;
you bound it and get told when it hits the bound. L5 is what it takes to not
need the bound.
-->

---
clicks: 5
---

# Example: Instrumentation

<Ladder domain="instrumentation" :stage="$clicks" class="mt-2" />

<!--
Observability is part of good SRE practice. Note how far you get with zero LLMs (up to L3).
-->

---
clicks: 5
---

# Example: Incidents (prevention + response)

<Ladder domain="incident-response" :stage="$clicks" class="mt-2" />

<!--
This is the corner everyone markets. L4 is where most real products actually sit:
often fixes it, often hands a hypothesis to a human. L5 — self-healing — is the aspiration.
-->

---
layout: center
class: text-left
---

# Three things to take away

<div class="takeaways">
  <div v-click class="ta"><span class="n">1</span><span>It's <b>automation</b>, not a replacement — and it's <b>Levels × Domains</b>.</span></div>
  <div v-click class="ta"><span class="n">2</span><span>Every level up removes work but <b>adds complexity</b>. Reach the level you need.</span></div>
  <div v-click class="ta"><span class="n">3</span><span>Full autonomy is still <b>to be done</b>.</span></div>
</div>

<div v-click class="mt-10 p-4 rounded-xl border border-[#476BFF]/50 bg-[#476BFF]/8 text-xl">
<b>Join the CNCF white paper</b> — we're looking for contributors.
</div>

<style>
.takeaways { display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem; }
.ta { display: flex; align-items: baseline; gap: 1rem; font-size: 1.4rem; }
.ta .n {
  font-family: 'Source Serif 4', Georgia, serif; font-size: 1.6rem; font-weight: 700;
  color: var(--sapphire); min-width: 1.5rem;
}
</style>

---
layout: center
class: text-center
---

<div class="thanks">
  <div class="thanks-left">
    <h1 class="thanks-title">Thank you</h1>
    <div class="thanks-mail">severin@bronto.io</div>
  </div>

  <ThanksBronto>Where does <em>your</em> team sit on the map?</ThanksBronto>
</div>

<style>
.thanks {
  display: flex; align-items: center; justify-content: center; gap: 3.5rem;
  text-align: left;
}
.thanks-title { font-size: 4rem; line-height: 1.05; }
.thanks-mail {
  margin-top: 1.2rem; font-family: 'Geist Mono', monospace;
  font-size: 1.05rem; color: var(--ink-dim);
}
.thanks em { font-style: italic; color: var(--sapphire); }
</style>

<!--
Leave the map on screen for Q&A if you can — great anchor for discussion.
-->
