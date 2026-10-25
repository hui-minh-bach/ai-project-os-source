---
name: template-creator
description: Create or update an installable personal ChatGPT artifact-template skill from a reference document, presentation, spreadsheet, Google Docs, Slides, or Sheets link, ImageGen or Product Design image, email, Slack message, or Site project. Use when the user selects Template Creator, asks to create a reusable template, or explicitly asks to update one exact personal template. Do not use for one-off creation from an existing template.
---

# Template Creator

Create or update a reference-backed template in the current ChatGPT sandbox, package it as a personal skill, and show its template card in the conversation. Retain the original file, Site source, or canonical Google Workspace URL plus reference image so future uses preserve its native structure, voice, and visual style.

## Routing

- Support both ordinary ChatGPT chats and ChatGPT Work conversations.
- Ordinary Chat uses `/mnt/data`. When `/workspace` exists, use `/workspace/output`, even if `/mnt/data` is also available.
- In every shell invocation, set `SKILL_DIR` to the directory containing this `SKILL.md` and resolve the output directory again. Shell variables do not persist between invocations.
- Keep draft files under `<output-directory>/template-skill-drafts` and the install archive at `<output-directory>/skill.zip`. ChatGPT saves a new valid artifact template automatically after recognizing its template card; an existing same-name template remains unchanged until the user clicks **Save changes**.
- Do not write to `$CODEX_HOME`, `~/.codex`, a local desktop skill directory, an installed plugin cache, or a workspace plugin. Web templates do not synchronize with Codex desktop skills.
- Create a new template by default. Check the prefetched personal-skill directory and the draft directory before choosing its human-readable display name; when the derived skill name already exists, add `2`, `3`, and so on to the display name so the resulting skill name receives the matching `-2` or `-3` suffix. Never replace an existing template unless the user explicitly requests an update, and never append a random or hash suffix.
- Update only when the user explicitly asks to edit or update exactly one personal template and its current skill package is available. Stage that exact package under the draft directory and preserve its skill name.
- A template draft exists only after `create-template-skill.mjs` succeeds. Never hand-author, rename, or copy a normal skill and report it as an artifact template.
- Respect skill-creation and upload permissions. Never claim that a template is installed before the product confirms the automatic save or the user completes **Save changes**.

## Create workflow

1. Start from one supported reference unless the user explicitly requests a batch:
   - Document: `.docx`
   - Presentation: `.pptx`
   - Spreadsheet: `.xlsx`
   - Google Workspace: one Google Docs, Google Slides, or Google Sheets URL or selected Drive source
   - ImageGen or Product Design image: `.png`
   - Email or Slack message: `.txt`
   - Site: an existing Site project directory
   - To obtain an existing Site project, load the prompt-advertised hosted Sites capability and invoke its `edit` lifecycle first. Follow its required main-conversation `sites_get_site` instruction, then use the returned `Checkout` as the reference. Never run `create` merely to retrieve an existing Site's source.
   - When email or Slack content is pasted, materialize the exact content as a temporary UTF-8 `reference.txt` without rewriting it.
   - When the user describes a document, presentation, or spreadsheet template without attaching a reference, first use the corresponding available artifact capability to create a representative `.docx`, `.pptx`, or `.xlsx` from the requested use case. Retain that generated artifact as the reference.
2. Infer a concise display name and intended-use description from the reference and request. Classify the original source, not an inspection export or materialized snapshot: infer Office and image kinds from local file extensions; for a Workspace URL or mapped Drive source, use Drive metadata to identify its native type and canonical `docs.google.com` URL. Keep `google-docs`, `google-slides`, or `google-sheets` even when a local snapshot uses an Office extension. Ask only when the source is inaccessible or does not identify a supported native Workspace artifact. For a Site project directory, use `site`. For an image, set its gallery kind to `product-design` when the request includes Product Design; otherwise default to `imagegen`, including when the user provides only the image and Template Creator. Ask only when the request explicitly includes both Product Design and ImageGen and the intended target remains unclear. For `.txt`, ask whether the template is for `email` or `slack` when that is not clear.
3. For references other than Site projects, create `preview.png` before packaging:
   - DOCX: use the available Documents capability to render the first page.
   - PPTX: use the available Presentations capability to render the first slide.
   - XLSX: use the available Spreadsheets capability to render the used range of the first visible non-empty sheet.
   - Google Docs: inspect the complete native document, export it to PDF, and render its first content page to `reference.png`. Normally this is PDF page 1. For a tabbed Doc, Google may prepend one or more synthetic pages containing only a tab title; skip only those consecutive tab-title separator pages and use the first page containing the first tab's actual document body. Treat that page as the artifact's first page. Do not skip a real content page merely to choose a more attractive preview, and stop if the export contains no representative content page.
   - Google Slides: inspect the native deck, export it to PDF, and render only its first slide to `reference.png`.
   - Google Sheets: inspect the workbook, export it to XLSX, and render the used range of the first visible non-empty sheet to `reference.png`.
   - PNG: copy the reference unchanged.
   - Email or Slack: render a legible representative portion of the exact reference text on a neutral canvas without paraphrasing or inventing content.
   - For a Google Workspace template, copy the checked `reference.png` unchanged to `preview.png`.
   - A Google Workspace URL or selected Drive source is sufficient to activate the connected Google Drive workflow; do not require the user to select Google Drive separately. For a mapped source, use its exact Drive file ID rather than the materialized Office snapshot. Before entering `functions.exec`, check whether a Google Drive fetch action with raw-file download support is callable. If it is not, use tool discovery once, then check again. Do not report it unavailable before that discovery attempt fails.
   - Use the connected Google Drive fetch action with `download_raw_file` and `raw_export_mime_type`. Do not open a Google `/export` URL, follow a `googleusercontent.com` redirect, use browser download, or use a shell HTTP client. If the connector cannot access or export the exact source, stop and explain the connection requirement.

   Load the workspace dependencies and use the checked-in file bridge for Google Docs and Slides PDF exports and Google Sheets XLSX exports. Run this inside one `functions.exec` call so authenticated bytes never appear in a shell argument:

```js
const SKILL_DIR = "<absolute-template-creator-skill-directory>";
const WORKSPACE = "<absolute-output-directory>";
const NODE_BIN = "<absolute-node-path-from-workspace-dependency-loader>";
const loaded = await tools.exec_command({
  cmd: "/bin/cat -- ./host/export-google-workspace-file.mjs",
  shell: "/bin/sh",
  workdir: SKILL_DIR,
  login: false,
  yield_time_ms: 30000,
  max_output_tokens: 30000,
});
if (loaded.exit_code !== 0)
  throw new Error("Could not load the Google Workspace exporter");
const exportGoogleWorkspaceFile = new Function(
  `${loaded.output}\nreturn exportGoogleWorkspaceFile;`,
)();
const result = await exportGoogleWorkspaceFile({
  sourceUrl: "<canonical-google-workspace-url>",
  mimeType: "<application/pdf-or-xlsx-mime-type>",
  nodePath: NODE_BIN,
  receiverPath: `${SKILL_DIR}/host/google-workspace-export-stdin-receiver.mjs`,
  outputPath: `${WORKSPACE}/<reference.pdf-or-reference.xlsx>`,
  workspaceRoot: WORKSPACE,
  tools,
});
text(JSON.stringify(result));
```

Use `application/pdf` for Google Docs and Slides and `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` for Google Sheets. Preserve a `resourcekey` needed for link access, but remove account-routing, sharing, tab, range, heading, slide, and fragment parameters from the canonical source URL.
4. Visually inspect the PNG when one was created. Stop if it is blank, clipped, corrupted, or unrepresentative. Site templates use a bundled generic Sites PNG preview and do not require a screenshot.
5. Resolve `SKILL_DIR` and the output directory, shell-escape each user-controlled value as one argument, and run the bundled creator:

```bash
SKILL_DIR="$(dirname "<absolute path of this SKILL.md>")"
TEMPLATE_OUTPUT_DIR="/mnt/data"
if [ -d /workspace ]; then
  TEMPLATE_OUTPUT_DIR="/workspace/output"
fi
mkdir -p "$TEMPLATE_OUTPUT_DIR"

node "$SKILL_DIR/scripts/create-template-skill.mjs" \
  --draft-directory "$TEMPLATE_OUTPUT_DIR/template-skill-drafts" \
  --reference-path "/absolute/path/reference.docx" \
  --preview-path "/absolute/path/preview.png" \
  --display-name "Meeting Notes" \
  --description "Run a structured meeting with updates, decisions, and owners."
```

Pass `--kind "image"` with `--gallery-kind "imagegen"` or `--gallery-kind "product-design"` for images. Pass `--kind "email"` or `--kind "slack"` for text references. For Site project directories, pass `--kind "site"` and omit `--preview-path`. For a Google Workspace template, pass its exact `google-docs`, `google-slides`, or `google-sheets` kind, the canonical URL as `--source-url`, and the checked PNG as both the reference and preview paths. Do not create an intermediary request file.

```bash
node "$SKILL_DIR/scripts/create-template-skill.mjs" \
  --draft-directory "$TEMPLATE_OUTPUT_DIR/template-skill-drafts" \
  --kind "google-docs" \
  --source-url "https://docs.google.com/document/d/example/edit" \
  --reference-path "/absolute/path/reference.png" \
  --preview-path "/absolute/path/reference.png" \
  --display-name "Project Brief" \
  --description "Create project briefs with this Google Doc's native structure and visual system."
```

6. Read the JSON result. Verify that `skillName` begins with `artifact-template-` and that `skillPath` contains `SKILL.md`, `artifact-template.json`, `agents/openai.yaml`, and `assets/preview.png`. For Site templates, verify that the project is retained in `assets/source` with the generic Sites preview. Read the original project's `.gitignore` when present, inspect `assets/source`, and remove ignored files, project-specific credentials, customer exports, runtime data, generated archives, and unnecessary large files from the generated copy without modifying the original project before reporting success. Verify that its generated instructions copy the sanitized retained application, including hidden files, into a fresh empty project directory and use the existing Sites building and hosting workflow without running a starter initializer over it. Preserve package configuration, migrations, and logical D1/R2 bindings; Sites assigns the new `project_id` and source repository. For all other templates, verify `assets/reference.<ext>`. For a Google Workspace template, also verify that the manifest contains its canonical `sourceUrl` and `assets/reference.png`. If any check fails, do not package the skill, claim the template was created, or present an install card.
7. Package the generated skill at the exact `skill.zip` location recognized by ChatGPT Web:

```bash
SKILL_DIR="$(dirname "<absolute path of this SKILL.md>")"
TEMPLATE_OUTPUT_DIR="/mnt/data"
if [ -d /workspace ]; then
  TEMPLATE_OUTPUT_DIR="/workspace/output"
fi

python3 "$SKILL_DIR/scripts/package-template-skill.py" \
  --skill-directory "$TEMPLATE_OUTPUT_DIR/template-skill-drafts/artifact-template-meeting-notes" \
  --output-path "$TEMPLATE_OUTPUT_DIR/skill.zip"
```

The archive retains the skill folder name, instructions, template manifest, agent metadata, preview, and unchanged reference or sanitized Site source directory. For an explicitly requested batch, use distinct `$TEMPLATE_OUTPUT_DIR/<skill-name>/skill.zip` locations and present each archive in its own assistant response when the runtime supports separate response cards.

## Update workflow

1. Resolve the exact personal ChatGPT skill the user asked to update. Resolve `TEMPLATE_OUTPUT_DIR` for the current shell invocation, then copy its existing skill package to `$TEMPLATE_OUTPUT_DIR/template-skill-drafts/<exact-skill-name>`. Stop if more than one target was provided or if the existing package cannot be read.
2. Preserve the skill folder name, template kind, gallery kind, source URL, reference, preview, custom instructions, agent settings, and every other file the user did not ask to change. For Sites, replace the retained source only when the user explicitly updates the project.
3. Apply only the requested edit. For file-reference or visual changes, edit a temporary copy of the retained reference, generate a fresh preview, and inspect it. For Site project changes, use the updated project directory as the reference without creating a preview. Never edit a linked Google Workspace source; update its canonical URL and rendered reference image only when the user explicitly changes the template source. For display-name or intended-use changes, keep the existing source, reference, and preview unless the user also asks to change them; for Site metadata-only changes, use the existing template's `assets/source`. For instruction-only or other skill-owned text changes, edit only the requested files directly and keep the manifest and agent metadata consistent.
4. Pass the existing values for unchanged fields directly to the creator. For Site templates, pass `--kind "site"` and the selected project directory or existing `assets/source` as `--reference-path`, omitting `--preview-path`. Leave off `--updated-fields` for a reference-only update; add `--updated-fields "display-name"`, `--updated-fields "description"`, or `--updated-fields "display-name,description"` only when the user explicitly requested those metadata changes:

```bash
SKILL_DIR="$(dirname "<absolute path of this SKILL.md>")"
TEMPLATE_OUTPUT_DIR="/mnt/data"
if [ -d /workspace ]; then
  TEMPLATE_OUTPUT_DIR="/workspace/output"
fi

node "$SKILL_DIR/scripts/create-template-skill.mjs" \
  --draft-directory "$TEMPLATE_OUTPUT_DIR/template-skill-drafts" \
  --mode "update" \
  --skill-name "artifact-template-meeting-notes" \
  --kind "document" \
  --reference-path "/absolute/path/updated-reference.docx" \
  --preview-path "/absolute/path/updated-preview.png" \
  --display-name "Meeting Notes" \
  --description "Run a structured meeting with updates, decisions, and owners."
```

5. Verify that unrequested instructions, agent settings, manifest fields, and additional assets are unchanged, and confirm that no staging or backup directories remain. For Site templates, also verify the retained or explicitly updated `assets/source`, generic preview, and fresh-project workflow, and repeat the same `.gitignore`-guided inspection and generated-source cleanup before packaging. Resolve the output directory again and package the existing skill; ChatGPT resolves the matching personal skill and offers **Save changes**:

```bash
SKILL_DIR="$(dirname "<absolute path of this SKILL.md>")"
TEMPLATE_OUTPUT_DIR="/mnt/data"
if [ -d /workspace ]; then
  TEMPLATE_OUTPUT_DIR="/workspace/output"
fi

python3 "$SKILL_DIR/scripts/package-template-skill.py" \
  --skill-directory "$TEMPLATE_OUTPUT_DIR/template-skill-drafts/artifact-template-meeting-notes" \
  --output-path "$TEMPLATE_OUTPUT_DIR/skill.zip"
```

## Response

After verifying the archive, choose the response block matching the creator invocation: use **Create** when the script ran in its default create mode and **Update** when it ran with `--mode update`. Replace each placeholder with the creator result and execution-surface archive link. Respond with only the applicable content between its comment markers. The markers delimit the response template; do not emit them.

### Create response

<!-- TEMPLATE CREATOR CREATE RESPONSE START -->

Here’s your {displayName} template.

### How to find templates

Find it in the **Template Gallery** when @{kind} is added to the prompt.

### How to use a template

Select {displayName} from the Template Gallery and describe what you want to build.

::artifact-template{skill_name="{skillName}" skill_directory="{skillPath}" display_name="{displayName}" artifact_kind="{kind}" archive_link="{archiveLink}"}

<!-- TEMPLATE CREATOR CREATE RESPONSE END -->

### Update response

<!-- TEMPLATE CREATOR UPDATE RESPONSE START -->

Here’s your updated {displayName} template.

### How to find templates

After choosing **Save changes** in the card below, find it in the **Template Gallery** when @{kind} is added to the prompt.

### How to use a template

Select {displayName} from the Template Gallery and describe what you want to build.

::artifact-template{skill_name="{skillName}" skill_directory="{skillPath}" display_name="{displayName}" artifact_kind="{kind}" archive_link="{archiveLink}"}

<!-- TEMPLATE CREATOR UPDATE RESPONSE END -->

Formatting rules:

- Keep the response wording and punctuation unchanged apart from replacing `{displayName}`, `@{kind}`, `{skillName}`, `{skillPath}`, `{kind}`, and `{archiveLink}` and applying the non-gallery substitution below. Do not reproduce these instructions or any generated `SKILL.md`.
- Substitute `@{kind}` with `@Documents` for document and Google Docs templates, `@Presentations` for presentation and Google Slides templates, `@Spreadsheets` for spreadsheet and Google Sheets templates, or `@Sites` for Site templates.
- For image, email, and Slack templates, replace the sentence under **How to find templates** with `Find it in your **Skills** library.` for Create or `After choosing **Save changes** in the card below, find it in your **Skills** library.` for Update. Replace the usage sentence with `Select {displayName} from your Skills library and describe what you want to build.`
- Set `{archiveLink}` to `[Preview your template skill](sandbox:/mnt/data/skill.zip)` for Create in ordinary Chat or `[Preview your template skill](sandbox:/workspace/output/skill.zip)` for Create in ChatGPT Work. For Update, use the same matching path with the label `Save changes to your template skill`. Use the exact `skillName`, `skillPath`, `displayName`, and lowercase `kind` returned by the creator; the skill directory is the real sandbox draft directory, not a fabricated desktop path.
- Put the directive on its own line and escape attribute values when needed so it remains valid. The `archive_link` attribute must contain the complete Markdown link to the verified `skill.zip` archive because ChatGPT uses it to render and save the template or present a fallback download.
- For an explicitly requested batch, use each skill's own archive path, such as `sandbox:/workspace/output/artifact-template-meeting-notes/skill.zip`, and repeat the applicable response block for each archive when the runtime supports separate response cards. Never reference a different or stale archive.
- Do not tell Web users to invoke the installed template with `$`.
- Do not say a new template is installed or available in a gallery before the card confirms the automatic save. Do not say an update is saved before the user chooses **Save changes**. Do not say either is shared with a workspace or synchronized to a desktop.

## Constraints

- Do not search for remote templates. Fetch only the exact Google Workspace source the user supplied or explicitly selected.
- Do not create or edit `request.json` or another intermediary request file.
- Do not delete, sanitize, paraphrase, or replace a user-selected retained artifact-reference file.
- Treat every linked Google Workspace source artifact as read-only. Generated template skills must copy the complete native artifact before making changes.
- For Site projects, retain application source, project configuration, package-manager metadata, static assets, migrations, and logical D1/R2 bindings. Use the project's `.gitignore` to guide cleanup of the generated source, and exclude environment files, credentials, private keys, symlinks, dependencies, caches, build outputs, databases, and runtime or customer data without modifying the original project. Remove the original `project_id` from `.openai/hosting.json`.
- Generated Site templates must resolve `assets/source`, copy its sanitized contents into a fresh empty project directory, and follow the existing Sites building and hosting workflow. Preserve the retained source and logical bindings; do not scaffold over the copied application or reuse the original Site identity or source repository.
- Do not send email or post a Slack message merely because a template was created or invoked.
- Do not create, mutate, publish, or share a workspace plugin or marketplace.
- Do not add Artifact.md package generation here. The artifact plugins own template distillation and creation.
- Do not modify global skill metadata or protocol files.

