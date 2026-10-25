---
name: onboarding-setup-pet
description: "Run a short, visual onboarding flow to choose a built-in ChatGPT Work pet or create a personalized custom pet. Use when helping someone set up a pet. Start with the labeled built-in lineup in a raw-HTML @visualize surface, defer pet management to the canonical `$pets` skill in `openai/oai-maintained-plugins/plugins/pets`, and finish with a one-at-a-time GIF carousel instead of a sprite sheet. Adapt the conversation to what the user has already shared."
---

# Pet Setup

Create a friendly, lightweight onboarding experience. Use the flow below as a suggestion, not a script: adapt it to the user's request, avoid questions they have already answered, and trust your judgment on presentation and missing details.

## Use the canonical pet-management skill

The canonical skill for pet management is `$pets` in the `pets` plugin at [`openai/oai-maintained-plugins/plugins/pets`](https://github.com/openai/oai-maintained-plugins/tree/main/plugins/pets). Treat it as authoritative for listing, creating, validating, storing, selecting, and verifying pets.

For a custom pet, also use [`$create-pet`](https://github.com/openai/oai-maintained-plugins/blob/main/plugins/pets/skills/create-pet/SKILL.md) and its referenced contracts as needed. This demos skill is only an onboarding layer; it does not redefine pet lifecycle behavior.

## Suggested experience

### Begin with the custom-or-built-in choice

Prefer showing the labeled built-in lineup before asking the first question, so the user can see the available companions before choosing. Then ask whether the user wants a custom pet or one of those built-in pets. In the initial structured question, make `Create a custom pet` the first option, before the built-in choices.

- Assume the bundled panorama and catalog in [`references/builtin-pets.md`](references/builtin-pets.md) are accurate for onboarding; skip any live catalog refresh or reconciliation before presenting them.
- Use [`assets/builtin-pets-lineup.png`](assets/builtin-pets-lineup.png) with [`references/builtin-pet-picker.html`](references/builtin-pet-picker.html) in the host's raw-HTML `@visualize` surface. Inline the local image in the template's data-URI placeholder.
- Use `$answers-ask-user-input` when a structured choice is useful, without making the user repeat an answer already present in the conversation.

During a normal pet setup, prefer no more than three total `ask_user_input` questions across the entire flow, including the initial custom-or-built-in choice. Count individual questions rather than tool calls, and treat three as a ceiling rather than a target. Combine related decisions, reuse answers already in the conversation, and infer optional details instead of asking additional questions.

For a built-in pet, resolve and select it through `$pets`, then verify that it is active.

### Personalize a custom pet

When a custom pet would benefit from ideation, offer a few appealing concepts informed by ChatGPT memory and the current conversation. A clearly relevant user-uploaded Library photo can be useful inspiration, but it is optional.

Ask only for choices that materially improve the result. The concept and a characteristic work or review pose are often enough; infer aesthetic and secondary details when that makes the experience smoother. Then let `$create-pet` handle creation, validation, storage, and selection.

## Finish with the pet in motion

After the chosen pet is active, lead with a raw-HTML `@visualize` viewer built from [`references/pet-gif-carousel.html`](references/pet-gif-carousel.html). Fill it with the pet's state GIFs as local data URIs so the user can move through one animation at a time.

A quick decode and frame check is useful before embedding GIFs, especially for newly created pets. Prefer direct GIF links if the visualization surface is unavailable.

Keep sprite sheets and contact sheets as implementation artifacts rather than the final presentation. Follow the viewer with a brief confirmation of which pet was selected or created, plus a Library location or trusted link when one is available.

