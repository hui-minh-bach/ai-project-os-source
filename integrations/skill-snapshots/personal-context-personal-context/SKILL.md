---
name: personal-context
description: "Use this skill when either of the following situations are true. Continuity related: the user explicitly or implicitly refers to prior conversation state, shared work, an earlier artifact, decision, preference, constraint, attempt, or progress item, including elliptical phrases like continue, next, again, still, update it, compare it, same as before, my axes, or our plan. Decision related: a specific unseen prior preference, constraint, history item, or attempt would materially change a concrete choice, and not be a marginal improvement. Reading and tool discovery are only a check; after loading, discover and load Personal Context's full instructions, and call personal_context.search only if they apply. Use it before another tool when the prior state changes retrieval or judgment. Skip first-turn generic facts, generic personal-domain advice, visible-context-complete work, and current-source-only tasks."
---

# Personal Context

Use the trigger rules in the description above. When this skill applies, discover the Personal
Context tool and inspect its loaded instructions. Call personal_context.search with a
self-contained query only when those full instructions indicate that it applies.

