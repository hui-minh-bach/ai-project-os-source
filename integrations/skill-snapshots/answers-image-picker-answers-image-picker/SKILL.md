---
name: answers-image-picker
description: "Use to generate three comparable imagegen previews in the background and present them as a three-card visual choice, with no user-visible commentary before the picker, when that choice should materially change what you build next."
---

# Image picker

## `image_picker`

Generate exactly three comparable visual directions with imagegen, then
present them for the user to choose from.

First use imagegen to create exactly three comparable previews. Start every
imagegen prompt with the exact literal prefix
[image_picker_background_preview]. Do not alter, omit, or paraphrase that
prefix; Work uses it to hide only these preview imagegen messages. Do not
announce the skill, preview generation, or imagegen calls in user-visible
commentary. Pass the three returned absolute saved paths verbatim; never
invent, rename, shorten, or copy a path from this skill's example. If imagegen
did not return three real saved paths, do not invoke the picker.

Then invoke exactly one image picker with a concise question and three
options. Every option must include a unique id, short visible title,
image_path, and non-empty selection_context that tells the model how to
continue if selected. The final answer must contain the single genui citation
for this picker; do not merely say that previews were generated, do not expose
intermediate images, and do not add prose before or after it. Then end the
turn and wait for the user's choice.

Invocation:
// Insert directly:
genui{"image_picker": {"question": {...}, "options": {...}}}
// This widget is not eligible for UUID Mode.

Example:
genui{"image_picker":{"question":"Which visual direction should I build from?","options":[{"id":"editorial","title":"Editorial","image_path":"/mnt/data/ghostwriter_images/generated/editorial.png","selection_context":"Continue with the restrained editorial direction."},{"id":"playful","title":"Playful","image_path":"/mnt/data/ghostwriter_images/generated/playful.png","selection_context":"Continue with the colorful playful direction."},{"id":"premium","title":"Premium","image_path":"/mnt/data/ghostwriter_images/generated/premium.png","selection_context":"Continue with the polished premium direction."}]}}

Args schema:
```text
// ImagePickerWidgetData
{
// Question
//
// Concise question shown above the three image cards.
question: string,
// Options
//
// Exactly three comparable generated image directions.
// minItems: 3, maxItems: 3
options: Array<
// ImagePickerOption
{
// Id
//
// Unique stable identifier returned when the user selects this option.
id: string,
// Title
//
// Short visible title rendered on the image card.
title: string,
// Image Path
//
// Absolute sandbox path returned for the generated preview image. Work promotes this file to a Sediment URL before the frontend renders it.
image_path: string,
// Selection Context
//
// Non-empty model-facing continuation context for this direction. This is returned after selection and is not shown on the card.
selection_context: string,
}
>,
}
```

