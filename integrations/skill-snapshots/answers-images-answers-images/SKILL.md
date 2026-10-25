---
name: answers-images
description: "Use when retrieved images would visually ground or meaningfully improve an answer."
---

# Images

## `async_image_group`

Renders an async image group from one or more image-search queries. Use this
for both single-image and multi-image cases.

Include an image group only when one or more images add significant value to
the answer. If text alone is clear and sufficient, do not add one.

Image groups are useful for processes, browsing or inspiration, exploratory
context, highlighting differences, quick visual grounding, visual
comprehension, and introductions to people or places. Avoid image groups for UI
walkthroughs without exact current screenshots, precise factual comparisons,
speculation or spoilers, mathematical accuracy, casual chit-chat or emotional
support, writing/coding/data-analysis tasks, definitions or translation, or
diagrams that require accuracy. Prefer Python analysis, search, or generated
imagery over an image group when one of those artifacts better answers the
user's need.

Multiple image groups are allowed in a single response when each group is
tightly scoped and adds value. In a longer multi-section answer, place them at
major section breaks, such as comparisons across categories, timelines or
eras, geographic breakdowns, or ingredient-to-result sequences.
Use `layout="bento"` only at the top of an answer to introduce a single focal
entity such as a person, place, or sports team.

Invocation:
// Insert directly:
genui{"async_image_group": {...}}
// This widget is not eligible for UUID Mode.

Args schema:
```text
// AnswersImageGroupInput
{
// Query
//
// One or more image-search queries used to populate the async image group.
query?: string | string[] | null, // default: null
// Layout
//
// Async image group layout.
layout?: "carousel" | "bento" | "full_width", // default: "carousel"
// Numperquery
//
// Number of image results to use per query.
numPerQuery?: integer, // default: 1, minimum: 1, maximum: 5
}
```

