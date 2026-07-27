# Teaser (Setting the Scence)

What is commonly understood when we talk about an "AI SRE"? A LLM-powered agent, that aims to automatically resolve incidents when they happen.
Common architecture:

left: inputs/triggers (alerts, human prompts, certain events)
middle top: the "LLM piece"
middle bottom: the tools (mostly MCP servers to Observability and any other kind of "source of truth", live (read-only access) to cluster, Cloud Provider APIs, Software Repository (GitHub, GitLab, etc.), CI/CD, etc.etc.etc)
right: output, ideally a "fix" (in form of a PR), often a list of hypotheses with confidence score, some of them being "recommended" 

That's all great, but...

SRE is more than "incident response", it's a whole Engineering Discipline
AI is more than "LLM", LLMs have their known issues, they are just a tool, there are other AIs&MLs and other automation. 

Analogy: A self driving car, we wouldn't just put a LLM in the driver seat and say "go for it"

A "self driving car" is the culmination of many building blocks, there's 
- the "Levels" by SAE, that go from "manual" to "assisted" to different levels of automation up to "full automation"
- lots of pieces that have to work togeter, many don't need "AI" to reach sufficient levels of automation (automatic vs manual shifting, rain sensor), and not necesarily a LLM (other ways of "AI")

We can use this as a blue print for "AI SRE", although

- AI SRE is marketing, The term suggests the replacements of Humans (SRE role), instead of supporting the discipline (SRE) with tools.
- I prefer "AI for SRE", or "Levels of Service Reliability Automation", the latter focuses on the task/goal, leaves out the "AI buzz"

Note: I use and will use "AI SRE" because it is the established "category", like "Observability" in the marketing sense describes certain vendors. I don't think it's the right term, but you need to chose your battles.

Note 2: This is not about sh*tting on AI SREs, or saying that we will never have a world where all of that is fully autonomous. How would I know that? I actually would be curious to see this happen (not sure if I find it good...), so I am a cautious optimist here.

# Early CTA

This presentation is reflecting the current state of a white paper we are working on within CNCF! We are constantly looking for contributors.
Note, that nevertheless this presentation is "my point of view right now", the paper is evolving, not yet finished, so mistakes are mine;)

# Levels Of Service Reliability Automation

Inspired by the levels for self-driving cars, we try to give you a map that you can use to put yourself on to see where you stand, equally open source projects and vendors can use it to see where they sit to unlock
new levels. 

## Levels (as of today), left-to-right:
* Manual: Human does everything
* Assisted: Human uses software for basic and repetitive tasks. Manual triggers for that.
* Linear Automation: An event triggers a script that only has one path 
* Conditional Automation: An event triggers a script that may branch based on conditions
* High Automation: An event triggers a complex automation (dynamic/probabilistic methods, LLMs, etc.), this system may be almost autonomous, but there are lots of cases, where the human is looped in (i.e. no hypothesis has enough confidence, or system needs to ask for permissions to do certain tasks, as we do not trust it to do it without failure
* Full Autonomy: The system acts fully autonomously, everything is setup in a way that no human is needed. No human in the loop.

## Moving Levels

Going from one level to another requires certain techniques (or technology) being added into the mix. While going from Manual to Conditional Automation is fairly "obvious", and we often also have a good sense for what is required to go to "High Automation", the last step is not so clear, often aspirational.

Manual - Assisted: Code, that's all, turning manual steps into software
Assisted - Linear: A trigger, that calls our (linear) script
Linear - Conditional: An "if" statement or chain of "if" statements
Conditional - High Automation: Sophisticated Methods, reaching from probabilistic methods, machine learning up to LLMs
High Automation - Full Autonomy: _Trust_ that the system will always make the right call, or at least that false judgment is not fatal. Right balance between "deterministic" and "non-deterministic" methods. 

Note: Going from one level to another always adds complexity and with that sources for errors. While going from "Manual" to "Linear" is often _easy_, already going to "Conditional" can make things MUCH more complicated. So this is not only about reaching the highest level, but also about reaching the necessary level, as you will not always have to go "full autonomy"

## Domains (always incomplete), top-to-bottom:
* Instrumentation
* Reliable Code
* Resource Management
* Capacit Planning
* Incident Prevention
* ...
* Incident Response

A map shows that what people commonly refer to often is that Conditional/High Automation corner for Incident Response, they claim to be Fully Autonomous, but there is work to be done.

Note: Many of them are starting to shift on that gladly, also recognizing that prevention might be preferable over response, but this is still not "all of SRE"

# Examples

Let's go over a few examples, and then talk about the Cells (Level+Domain): what do we want to achive? What do we need for it and which kind of automation is making it possible?
Rules Of Thumb: "Classic Automation" = Structured + Deterministic, "Classic ML" = Structured + Probabilistic, LLMs = "unstructured" and "complex"

Examples will be:
* Resource Management (or simplified Auto-Scaling)
* Instrumentation
* Incident Prevention&Response

## Scaling a service

A simple very specific example to show case the ladder

Manual: You need to manually add more instances
Assisted: You have a one shot script that does that
Linear: High Load --- Add one more instance, or Double Instance Count, Low Load -- do the opposite
Conditional: High Load --- Add more instances propertionally to the load
High: Machine Learning is applied to "figure out" the right amount of scaling, based on load+error rate+response time, seasonality, base lines, etc. etc. May ask humans if the computed scaling is implausable
Autonomy: System decides fully autonomously when to scale and how, even in corner cases it makes good judgment calls.

## Instrumentation

Observability is part of a good SRE practice. 

Manual: Add your SDKs etc into the code yourself
Assisted: code completion
Linear: Instrumentation Libraries
Conditional: Automatic Instrumentation, Injector, Runtime Re-Instrumentation, ...
High: Instrumentation LLMs, ...
Autonomy: System decides on build&on runtime what it needs (????)

## Incidents (Prevention+Response)

Manual: Something happens, no alerting, human finds out on their own, human goes through all the stuff, figures out the root cause, fixes it
Assisted: Something hapens, no alerting, human finds out on their own, human runs some scripts that help them to understand things, some scripts might even help to fix the issue
Linear: Something happens, alerting, human gets notified, maybe a basic/linear script can be run to respond&prevent 
Conditional: Something happens, alerting, if certain conditions are met, the system can address them automatically. 
High: Something happens, alerting, system can use sophisticated methods (including LLMs) to address the incident (or precursor to an incident), some times it can fit it automatically, often it sends a hypothesis to a human.
Autonomy: System can address issues (and precursors) automatically. "Self-Healing"

## Summary (so far)

- AI SRE vs Service Reliability Automation
- It's many things at once (Levels+Domains)
- Each level removes human work, but adds complexity
- Full Autonomy: to be done!
- CTA: Join our white paper initative:-)





