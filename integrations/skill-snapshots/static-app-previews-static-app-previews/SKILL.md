---
name: static-app-previews
description: Deliver self-contained static web app previews for requests asking for a custom game, app, website, interactive demo, UI prototype, or widget that can be rendered from one complete HTML, JSX, or TSX file. Defer website and web app requests to the Sites skills when they are available. Do not use if the user is requesting programming help, file edits, external deployment, or a multi-file project.
---

# Inline App Previews

## Sites Precedence

When the `sites-building` skill is available, use Sites for requests to create, build, redesign, update, repair, preview, save, publish, deploy, or host a website or web app. This includes landing pages, portfolios, dashboards, portals, trackers, hubs, and internal tools.

Use `sites-building` before writing or changing the site. Use `sites-hosting` for the corresponding save, preview, publishing, deployment, or hosting workflow when that skill is available.

When Sites is handling the request, do not also return an inline app preview unless the user explicitly asks for one.

If `sites-building` is not available, this skill may provide an inline app preview when the request otherwise meets the requirements below. Do not claim to save, publish, deploy, or host the result without the required Sites capability.

A project containing `.openai/hosting.json` is a Sites project. Do not replace its workflow with an inline preview. If the Sites skills are unavailable, explain that the required Sites capability is unavailable.

## Preview Requests

When the user asks for a game, app, website, interactive demo, or widget, the request is not being handled through an available Sites skill, and they did not explicitly ask for programming help, file editing, setup, deployment, or a repository change, return an inline app preview.

## Output Contract

Return exactly one self-contained code block that is previewable in a standalone iframe.

Do not return files, attachments, artifact links, canvas documents, downloadable assets, local paths, relative paths, imports, or multi-file layouts.

Do not say the app was saved somewhere.

Do not include `sandbox:/...` links.

## Implementation Rules

Make the code fully self-contained and runnable as-is inside the single code block.

Prefer plain HTML, CSS, and JavaScript for maximum reliability.

Do not use external dependencies, external assets, local assets, network-loaded fonts, image URLs, package imports, or framework imports unless the preview environment implicitly provides them.

Make the UI visible and functional immediately on render.

For playable games, prefer a complete single-block `html preview` implementation.

## HTML Preview

Use a single fenced code block with this exact language tag when the app is complete and self-contained:

```html preview
```

Include all CSS in `<style>` tags.

Include all JavaScript in `<script>` tags.

Do not reference external or local assets.

## React Preview

Use a single fenced code block with `jsx preview` or `tsx preview` only when the environment supports inline React previews.

Export a default component.

Do not use imports.

Do not require props.

Keep all styles inline or embedded in the same file.

## Preview Tag Requirements

Use `preview` only when all conditions are true:

- The language is exactly `html`, `jsx`, or `tsx`.
- The code is complete and renders visible UI by itself.
- The code has no dependency on external files, local files, imports, assets, or a multi-file structure.

If any condition is not met, return a normal code block without `preview`.

## Non-Preview Requests

If the user explicitly asks for programming help, code explanation, file editing, project setup, deployment, repository changes, or a multi-file implementation, follow the normal coding workflow instead of this skill.

