---
name: onboarding-website-creation
description: "Use only during the ChatGPT Work onboarding experience when the onboarding prompt or model explicitly invokes this skill for a user who is about to build a website. Guide fast, personal site creation: infer a useful idea, use a fun clean modern one-page default, ask only high-leverage visual questions, and build a private usable first version. Use $answers-ask-user-input when a compact preference choice would materially improve the result. Do not use for ordinary website requests outside onboarding."
---

# Website Creation Onboarding

Use this skill only inside the ChatGPT Work onboarding experience. Do not invoke it for ordinary website work; use the normal site-creation skills instead.

Help the user get a delightful first website quickly. This skill supplies taste and defaults without forcing a scripted flow.

## Keep momentum

- Use the user's stated idea immediately when it is sufficient.
- When the idea is missing, infer two or three safe, relevant possibilities from high-confidence context and ask one $answers-ask-user-input question.
- Ask no more than one preference turn before building unless a missing fact changes the site's purpose or privacy.
- If the user already gave a visual reference or clear constraints, do not ask another style question.
- Use $answers-ask-user-input only when the answer changes the site. After invoking it, end the turn.
- Keep user-facing language about the site and outcome, not tools, hosting, code, or internal checks.

## Opinionated default

Default to a private, responsive, one-page site that feels personal, fun, clean, modern, and current:

- one clear purpose and one primary action;
- at most three strong sections for the first version;
- confident typography, a small intentional palette, generous spacing, and a memorable visual moment;
- real content from the conversation where available, with clearly labeled placeholders rather than invented personal facts;
- simple interactions that support the idea, not decorative complexity.

Avoid generic dashboard grids, unnecessary navigation, long setup forms, speculative features, and a multi-page information architecture unless the user asks for them. A first site should feel complete at small scope.

## Use visual references well

When style is still ambiguous and choosing it would improve the result, ask one compact question with available paths such as:

- make it feel like a named website or design family the user likes;
- use an uploaded screenshot or example;
- pick a fresh modern direction.

Translate a reference into attributes such as density, color, typography, image treatment, and layout. Do not copy logos, protected brand assets, proprietary copy, or an exact interface.

## Build and deliver

Use the available site-building and hosting capabilities. Build the smallest real version that makes the selected idea useful, validate it, and host it privately by default. Never widen visibility without explicit confirmation.

If creation or hosting is unavailable, preserve the chosen idea and style in a compact brief and explain the shortest next step without claiming success.

After delivery, offer one concrete edit that fits the result. Do not restart onboarding for ordinary edits.

