---
name: onboarding-learn-writing-style
description: "Use only during the ChatGPT Work onboarding experience when the onboarding prompt or model explicitly invokes this skill to create or update the user's Writing Style skill. Explain that ChatGPT can learn from email, documents, past chats, uploads, and more; ask which writing style or source to start with; learn from a small verified sample; show a privacy-safe Writing Style Reference plus four or five relatable hypothetical examples; calibrate before saving; and never send or share anything. Use $answers-ask-user-input for source, connection, sample, and calibration choices. Do not use for ordinary writing, email, or document requests outside onboarding."
---

# Learn Writing Style Onboarding

Use this skill only inside the ChatGPT Work onboarding experience. Do not invoke it for ordinary writing, email, or document work; use the normal writing, email, and document skills instead.

Help the user see that ChatGPT can learn how they write across emails, documents, past chats, and more, then use that style in future drafts. Keep setup focused: choose one starting source, learn from the user's own writing, show what was learned, let them correct it, then save only after confirmation.

## Choose what to learn first

If the user has not already named a writing type or source, begin with a short explanation and ask one question through $answers-ask-user-input:

> ChatGPT can learn how you write across emails, documents, past chats, and more, then use that style in future drafts. Which writing style should it learn first?

Offer applicable choices such as:

- Email
- Past chats
- Documents or uploaded samples

Use the free-text path for another writing style or source. Do not silently choose a source when the request is broad. Once the user chooses, follow only that source path instead of asking a larger questionnaire.

## Learn from email

- Check usable email connections before asking anything else.
- If exactly one inbox is connected, use it without asking the user to confirm it. Say plainly that a bounded sample of sent email will be reviewed to learn how they write.
- If several inboxes are connected, ask which inbox to learn from through $answers-ask-user-input.
- If none is connected, ask which email client the user uses and help connect it. Offer only providers that are actually available, such as Gmail or Outlook or Microsoft 365.
- After a connection flow, verify live access before reading mail.
- Never ask for a password, access token, pasted mailbox export, or forwarded archive.

Inspect representative emails the user wrote over the last three months. Include internal and external messages, new threads, replies, follow-ups, and signature patterns when the available sample supports them.

## Learn from past chats

- Use only accessible past-chat context containing the user's own substantial writing.
- Prefer repeated, representative writing over one short prompt or copied text.
- If the available context is too thin, say so and offer documents, email, or an uploaded or pasted sample through $answers-ask-user-input.
- Never claim access to chats that were not actually available.

## Learn from documents or uploaded samples

- Check verified connected sources such as Google Drive, Box, OneDrive, or SharePoint before asking the user to connect one.
- If one useful source is connected, search narrowly for a few representative documents the user appears to own or author. Ask which document to learn from only when more than one plausible sample exists.
- If several sources are connected, ask which source or document to use through $answers-ask-user-input.
- If none is connected, offer available connection paths plus an upload or paste-samples option. Do not force a connection when a sample upload is faster.
- Read only the user's own prose. Do not learn from templates, copied material, comments by others, or unrelated confidential content.

## Learn from the user's own writing

Use a bounded, varied sample, normally three to five pieces of writing. Ignore quoted history, forwarded text, legal footers, boilerplate, and text written by other people.

Infer only observable writing patterns:

- voice, warmth, directness, and formality;
- typical length, detail, and structure;
- openings, requests, questions, scheduling language, quick replies, follow-ups, and sign-offs;
- headings, transitions, recommendations, and conclusions for document-style writing;
- punctuation, contractions, recurring phrasing, and signature habits.

Do not infer sensitive traits, identity, beliefs, health, personality diagnoses, or private facts.

## Show the Writing Style Reference

Before saving anything, show a concise Writing Style Reference using short representative snippets from the user's own writing. Group snippets only into situations actually supported by the sample.

For email, useful groups may include opening lines, requests or questions, scheduling and coordination, quick replies and follow-ups, and sign-offs. For documents, useful groups may include framing, headings, transitions, recommendations, and conclusions. For past chats or another source, use categories that fit that writing.

Redact names, addresses, company-confidential details, and other sensitive information. Never quote text written by other people. Briefly summarize the voice and tone patterns learned.

Then show four or five short, relatable hypothetical examples so the user can judge how the style would be applied. Match the examples to the chosen writing type: complete email drafts for email, short document excerpts for documents, or realistic chat-style responses for past chats. Prefer situations such as responding to an introduction, handling a conflict, making a request, changing a plan, following up, or sharing an update. Tailor them to high-confidence context without inventing recipients, commitments, availability, decisions, or facts. Make clear that they are hypothetical and nothing has been sent or shared.

## Calibrate and save

Ask what feels accurate or off through $answers-ask-user-input. Invite specific corrections such as shorter, warmer, more direct, less formal, different greeting habits, or different structure. If the user corrects the style, revise the affected reference and examples, then ask once more.

After explicit confirmation, use $skill-creator to create or update one reusable Writing Style skill. Update an existing skill instead of creating a duplicate. Store only confirmed style guidance and the intended writing scope, not private source messages, documents, recipients, or unrelated personal details.

Never send email, share documents, or change a connected source during this flow. Learning a style does not authorize later sending or sharing.

