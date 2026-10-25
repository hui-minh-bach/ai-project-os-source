---
name: onboarding-email
description: "Use only during the ChatGPT Work onboarding experience when the onboarding prompt or model explicitly invokes this skill to connect email or show a first useful inbox task. Detect an existing inbox when possible, infer or ask whether the user uses Gmail or Outlook or Microsoft 365, connect only the chosen provider, then demonstrate a safe result such as important-email triage or a morning briefing. Use $answers-ask-user-input for provider, inbox, task, or automation choices that cannot be inferred safely. Do not use for ordinary email requests outside onboarding."
---

# Email Onboarding

Use this skill only inside the ChatGPT Work onboarding experience. Do not invoke it for ordinary email work; use the normal email skills instead.

Connect email only when it helps the user's next task, then show immediate value. Keep this adaptive and short rather than turning it into a fixed inbox-setup tour.

## Resolve the provider quickly

- Check available email connections before asking the user.
- If exactly one usable inbox is connected, use it without a confirmation question.
- If multiple inboxes are plausible, ask which one to use through $answers-ask-user-input.
- If none is connected, infer Gmail versus Outlook or Microsoft 365 only from reliable account or conversation context. When unclear, ask one compact provider question through $answers-ask-user-input.
- Offer only providers that can actually be connected. If the user says Microsoft Teams, explain that Teams is messaging rather than email and route to the messaging setup path when appropriate.
- Never ask for a password, token, or mailbox export. Use the normal connection flow, then verify access before reading mail.

## Show one useful first result

After connection, demonstrate one safe outcome instead of describing capabilities abstractly. Default to a read-only scan of recent mail that surfaces a small number of direct asks, deadlines, important relationships, or unresolved follow-ups. Exclude routine promotions and noise.

When another first task is clearly better, follow the user's intent: draft a reply for review, find a specific message, or prepare a morning summary. Do not send, archive, delete, label, star, mark read, or otherwise mutate the mailbox during onboarding.

Ask a task-choice question only when no useful default can be inferred. Keep it to two or three concrete choices and use $answers-ask-user-input.

## Offer automation after value is visible

Once the user has seen a useful result, it is reasonable to offer a morning email check. Describe the concrete outcome, infer a sensible local morning time when possible, and ask for explicit confirmation before creating it. State the inbox, cadence, timezone, and whether it only summarizes or also prepares drafts.

Default automations to read-only summaries and reviewable drafts. Never send email or change mailbox state automatically.

## Keep the experience light

- Ask at most one question at a time, and skip it when context is sufficient.
- Use $answers-ask-user-input only for material choices; after invoking it, end the turn.
- Do not announce a roadmap, skill name, connector, query, or internal verification.
- Report connection failures precisely and offer the shortest retry or alternate-provider path.

