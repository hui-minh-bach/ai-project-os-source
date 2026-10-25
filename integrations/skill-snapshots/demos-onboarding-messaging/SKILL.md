---
name: onboarding-messaging
description: "Use only during the ChatGPT Work onboarding experience when the onboarding prompt or model explicitly invokes this skill to connect Slack, Microsoft Teams, or another messaging app and show a first useful messaging task. Reuse a verified connection when possible, ask for the provider only when needed, then demonstrate safe value such as a daily summary or reviewable reply drafts. Use $answers-ask-user-input for provider, workspace, task, or automation choices that cannot be inferred safely. Do not use for ordinary messaging requests outside onboarding."
---

# Messaging Onboarding

Use this skill only inside the ChatGPT Work onboarding experience. Do not invoke it for ordinary Slack, Teams, or messaging work; use the normal messaging skills instead.

Connect the user's messaging app only when needed, then show one useful thing ChatGPT Work can do with it. Keep this adaptive and short rather than replaying the fixed self-DM demo.

## Resolve the connection quickly

- Check usable Slack, Microsoft Teams, or other messaging connections before asking the user.
- If exactly one relevant service and workspace is connected, use it without asking for confirmation.
- If several plausible workspaces or accounts exist and one is not clearly primary, ask which one to use through $answers-ask-user-input.
- If none is connected, infer the provider only from reliable context. When unclear, ask which app they use through $answers-ask-user-input and offer only connectable options.
- Use the normal connection flow, then verify access before reading messages.
- Never ask for a password, access token, copied workspace export, or pasted credentials.

## Show one useful first result

After connection, demonstrate a safe useful outcome instead of only listing features. When the available capabilities and context make it possible, default to a compact read-only view of recent conversations that may need attention or a short summary of active channels or chats.

If no useful default is clear, ask one compact task-choice question with two or three available options such as:

- summarize recent channels or chats;
- prepare draft replies to messages that may need a response;
- set up a daily messaging summary.

Use provider-correct language such as Slack channels, Slack DMs, Teams channels, or Teams chats. Do not read broadly, expose private content unnecessarily, or claim access beyond the connected account.

## Keep actions safe

- Drafts are for review and are never sent automatically.
- Before sending any message, show the exact recipient, destination, and message and get explicit confirmation.
- Before creating a daily summary, show the sources, cadence, timezone, destination, and whether it only summarizes or also prepares drafts, then get explicit confirmation.
- Default recurring summaries to sources the user can access and a sensible local morning time. Do not imply company-wide coverage.
- Never join channels, change memberships, delete messages, or modify messaging state during onboarding.

## Keep the experience light

- Ask at most one focused question at a time and skip it when context is sufficient.
- Use $answers-ask-user-input only for material choices; after invoking it, end the turn.
- Keep routing, connector details, workspace scoring, and tool mechanics hidden.
- If connection or permission fails, state what failed and offer the shortest retry or alternate-provider path.

