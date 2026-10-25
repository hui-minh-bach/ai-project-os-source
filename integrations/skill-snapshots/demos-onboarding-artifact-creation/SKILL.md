---
name: onboarding-artifact-creation
description: "Use only during the ChatGPT Work onboarding experience when the onboarding prompt or model explicitly invokes this skill for a user who is about to create an artifact such as a presentation, PDF, document, spreadsheet, or similar file. Infer the best artifact type, bias toward a presentation when the type is unclear, ask only high-leverage style or source questions, and create a polished compact first artifact with strict small-scope defaults. Use $answers-ask-user-input when a compact preference choice would materially improve the result. Do not use for ordinary artifact requests outside onboarding."
---

# Artifact Creation Onboarding

Use this skill only inside the ChatGPT Work onboarding experience. Do not invoke it for ordinary presentation, PDF, document, or spreadsheet work; use the normal artifact-creation skills instead.

Help the user get to a convincing first artifact quickly. This is a guidance layer, not a fixed wizard. Use judgment, make strong defaults, and keep questions scarce.

## Pick the artifact type quickly

- Honor the file type or format the user already requested.
- Infer the type from the goal when possible: presentations for narrative, persuasive, explanatory, or visual stories; documents for prose-heavy briefs or plans; PDFs for polished fixed-layout handouts or reports; spreadsheets for structured data, calculations, or trackers.
- If the user asks for an artifact, file, or deliverable without a clear type, bias toward a presentation. It is usually the clearest compact proof of Work mode's artifact capability.
- Ask one compact $answers-ask-user-input question only when the type genuinely changes the result and cannot be inferred. Offer two or three concrete choices, with Presentation as the default.
- Use the user's request plus high-confidence conversation, memory, and connected-source context before asking anything. Do not reopen the topic, audience, or goal when they are already clear enough.
- Ask at most one elicitation turn before creation unless a missing fact would make the artifact misleading or unusable.
- Use $answers-ask-user-input only for a real choice that changes the result. After invoking it, end the turn.
- Do not expose skill names, connector mechanics, rendering steps, or validation internals in user-facing copy.

## Choose a style without slowing the user down

Honor any style direction the user already gave. Otherwise ask about style only when it would noticeably improve the first result.

Build a short choice from paths that are actually available:

- learn from one representative artifact in a verified connected Google Drive, OneDrive, SharePoint, or Box source;
- use an uploaded presentation, PDF, document, spreadsheet, screenshot, or template;
- use the default style.

Never imply that a source is connected or readable until it has been verified. If the user chooses a source that is not connected, offer the product's normal connection path and resume afterward. Do not force a connection when the default style would be good enough.

The default style should feel deliberate: clean modern editorial energy, strong hierarchy, generous whitespace, restrained color, useful visuals, and one clear idea per section, page, or slide. Treat named products, publications, or websites as inspiration for attributes, not as templates to copy.

## Keep the first artifact compact

Create the smallest finished artifact that proves the capability:

- Presentation: create an editable 16:9 .pptx with no more than three slides. Establish the point, show the key evidence or plan, and land the recommendation or takeaway.
- PDF: create a polished .pdf with no more than three pages. Use a clear opening, a compact body with useful visuals or structure, and a concise conclusion or next step.
- Document: create an editable .docx with no more than three pages. Use a strong title, short summary, clear headings, and a focused recommendation, plan, or conclusion.
- Spreadsheet: create an editable .xlsx with one primary sheet and at most two supporting sheets. Keep only the needed rows, columns, formulas, labels, and one compact summary view when useful.
- Other artifact: make the smallest credible version, usually no more than three primary sections, pages, screens, or states.

Treat these limits as strict onboarding defaults. Do not expand scope to make the artifact feel impressive; compress the story or offer a focused follow-up revision after the first artifact is delivered.

Use the normal artifact-authoring capability for the chosen type and follow its rendering and quality checks. Deliver the actual file, not only an outline. Do not invent facts, metrics, quotes, dates, or accomplishments. Mark placeholders clearly when a detail is essential but unknown.

## Finish well

Briefly say what the artifact contains and offer one targeted next improvement grounded in the result, such as changing the visual direction, tightening the story, adding a data point, or adapting it to another format.

After delivery, offer optional cloud saving as one concise next step. Name a verified connected destination such as Google Drive, OneDrive, SharePoint, or Box when available; otherwise say that the relevant storage can be connected first. Ask through $answers-ask-user-input only if the user needs to choose a destination or confirm saving. Never save or upload without confirmation.

