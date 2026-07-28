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
/>

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
clicks: 10
---

# A self-driving car is built from many pieces

<div class="blocks">
  <div class="grp">
    <div class="grp-tag" style="--g:var(--ink-dim)">Not AI</div>
    <div v-click class="chip">Automatic gearbox</div>
    <div v-click class="chip">Rain sensor</div>
    <div v-click class="chip">Anti-lock brakes</div>
    <div v-click class="chip">Door handles</div>
  </div>
  <div class="grp">
    <div class="grp-tag" style="--g:var(--mint)">AI</div>
    <div v-click class="chip">Adaptive cruise</div>
    <div v-click class="chip">Lane keeping</div>
    <div v-click class="chip">Self-parking</div>
    <div v-click class="chip">Traffic-sign reading</div>
  </div>
</div>

<div v-click class="closer">Autonomous driving is a thought-out combination of different kinds of automations, AI is only one of them.</div>

<VanDrive
  :go="$clicks >= 10"
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
/* stays clear of the van parked bottom-right */
.closer { margin-top: 1.8rem; font-size: 1.4rem; font-family: 'Source Serif 4', Georgia, serif; max-width: 38rem; line-height: 1.35; }
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
Each step up <b>adds a technique</b> and adds complexity. It's about reaching the <b>necessary</b> level, not always the top.
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
/>

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
---

<div class="outcome">
  <h1 class="outcome-head">Reliability is still<br>an engineering job.</h1>

  <div class="ev">
    <div v-click class="ev-card">
      <div class="i-lucide-hard-hat ev-icon" />
      <b>It isn't replacing you</b>
      <span>An AI SRE is a tool. Not a replacement for the person, and not for the discipline.</span>
    </div>
    <div v-click class="ev-card">
      <div class="i-lucide-map ev-icon" />
      <b>The map is an instrument</b>
      <span>Pick the level each domain actually needs, not one agent for all of it.</span>
    </div>
    <div v-click class="ev-card">
      <div class="i-lucide-door-open ev-icon" />
      <b>Sometimes the right call is not to automate</b>
      <span>Nobody needs an AI door handle, and an automated one fails in ways the manual one can't.</span>
    </div>
  </div>
</div>

<style>
.outcome { max-width: 58rem; }
.outcome-head {
  font-size: 2.9rem; line-height: 1.08; margin-bottom: 2.2rem;
}
.ev { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.1rem; }
.ev-card {
  display: flex; flex-direction: column; gap: 0.5rem;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 14px; padding: 1.1rem 1.15rem;
}
.ev-icon { font-size: 1.5rem; color: var(--sapphire); }
.ev-card b { font-size: 1.05rem; line-height: 1.25; }
.ev-card span { font-size: 0.9rem; color: var(--ink-dim); line-height: 1.4; }
</style>

<!--
This is the payoff of Parts two and three. The map is the instrument you take
home; the levels cost you a new failure mode each time; and the door is the one
they'll remember — automating it is both pointless and worse than the manual part.

On the door: say "reported concerns" / "regulators have started looking at it".
Don't name a manufacturer, and don't claim there's no manual release — there
usually is. Overstate it and someone in the room will take the point off you.
-->

---
layout: center
---

<div class="recall">
  <div class="recall-art"><AgentShape /></div>

  <div class="recall-body">
    <h2 class="recall-head">So, about that&nbsp;"AI&nbsp;SRE"</h2>
    <div class="sc-list recall-list">
      <span>It's <b>just another agent</b>. Input, agent, tools, output.</span>
      <span>Which makes it the oldest decision there is: <b>buy it, or build it</b>.</span>
      <span>It stays <b>one tool among many</b>. The name will stick, probably.</span>
    </div>
  </div>
</div>

<style>
.recall { display: flex; align-items: center; justify-content: center; gap: 2.4rem; }
/* the opening architecture, stripped back to the shape everyone already knows */
.recall-art { width: 430px; flex-shrink: 0; }
.recall-head { font-size: 2.1rem; margin-bottom: 1.3rem; }
.recall-body { max-width: 26rem; }
.recall-list span { font-size: 1.05rem; color: var(--ink); }
.recall-list b { color: var(--sapphire); }
</style>

<!--
Circle back to slide three, with the detail stripped away. Nothing exotic here:
inputs go in, an agent calls tools, something comes out. That is every agent
anyone has shipped this year, which is exactly the point. So the question isn't
"is this magic", it's the boring old one: do we buy this or build it?

The name is not going anywhere, and that's fine. Argue about the thing, not the label.
-->

---
layout: center
---

<div class="wp">
  <div class="wp-kicker">Call to action</div>
  <h1 class="wp-head">Help us write the framework</h1>

  <div class="sc-list wp-list">
    <span>
      It runs in the open, under <b>CNCF TAG Operational Resilience</b>.
    </span>
    <span>
      The point is a <b>shared vocabulary</b>. One ladder everyone can point at, so teams
      can place themselves and see the next step, instead of every vendor inventing
      their own.
    </span>
    <span>
      We need <b>domain examples and review</b>. Bring the corner of reliability you
      know better than we do, and it goes in the paper.
    </span>
  </div>

  <a class="wp-url" href="https://github.com/cncf/toc/issues/1984" target="_blank" rel="noopener">
    github.com/cncf/toc/issues/1984
  </a>
</div>

<style>
.wp { max-width: 46rem; }
.wp-kicker {
  font-family: 'Geist Mono', monospace; font-size: 0.85rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.16em; color: var(--sapphire);
}
.wp-head { font-size: 2.7rem; margin: 0.6rem 0 1.8rem; }
.wp-list span { font-size: 1.05rem; line-height: 1.45; }
.wp-list b { color: var(--ink); }
.wp-url {
  display: inline-block; margin-top: 1.9rem;
  font-family: 'Geist Mono', monospace; font-size: 1.05rem;
}
</style>

<!--
Why this paper and not another blog post: it's vendor-neutral ground. The whole
argument of this talk falls apart if every vendor keeps shipping its own ladder,
so the deliverable is the common language, not a tool.

Ask for the thing you actually want: someone who owns capacity planning, or
release management, to write the row they know. Those rows are empty on the map
because nobody in the group does that job daily.
-->

---
layout: center
class: text-center
---

<div class="thanks">
  <div class="thanks-left">
    <h1 class="thanks-title">Thank you</h1>
    <div class="thanks-mail">severin@bronto.io</div>
    <div class="thanks-links">
      <div class="tl">
        <span class="tl-label">White paper</span>
        <a class="tl-url" href="https://github.com/cncf/toc/issues/1984" target="_blank" rel="noopener">github.com/cncf/toc/issues/1984</a>
      </div>
      <div class="tl">
        <span class="tl-label">Try Bronto</span>
        <a class="tl-url" href="https://app.eu.bronto.io/signup" target="_blank" rel="noopener">app.eu.bronto.io/signup</a>
      </div>
    </div>
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
.thanks-links { display: flex; flex-direction: column; gap: 0.7rem; margin-top: 1.8rem; }
.tl { display: flex; flex-direction: column; gap: 0.1rem; }
.tl-label {
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--ink-dim);
}
.thanks em { font-style: italic; color: var(--sapphire); }
</style>

<!--
Leave the map on screen for Q&A if you can — great anchor for discussion.
-->
