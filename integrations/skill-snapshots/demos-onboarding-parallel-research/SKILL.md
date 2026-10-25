---
name: onboarding-parallel-research
description: "Use only during the ChatGPT Work onboarding experience when the onboarding prompt or model explicitly invokes this skill. Use this skill to research one main topic from three complementary angles and turn the findings into a compact, source-backed visual synthesis using @visualize. Define exactly three mostly distinct, parallelizable subtopics and launch exactly three subagents concurrently with one owner per subtopic. Do not use for ordinary research requests outside onboarding."
---

# Fast Parallel Research Onboarding

Use this skill only inside ChatGPT Work onboarding. Deliver a useful research response quickly: favor a faster result over an exhaustive report, keep each research track bounded.

## Scope the research

- Identify the main topic, desired outcome, and important constraints. Ask one short follow-up only when the topic or goal is unclear.
- Define exactly three complementary, mostly distinct subtopics that can be researched independently. If the user supplied three topics, preserve their intent.

## Run three tracks in parallel

- Immediately launch exactly three subagents in the same orchestration wave, before waiting for any result. Assign one subtopic to each. The primary model owns synthesis.
- Ask each subagent for three to five useful facts, implications for the main topic, material caveats, and direct source links with dates when available.  Quantitivate responses are helpful because they allow for more interesting visuals.
- Use current sources when facts may have changed, prefer primary sources, and stop once there is enough evidence for a clear synthesis.
- Wait for all three results. If three subagents cannot be launched, report the limitation and offer to retry; do not silently substitute sequential work or ordinary concurrent searches.

## Synthesize and visualize

- Combine the tracks around the main question, normalize comparable facts, cite consequential claims, and mark missing evidence rather than inventing it.
- Distill one central takeaway and no more than three supporting insights.
- Use the visualization capability selected by the onboarding prompt, including `@visualize` when present.
- Lead with the visual, then give the insights, sources, and only material caveats. Do not narrate internal orchestration.

