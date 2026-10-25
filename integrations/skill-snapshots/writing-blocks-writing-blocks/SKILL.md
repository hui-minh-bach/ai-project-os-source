---
name: writing-blocks
description: Present complete drafts of requested text in a writing block, including emails, messages, social posts, bios, blurbs, statements, and individual paragraphs. Prefer creating or editing a file for standalone documents or long-form content instead of a writing block.
---

# Writing Blocks

A writing block contains a complete piece of drafted text whose wording is itself the requested output.

## Usage

Use a writing block when the user asks you to draft, rewrite, edit, or polish a complete piece of text for a specific purpose. Examples include emails, chat messages, social media posts, captions, comments, bios, blurbs, announcements, invitations, brief statements, form responses, and individual paragraphs.

The deciding factor is whether the user wants the actual wording, complete for the purpose and scope they specified.

When revising a prior writing block, return the revised content in a new writing block.

Do not use a writing block for explanations, analysis, advice, critique, brainstorming, informational summaries, outlines, code, or tentative wording suggestions. A short passage can still belong in a writing block when it is the complete text the user requested.

If a response includes both a complete draft and other content, put only the complete draft in the writing block.

## Syntax

Use this format:

:::writing{variant="<variant>" id="<id>"}
<content>
:::

For emails:

:::writing{variant="email" id="<id>" subject="<subject>" recipient="<recipient>"}
<content>
:::

## Variants

Set `variant` to one of:

- `email`
- `chat_message`
- `social_post`
- `standard`

Variant choice:
- Use variant="email" for complete emails and email replies.
- Use variant="chat_message" for rewritten texts, Slack replies, DMs, quick replies, and direct messages.
- Use variant="social_post" for captions, comments, social posts, LinkedIn posts, tweets/X posts, Instagram captions, and promotional social copy.
- Use variant="standard" for a complete draft that does not fit a more specific variant.

## Metadata Rules

Writing blocks should always include:

- `variant`
- `id`

Set `id` to a unique 5-digit string.

For `variant="email"`:

- Always include `subject`.
- If the user specifies a recipient, try to determine the email address from available context or tools and include it as `recipient`.
- Only include a recipient if the email address is known. Do not invent or guess an email address.
- Omit `recipient` if the email address cannot be determined.

For non-email variants:

- Do not include `subject` or `recipient`.

## Output Rules

Put the complete draft inside the writing block.

If the user asks for multiple complete drafts, use one writing block per draft, each with a unique `id`.

Keep any surrounding explanation brief unless the user asks for rationale or alternatives.

