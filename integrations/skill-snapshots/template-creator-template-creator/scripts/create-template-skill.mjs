#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const TEMPLATE_PREFIX = "artifact-template-";
const WRITE_LOCK_NAME = ".artifact-template-write-lock";
const LOCK_OWNER_FILENAME = "owner-pid";
const LOCK_OWNER_GRACE_MS = 30_000;
const MAX_SKILL_NAME_LENGTH = 64;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const SITE_SOURCE_EXCLUDED_NAMES = new Set([
  ".aws",
  ".cache",
  ".git",
  ".home",
  ".netrc",
  ".next",
  ".npmrc",
  ".ssh",
  ".turbo",
  ".vercel",
  ".vinext",
  ".wrangler",
  ".xdg",
  ".yarnrc",
  ".yarnrc.yaml",
  ".yarnrc.yml",
  "credentials.json",
  "node_modules",
  "service-account-key.json",
  "service-account.json",
]);
const USAGE =
  "Usage: create-template-skill.mjs --draft-directory <path> --reference-path <path> [--preview-path <path>] --display-name <name> --description <description> [--kind <kind>] [--gallery-kind <kind>] [--source-url <url>] [--mode update --skill-name <name> [--updated-fields display-name,description]]";
const templateKinds = new Map([
  [
    "document",
    {
      kind: "document",
      extension: ".docx",
      output: "a document",
      outputs: "documents",
      preservation:
        "Preserve page setup, sections, styles, lists, tables, headers, footers, and recurring page elements.",
      workflow: getOfficeWorkflow("document"),
    },
  ],
  [
    "presentation",
    {
      kind: "presentation",
      extension: ".pptx",
      output: "a presentation",
      outputs: "presentations",
      preservation:
        "Preserve source slides, layouts, masters, typography, geometry, images, charts, tables, and recurring slide chrome.",
      workflow: getOfficeWorkflow("presentation"),
    },
  ],
  [
    "spreadsheet",
    {
      kind: "spreadsheet",
      extension: ".xlsx",
      output: "a spreadsheet",
      outputs: "spreadsheets",
      preservation:
        "Preserve sheet structure, formulas, names, number formats, dimensions, tables, charts, validation, conditional formatting, and frozen panes.",
      workflow: getOfficeWorkflow("spreadsheet"),
    },
  ],
  [
    "google-docs",
    {
      kind: "google-docs",
      extension: ".png",
      output: "a Google Doc",
      outputs: "Google Docs",
      sourceArtifact: "Google Doc",
      preservation:
        "Preserve the complete tab tree, semantic organization, page setup, sections, styles, lists, tables, headers, footers, links, chips, controls, and recurring page elements.",
      workflow: getGoogleWorkspaceWorkflow("google-docs", "Google Doc"),
    },
  ],
  [
    "google-slides",
    {
      kind: "google-slides",
      extension: ".png",
      output: "a Google Slides presentation",
      outputs: "Google Slides presentations",
      sourceArtifact: "Google Slides presentation",
      preservation:
        "Preserve source slides, layouts, masters, theme, typography, geometry, native objects, media, charts, tables, links, notes, and recurring slide chrome.",
      workflow: getGoogleWorkspaceWorkflow(
        "google-slides",
        "Google Slides presentation",
      ),
    },
  ],
  [
    "google-sheets",
    {
      kind: "google-sheets",
      extension: ".png",
      output: "a Google Sheet",
      outputs: "Google Sheets",
      sourceArtifact: "Google Sheet",
      preservation:
        "Preserve the entire workbook, sheet order and visibility, formulas, names, number formats, dimensions, native tables, chips, charts, validation, conditional formatting, and frozen panes.",
      workflow: getGoogleWorkspaceWorkflow("google-sheets", "Google Sheet"),
    },
  ],
  [
    "site",
    {
      kind: "site",
      extension: null,
      output: "a Site",
      outputs: "Sites",
      preservation:
        "Preserve the source application's pages, components, styles, assets, package configuration, migrations, and logical D1/R2 bindings.",
      workflow: `2. Identify the prompt-advertised preinstalled Sites capability and load its sites-building and sites-hosting skills. If unavailable, say so and stop; do not recreate or install it. Copy the sanitized retained application from \`<skill-dir>/assets/source\`, including hidden files, into a fresh empty project directory. Leave the retained source unchanged and preserve its package configuration, migrations, and logical D1/R2 bindings.
3. Use the copied application as the starting project in the Sites workflow, install its dependencies, and adapt it to the user's request. Do not run a starter initializer over it or reuse the original Site identity or source repository.
4. Build and validate the new Site through the existing Sites workflow. Unless the user asks to keep it local, follow sites-hosting to create the new project identity, configure source control, save the exact validated source, deploy it, and verify success.`,
    },
  ],
  [
    "image",
    {
      kind: "image",
      extension: ".png",
      output: "an image",
      outputs: "images",
      preservation:
        "Preserve the reference image's composition, visual hierarchy, palette, typography, material treatment, lighting, and recurring brand elements.",
      workflow: getImageTemplateWorkflow("imagegen"),
    },
  ],
  [
    "email",
    {
      kind: "email",
      extension: ".txt",
      output: "an email",
      outputs: "emails",
      preservation:
        "Preserve the reference email's voice, information hierarchy, pacing, subject, body, calls to action, and signature conventions.",
      workflow: `2. Read the retained plain-text email and use it as the structural and voice reference.
3. Draft a new plain-text email that preserves the reference's subject, body, calls to action, and signature conventions.
4. Treat the user's prompt and available sources as the content input. Do not invent facts or send the email merely because this skill was invoked.
5. Review the draft for fidelity, completeness, and ready-to-copy plain-text formatting, then return it.`,
    },
  ],
  [
    "slack",
    {
      kind: "slack",
      extension: ".txt",
      output: "a Slack message",
      outputs: "Slack messages",
      preservation:
        "Preserve the reference Slack message's voice, length, structure, formatting, emoji usage, mentions, links, and call-to-action conventions.",
      workflow: `2. Read the retained plain-text Slack message and use it as the structural and voice reference.
3. Draft a new Slack message that follows the reference's length, structure, formatting, and call-to-action conventions.
4. Treat the user's prompt and available sources as the content input. Do not invent facts or post the message merely because this skill was invoked.
5. Review the draft for fidelity, completeness, and ready-to-copy plain-text formatting, then return it.`,
    },
  ],
]);
const inferredTemplateKindByExtension = new Map([
  [".docx", "document"],
  [".pptx", "presentation"],
  [".xlsx", "spreadsheet"],
  [".png", "image"],
]);
const googleWorkspacePathByKind = new Map([
  ["google-docs", "document"],
  ["google-slides", "presentation"],
  ["google-sheets", "spreadsheets"],
]);

async function createTemplateSkill(rawRequest) {
  const request = await validateRequest(rawRequest);
  const skillsRoot = request.draftDirectory;
  const releaseLock = await acquireWriteLock(
    path.join(skillsRoot, WRITE_LOCK_NAME),
  );
  try {
    const identity =
      request.mode === "update"
        ? await getUpdateIdentity(skillsRoot, request, request.template)
        : await getCreateIdentity(skillsRoot, request.displayName);
    const skillPath = path.join(skillsRoot, identity.skillName);
    const stagedSkill = await stageTemplateSkill({
      description: request.description,
      displayName: identity.displayName,
      parentDirectory: skillsRoot,
      previewPath: request.previewPath,
      referencePath: request.referencePath,
      skillName: identity.skillName,
      sourceUrl: request.sourceUrl,
      sourceSkillPath: request.mode === "update" ? skillPath : null,
      template: request.template,
      updatedFields: request.updatedFields,
    });
    try {
      if (request.mode === "update") {
        await replaceTemplateSkill(stagedSkill, skillPath);
      } else {
        await fs.rename(stagedSkill, skillPath);
      }
    } catch (error) {
      await fs.rm(stagedSkill, { force: true, recursive: true });
      throw error;
    }
    return {
      displayName: identity.displayName,
      kind: request.template.kind,
      ...(request.template.galleryKind == null
        ? {}
        : { galleryKind: request.template.galleryKind }),
      skillName: identity.skillName,
      skillPath,
    };
  } finally {
    await releaseLock();
  }
}

async function validateRequest(rawRequest) {
  const mode = rawRequest.mode ?? "create";
  if (mode !== "create" && mode !== "update") {
    throw new Error("--mode must be 'create' or 'update'.");
  }
  const displayName = getRequiredString(
    rawRequest,
    "displayName",
    "--display-name",
  );
  const description = getRequiredString(
    rawRequest,
    "description",
    "--description",
  );
  const draftDirectory = path.resolve(
    getRequiredString(rawRequest, "draftDirectory", "--draft-directory"),
  );
  assertSingleLine(displayName, "--display-name", 64);
  assertSingleLine(description, "--description", 600);
  const referencePath = path.resolve(
    getRequiredString(rawRequest, "referencePath", "--reference-path"),
  );
  const extension = path.extname(referencePath).toLowerCase();
  const requestedKind = getOptionalString(rawRequest, "kind", "--kind");
  const requestedGalleryKind = getOptionalString(
    rawRequest,
    "galleryKind",
    "--gallery-kind",
  );
  const requestedSourceUrl = getOptionalString(
    rawRequest,
    "sourceUrl",
    "--source-url",
  );
  if (extension === ".txt" && requestedKind == null) {
    throw new Error("--kind must be 'email' or 'slack' for a .txt reference.");
  }
  const kind = requestedKind ?? inferredTemplateKindByExtension.get(extension);
  const baseTemplate = kind == null ? null : templateKinds.get(kind);
  if (baseTemplate == null) {
    if (requestedKind != null) {
      throw new Error(
        "--kind must be 'document', 'presentation', 'spreadsheet', 'google-docs', 'google-slides', 'google-sheets', 'site', 'image', 'email', or 'slack'.",
      );
    }
    throw new Error(
      "--reference-path must end in .docx, .pptx, .xlsx, .png, or .txt.",
    );
  }
  if (baseTemplate.kind !== "image" && requestedGalleryKind != null) {
    throw new Error("--gallery-kind is only valid for image templates.");
  }
  const galleryKind =
    baseTemplate.kind === "image" ? (requestedGalleryKind ?? "imagegen") : null;
  const template =
    galleryKind == null
      ? baseTemplate
      : {
          ...baseTemplate,
          galleryKind,
          workflow: getImageTemplateWorkflow(galleryKind),
        };
  if (template.sourceArtifact == null && requestedSourceUrl != null) {
    throw new Error(
      "--source-url is only valid for Google Docs, Slides, or Sheets templates.",
    );
  }
  if (template.sourceArtifact != null && requestedSourceUrl == null) {
    throw new Error(`--source-url is required for ${template.kind}.`);
  }
  const sourceUrl =
    requestedSourceUrl == null
      ? null
      : getCanonicalGoogleWorkspaceUrl(requestedSourceUrl, template.kind);
  const previewPath =
    template.kind === "site"
      ? fileURLToPath(new URL("../assets/site-preview.png", import.meta.url))
      : path.resolve(
          getRequiredString(rawRequest, "previewPath", "--preview-path"),
        );
  if (template.kind === "site") {
    if (!(await fs.lstat(referencePath)).isDirectory()) {
      throw new Error(
        "--reference-path must point to a Site project directory.",
      );
    }
    if (
      !(
        await fs.lstat(path.join(referencePath, ".openai", "hosting.json"))
      ).isFile()
    ) {
      throw new Error("Site hosting metadata must point to a regular file.");
    }
  } else {
    if (extension !== template.extension) {
      throw new Error(
        `--kind ${template.kind} requires a ${template.extension} reference.`,
      );
    }
    await Promise.all([
      assertRegularFile(referencePath, "--reference-path"),
      assertRegularFile(previewPath, "--preview-path"),
    ]);
    if (path.extname(previewPath).toLowerCase() !== ".png") {
      throw new Error("--preview-path must end in .png.");
    }
    if (!hasValidPngStructure(await fs.readFile(previewPath))) {
      throw new Error("--preview-path must contain a valid PNG.");
    }
    if (
      template.extension === ".png" &&
      !hasValidPngStructure(await fs.readFile(referencePath))
    ) {
      throw new Error("--reference-path must contain a valid PNG.");
    }
  }

  const skillName = getOptionalString(rawRequest, "skillName", "--skill-name");
  if (mode === "update") {
    if (skillName == null) {
      throw new Error("--skill-name is required for an explicit update.");
    }
    assertSkillName(skillName);
  } else if (skillName != null) {
    throw new Error("--skill-name is only valid when --mode is 'update'.");
  }

  const requestedUpdatedFields = getOptionalString(
    rawRequest,
    "updatedFields",
    "--updated-fields",
  );
  if (requestedUpdatedFields != null && mode !== "update") {
    throw new Error("--updated-fields is only valid when --mode is 'update'.");
  }
  const updatedFields = new Set(requestedUpdatedFields?.split(",") ?? []);
  for (const updatedField of updatedFields) {
    if (updatedField !== "display-name" && updatedField !== "description") {
      throw new Error(
        "--updated-fields may contain only 'display-name' and 'description'.",
      );
    }
  }

  return {
    description,
    displayName,
    draftDirectory,
    mode,
    previewPath,
    referencePath,
    skillName,
    sourceUrl,
    template,
    updatedFields,
  };
}

async function getCreateIdentity(skillsRoot, displayName) {
  const slug = getSlug(displayName);
  for (let index = 1; ; index += 1) {
    const suffix = index === 1 ? "" : `-${index}`;
    const baseLength = MAX_SKILL_NAME_LENGTH - suffix.length;
    const skillName =
      `${TEMPLATE_PREFIX}${slug}`.slice(0, baseLength).replace(/-+$/u, "") +
      suffix;
    if (!(await pathExists(path.join(skillsRoot, skillName)))) {
      return {
        displayName: index === 1 ? displayName : `${displayName} ${index}`,
        skillName,
      };
    }
  }
}

async function getUpdateIdentity(skillsRoot, request, template) {
  const skillPath = path.join(skillsRoot, request.skillName);
  const sidecarPath = path.join(skillPath, "artifact-template.json");
  const sidecar = JSON.parse(await fs.readFile(sidecarPath, "utf8"));
  const sidecarGalleryKind =
    sidecar.kind === "image" ? (sidecar.galleryKind ?? "imagegen") : null;
  if (
    sidecar.schemaVersion !== 1 ||
    sidecar.kind !== template.kind ||
    sidecarGalleryKind !== (template.galleryKind ?? null)
  ) {
    throw new Error(
      `${request.skillName} is not a version 1 ${template.galleryKind ?? template.kind} artifact template.`,
    );
  }
  return { displayName: request.displayName, skillName: request.skillName };
}

async function stageTemplateSkill({
  description,
  displayName,
  parentDirectory,
  previewPath,
  referencePath,
  skillName,
  sourceUrl,
  sourceSkillPath,
  template,
  updatedFields,
}) {
  await fs.mkdir(parentDirectory, { recursive: true });
  const stagedSkill = await fs.mkdtemp(
    path.join(parentDirectory, `.${skillName}-stage-`),
  );
  const referenceFilename =
    template.kind === "site" ? "source" : `reference${template.extension}`;
  try {
    if (sourceSkillPath != null) {
      await fs.cp(sourceSkillPath, stagedSkill, {
        filter: async (sourcePath) => {
          if ((await fs.lstat(sourcePath)).isSymbolicLink()) {
            throw new Error(
              `Template skill cannot contain symlinks: ${sourcePath}`,
            );
          }
          return true;
        },
        recursive: true,
      });
    }
    await Promise.all([
      fs.mkdir(path.join(stagedSkill, "agents"), { recursive: true }),
      fs.mkdir(path.join(stagedSkill, "assets"), { recursive: true }),
    ]);
    const preserveSiteSource =
      sourceSkillPath != null &&
      template.kind === "site" &&
      referencePath === path.join(sourceSkillPath, "assets", "source");
    const siteSourcePaths =
      template.kind === "site" &&
      !preserveSiteSource &&
      (await pathExists(path.join(referencePath, ".git")))
        ? new Set(
            execFileSync(
              "git",
              [
                "-C",
                referencePath,
                "ls-files",
                "--cached",
                "--others",
                "--exclude-standard",
                "-z",
              ],
              { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
            )
              .split("\0")
              .filter(Boolean),
          )
        : null;
    if (siteSourcePaths != null) {
      siteSourcePaths.add(path.join(".openai", "hosting.json"));
      for (const sourcePath of [...siteSourcePaths]) {
        let parentPath = path.dirname(sourcePath);
        while (parentPath !== ".") {
          siteSourcePaths.add(parentPath);
          parentPath = path.dirname(parentPath);
        }
      }
    }
    if (
      sourceSkillPath != null &&
      template.kind === "site" &&
      !preserveSiteSource
    ) {
      await fs.rm(path.join(stagedSkill, "assets", "source"), {
        force: true,
        recursive: true,
      });
    }
    const fileWrites = [];
    if (!preserveSiteSource) {
      fileWrites.push(
        template.kind === "site"
          ? fs.cp(referencePath, path.join(stagedSkill, "assets", "source"), {
              filter: async (sourcePath) => {
                const relativePath = path.relative(referencePath, sourcePath);
                if (relativePath === "") {
                  return true;
                }

                const entryName = path.basename(sourcePath).toLowerCase();
                return (
                  (siteSourcePaths == null ||
                    siteSourcePaths.has(relativePath)) &&
                  !SITE_SOURCE_EXCLUDED_NAMES.has(entryName) &&
                  ![
                    "coverage",
                    "dist",
                    "out",
                    "outputs",
                    "private",
                    "work",
                  ].includes(relativePath.toLowerCase()) &&
                  !entryName.startsWith(".env") &&
                  !entryName.startsWith(".dev.vars") &&
                  !entryName.endsWith("-service-account.json") &&
                  !/\.(?:db|sqlite3?|key|p12|pem|pfx)(?:-(?:journal|shm|wal))?$/u.test(
                    entryName,
                  ) &&
                  !(await fs.lstat(sourcePath)).isSymbolicLink()
                );
              },
              recursive: true,
            })
          : fs.copyFile(
              referencePath,
              path.join(stagedSkill, "assets", referenceFilename),
            ),
      );
    }
    if (sourceSkillPath == null || template.kind !== "site") {
      fileWrites.push(
        fs.copyFile(
          previewPath,
          path.join(stagedSkill, "assets", "preview.png"),
        ),
      );
    }
    if (sourceSkillPath == null) {
      fileWrites.push(
        fs.writeFile(
          path.join(stagedSkill, "SKILL.md"),
          getTemplateSkillMarkdown({
            description,
            displayName,
            skillName,
            template,
          }),
        ),
        fs.writeFile(
          path.join(stagedSkill, "agents", "openai.yaml"),
          getTemplateOpenAiYaml({ displayName, template }),
        ),
        fs.writeFile(
          path.join(stagedSkill, "artifact-template.json"),
          `${JSON.stringify(
            {
              schemaVersion: 1,
              kind: template.kind,
              ...(template.galleryKind == null
                ? {}
                : { galleryKind: template.galleryKind }),
              ...(sourceUrl == null ? {} : { sourceUrl }),
              reference: `assets/${referenceFilename}`,
              preview: "assets/preview.png",
            },
            null,
            2,
          )}\n`,
        ),
      );
    } else {
      if (sourceUrl != null) {
        fileWrites.push(updateTemplateSourceUrl(stagedSkill, sourceUrl));
      }
      if (updatedFields.size > 0) {
        fileWrites.push(
          updateTemplateMetadata({
            description,
            displayName,
            skillName,
            skillPath: stagedSkill,
            template,
            updatedFields,
          }),
        );
      }
    }
    await Promise.all(fileWrites);
    if (template.kind === "site" && !preserveSiteSource) {
      const hostingPath = path.join(
        stagedSkill,
        "assets",
        "source",
        ".openai",
        "hosting.json",
      );
      const hosting = JSON.parse(await fs.readFile(hostingPath, "utf8"));
      delete hosting.project_id;
      await fs.writeFile(hostingPath, `${JSON.stringify(hosting, null, 2)}\n`);

      const yarnConfigPath = path.join(referencePath, ".yarnrc.yml");
      if (
        (siteSourcePaths == null || siteSourcePaths.has(".yarnrc.yml")) &&
        (await pathExists(yarnConfigPath)) &&
        (await fs.lstat(yarnConfigPath)).isFile()
      ) {
        const safeSettings = new Map();
        for (const line of (await fs.readFile(yarnConfigPath, "utf8")).split(
          /\r?\n/u,
        )) {
          const setting = line.match(
            /^(nodeLinker|yarnPath):[\t ]*(?:"([^"]+)"|'([^']+)'|([^\t #]+))[\t ]*(?:#.*)?$/u,
          );
          if (setting == null) {
            continue;
          }
          const [, name, doubleQuoted, singleQuoted, bare] = setting;
          const value = doubleQuoted ?? singleQuoted ?? bare;
          const isSafe =
            name === "nodeLinker"
              ? /^(?:node-modules|pnp|pnpm)$/u.test(value)
              : /^(?:\.\/)?\.yarn\/releases\/[A-Za-z0-9_.-]+\.c?js$/u.test(
                  value,
                );
          if (isSafe) {
            safeSettings.set(name, value);
          }
        }
        if (safeSettings.size > 0) {
          await fs.writeFile(
            path.join(stagedSkill, "assets", "source", ".yarnrc.yml"),
            `${Array.from(safeSettings, ([name, value]) => `${name}: ${value}`).join("\n")}\n`,
          );
        }
      }
    }
    return stagedSkill;
  } catch (error) {
    await fs.rm(stagedSkill, { force: true, recursive: true });
    throw error;
  }
}

async function updateTemplateSourceUrl(skillPath, sourceUrl) {
  const manifestPath = path.join(skillPath, "artifact-template.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  manifest.sourceUrl = sourceUrl;
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function updateTemplateMetadata({
  description,
  displayName,
  skillName,
  skillPath,
  template,
  updatedFields,
}) {
  const instructionsPath = path.join(skillPath, "SKILL.md");
  const instructions = await fs.readFile(instructionsPath, "utf8");
  const heading = instructions.match(/^# ([^\r\n]+)$/mu);
  if (heading == null) {
    throw new Error(
      "The existing template must contain its display-name heading.",
    );
  }
  const previousDisplayName = heading[1];
  const nextDisplayName = updatedFields.has("display-name")
    ? displayName
    : previousDisplayName;
  let updatedInstructions = instructions;
  if (updatedFields.has("display-name")) {
    updatedInstructions = updatedInstructions.replace(
      /^# [^\r\n]+$/mu,
      () => `# ${nextDisplayName}`,
    );
  }
  if (updatedFields.has("description") || updatedFields.has("display-name")) {
    const descriptionLine = instructions.match(/^description: (.+)$/mu);
    if (descriptionLine == null) {
      throw new Error(
        "The existing template must contain its frontmatter description.",
      );
    }
    const previousDescription = descriptionLine[1].startsWith('"')
      ? JSON.parse(descriptionLine[1])
      : null;
    const existingPrefix = [
      getTemplateTriggerDescription({
        description: "",
        displayName: previousDisplayName,
        template,
      }),
      getLegacyTemplateTriggerDescription({
        description: "",
        displayName: previousDisplayName,
        skillName,
        template,
      }),
    ].find((prefix) => previousDescription?.startsWith(prefix));
    if (updatedFields.has("description") || existingPrefix != null) {
      const nextDescription = updatedFields.has("description")
        ? description
        : previousDescription.slice(existingPrefix.length);
      updatedInstructions = updatedInstructions.replace(
        /^description: .+$/mu,
        () =>
          `description: ${JSON.stringify(
            getTemplateTriggerDescription({
              description: nextDescription,
              displayName: nextDisplayName,
              template,
            }),
          )}`,
      );
    }
  }
  await fs.writeFile(instructionsPath, updatedInstructions);

  if (updatedFields.has("display-name")) {
    const agentPath = path.join(skillPath, "agents", "openai.yaml");
    const agentMetadata = await fs.readFile(agentPath, "utf8");
    const existingDisplayName = agentMetadata.match(
      /^(\s*display_name:) .+$/mu,
    );
    if (existingDisplayName == null) {
      throw new Error(
        "The existing template must contain its agent display name.",
      );
    }
    let updatedAgentMetadata = agentMetadata.replace(
      /^(\s*display_name:) .+$/mu,
      (_match, prefix) => `${prefix} ${JSON.stringify(nextDisplayName)}`,
    );
    const previousShortDescription = getTemplateShortDescription({
      displayName: previousDisplayName,
      template,
    });
    const shortDescriptionLine = agentMetadata.match(
      /^(\s*short_description:) (.+)$/mu,
    );
    if (
      shortDescriptionLine != null &&
      shortDescriptionLine[2].startsWith('"') &&
      JSON.parse(shortDescriptionLine[2]) === previousShortDescription
    ) {
      updatedAgentMetadata = updatedAgentMetadata.replace(
        /^(\s*short_description:) .+$/mu,
        (_match, prefix) =>
          `${prefix} ${JSON.stringify(
            getTemplateShortDescription({
              displayName: nextDisplayName,
              template,
            }),
          )}`,
      );
    }
    const defaultPromptLine = agentMetadata.match(
      /^(\s*default_prompt:) (.+)$/mu,
    );
    if (
      defaultPromptLine != null &&
      defaultPromptLine[2].startsWith('"') &&
      JSON.parse(defaultPromptLine[2]) ===
        getTemplateDefaultPrompt({
          displayName: previousDisplayName,
          template,
        })
    ) {
      updatedAgentMetadata = updatedAgentMetadata.replace(
        /^(\s*default_prompt:) .+$/mu,
        (_match, prefix) =>
          `${prefix} ${JSON.stringify(
            getTemplateDefaultPrompt({
              displayName: nextDisplayName,
              template,
            }),
          )}`,
      );
    }
    await fs.writeFile(agentPath, updatedAgentMetadata);
  }
}

function getTemplateSkillMarkdown({
  description,
  displayName,
  skillName,
  template,
}) {
  const preservationInstruction =
    template.kind === "site"
      ? "Keep the source directory unchanged."
      : template.sourceArtifact == null
        ? "Keep the reference file unchanged."
        : `Keep the source ${template.sourceArtifact} and reference image unchanged.`;
  const triggerDescription = getTemplateTriggerDescription({
    description,
    displayName,
    skillName,
    template,
  });
  return `---
name: ${skillName}
description: ${JSON.stringify(triggerDescription)}
---

# ${displayName}

Create ${template.output} from this template. ${preservationInstruction}

## Workflow

1. Read \`artifact-template.json\` and resolve its paths relative to this skill directory.
${template.workflow}

## Fidelity

${template.preservation}

User instructions control requested content and explicit deviations. The retained reference controls layout and formatting where the user has not requested a change.
`;
}

function getTemplateTriggerDescription({
  description,
  displayName,
  template,
}) {
  const referenceDescription =
    template.kind === "site"
      ? "retained source directory"
      : template.sourceArtifact == null
        ? "retained reference file"
        : `linked ${template.sourceArtifact} and retained reference image`;
  return `Create ${template.output} using the ${displayName} template and its ${referenceDescription}. Use when the user selects this template, selects this personal skill, or names ${displayName}. ${description}`;
}

function getLegacyTemplateTriggerDescription({
  description,
  displayName,
  skillName,
  template,
}) {
  const referenceDescription =
    template.kind === "site"
      ? "retained source directory"
      : "retained reference file";
  return `Create ${template.output} using the ${displayName} template and its ${referenceDescription}. Use when the user selects this template, names ${displayName}, or explicitly invokes $${skillName}. ${description}`;
}

function getOfficeWorkflow(output) {
  const capability =
    output === "presentation" ? "presentation or slides" : output;
  return `2. Identify the prompt-advertised preinstalled ${capability} capability. Use the available resource or filesystem tool to open its advertised resource, plugin, skill, or file target, then follow its reference/template workflow with the retained file. If no such capability can be identified and read, say it is unavailable and stop; do not recreate or install it.
3. Treat the user's prompt and available sources as the content input. Do not invent facts merely to fill a template slot.
4. Clone or import the reference instead of replacing its visual system with generic defaults.
5. Render and verify the finished ${output}, then return the final artifact.`;
}

function getGoogleWorkspaceWorkflow(skillName, sourceArtifact) {
  return `2. Identify the prompt-advertised connected Google Drive capability, load its ${skillName} workflow, and treat \`sourceUrl\` as the native template reference. If the capability or source cannot be read, say so and stop; do not rebuild the template through an Office file.
3. Keep the source read-only. Copy the complete ${sourceArtifact} before editing, then follow the connected capability's native reference/template workflow.
4. Treat the user's prompt and available sources as the content input. Do not invent facts merely to fill a template slot or carry stale reference facts into the result.
5. Adapt the copied native structure instead of rebuilding it or replacing its visual system with generic defaults.
6. Verify the finished ${sourceArtifact} with the capability's required structural and visual checks, then return its Google Drive link.`;
}

function getImageTemplateWorkflow(galleryKind) {
  switch (galleryKind) {
    case "imagegen":
      return `2. Invoke $imagegen with the retained PNG as a reference image and the user's requested content as the edit or generation brief.
3. Treat the user's prompt and available sources as the content input. Do not invent factual claims merely to fill the composition.
4. Preserve the reference's visual language unless the user explicitly requests a deviation.
5. Visually inspect the generated image for fidelity and defects, then return the final image.`;
    case "product-design":
      return `2. Identify the prompt-advertised Product Design capability and use the retained PNG as the visual template for the user's requested product-design workflow. If Product Design is unavailable, say so and stop; do not recreate or install it.
3. Treat the user's prompt and available sources as the content input. Do not invent factual claims merely to fill the composition.
4. Preserve the reference's visual language unless the user explicitly requests a deviation.
5. Follow the Product Design workflow through visual verification, then return its final result.`;
    default:
      throw new Error("--gallery-kind must be 'imagegen' or 'product-design'.");
  }
}

function getTemplateOpenAiYaml({ displayName, template }) {
  const shortDescription = getTemplateShortDescription({
    displayName,
    template,
  });
  return `interface:
  display_name: ${JSON.stringify(displayName)}
  short_description: ${JSON.stringify(shortDescription)}
  icon_small: "./assets/preview.png"
  icon_large: "./assets/preview.png"
  default_prompt: ${JSON.stringify(
    getTemplateDefaultPrompt({ displayName, template }),
  )}
policy:
  allow_implicit_invocation: true
`;
}

function getTemplateDefaultPrompt({ displayName, template }) {
  return `Create ${template.output} using the ${displayName} template.`;
}

function getTemplateShortDescription({ displayName, template }) {
  const candidate = `Create ${template.outputs} with the ${displayName} template`;
  return candidate.length <= 64
    ? candidate
    : `Create ${template.output} from this saved template`;
}

async function replaceTemplateSkill(stagedPath, finalPath) {
  const backupPath = `${finalPath}.backup-${randomUUID()}`;
  await fs.rename(finalPath, backupPath);
  try {
    await fs.rename(stagedPath, finalPath);
  } catch (error) {
    try {
      await fs.rename(backupPath, finalPath);
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Template update failed and rollback was incomplete.",
      );
    }
    throw error;
  }
  await fs.rm(backupPath, { force: true, recursive: true });
}

async function acquireWriteLock(lockPath) {
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  let canRecover = true;
  while (true) {
    try {
      await fs.mkdir(lockPath);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }
      if (canRecover && (await isWriteLockStale(lockPath))) {
        await fs.rm(lockPath, { force: true, recursive: true });
        canRecover = false;
        continue;
      }
      throw new Error(
        `Another artifact template write is already in progress at ${lockPath}.`,
      );
    }
  }
  try {
    await fs.writeFile(
      path.join(lockPath, LOCK_OWNER_FILENAME),
      `${process.pid}\n`,
    );
  } catch (error) {
    await fs.rm(lockPath, { force: true, recursive: true });
    throw error;
  }
  return () => fs.rm(lockPath, { force: true, recursive: true });
}

async function isWriteLockStale(lockPath) {
  const owner = await fs
    .readFile(path.join(lockPath, LOCK_OWNER_FILENAME), "utf8")
    .catch((error) => {
      if (error?.code === "ENOENT") {
        return null;
      }
      throw error;
    });
  const ownerPid = Number(owner);
  if (Number.isSafeInteger(ownerPid) && ownerPid > 0) {
    try {
      process.kill(ownerPid, 0);
      return false;
    } catch (error) {
      if (error?.code === "ESRCH") {
        return true;
      }
      if (error?.code === "EPERM") {
        return false;
      }
      throw error;
    }
  }
  return Date.now() - (await fs.stat(lockPath)).mtimeMs > LOCK_OWNER_GRACE_MS;
}

function getSlug(displayName) {
  const slug = displayName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  if (slug.length === 0) {
    throw new Error(
      "--display-name must contain at least one ASCII letter or number.",
    );
  }
  return slug;
}

function getCanonicalGoogleWorkspaceUrl(sourceUrl, kind) {
  const workspacePath = googleWorkspacePathByKind.get(kind);
  if (workspacePath == null) {
    throw new Error(
      "--source-url is only valid for Google Docs, Slides, or Sheets templates.",
    );
  }

  let url;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new Error("--source-url must be a valid Google Drive URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== ""
  ) {
    throw new Error("--source-url must be a valid Google Drive URL.");
  }

  const segments = url.pathname.split("/").filter((segment) => segment !== "");
  const idMarkerIndex = segments.indexOf("d");
  const fileId =
    idMarkerIndex >= 0 ? (segments[idMarkerIndex + 1] ?? null) : null;
  if (
    url.hostname !== "docs.google.com" ||
    segments[0] !== workspacePath ||
    fileId == null ||
    (fileId === "e" && segments[idMarkerIndex + 2] != null) ||
    !/^[A-Za-z0-9_-]+$/u.test(fileId)
  ) {
    throw new Error(`--source-url must identify a ${kind} file.`);
  }
  const resourceKey = url.searchParams.get("resourcekey");
  return `https://docs.google.com/${workspacePath}/d/${fileId}/edit${resourceKey == null ? "" : `?resourcekey=${encodeURIComponent(resourceKey)}`}`;
}

function assertSkillName(skillName) {
  if (
    skillName.length > MAX_SKILL_NAME_LENGTH ||
    !/^artifact-template-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(skillName)
  ) {
    throw new Error(
      "--skill-name must be a valid artifact-template skill name.",
    );
  }
}

function assertSingleLine(value, label, maxLength) {
  if (/[<>]/u.test(value)) {
    throw new Error(`${label} must not contain angle brackets.`);
  }
  if (value.length > maxLength || /[\0\r\n]/u.test(value)) {
    throw new Error(
      `${label} must be one line of at most ${maxLength} characters.`,
    );
  }
}

function hasValidPngStructure(bytes) {
  if (
    bytes.length < PNG_SIGNATURE.length ||
    !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    return false;
  }
  let offset = PNG_SIGNATURE.length;
  let firstChunk = true;
  while (offset + 12 <= bytes.length) {
    const dataLength = bytes.readUInt32BE(offset);
    const dataStart = offset + 8;
    const crcOffset = dataStart + dataLength;
    const nextOffset = crcOffset + 4;
    if (nextOffset > bytes.length) {
      return false;
    }
    const type = bytes.toString("ascii", offset + 4, dataStart);
    if (firstChunk && (type !== "IHDR" || dataLength !== 13)) {
      return false;
    }
    if (
      crc32(bytes.subarray(offset + 4, crcOffset)) !==
      bytes.readUInt32BE(crcOffset)
    ) {
      return false;
    }
    if (type === "IEND") {
      return dataLength === 0 && nextOffset === bytes.length;
    }
    firstChunk = false;
    offset = nextOffset;
  }
  return false;
}

function crc32(bytes) {
  if (typeof zlib.crc32 === "function") {
    return zlib.crc32(bytes);
  }

  let checksum = 0xffffffff;
  for (const byte of bytes) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
    }
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

async function assertRegularFile(filePath, label) {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) {
    throw new Error(`${label} must point to a file.`);
  }
}

function getRequiredString(value, key, label) {
  const entry = value[key];
  if (typeof entry !== "string" || entry.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return entry.trim();
}

function getOptionalString(value, key, label) {
  const entry = value[key];
  if (entry == null) {
    return null;
  }
  if (typeof entry !== "string" || entry.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string when provided.`);
  }
  return entry.trim();
}

async function pathExists(filePath) {
  return fs
    .access(filePath)
    .then(() => true)
    .catch((error) => {
      if (error?.code === "ENOENT") {
        return false;
      }
      throw error;
    });
}

const requestFlagToKey = new Map([
  ["--draft-directory", "draftDirectory"],
  ["--mode", "mode"],
  ["--skill-name", "skillName"],
  ["--updated-fields", "updatedFields"],
  ["--kind", "kind"],
  ["--gallery-kind", "galleryKind"],
  ["--source-url", "sourceUrl"],
  ["--reference-path", "referencePath"],
  ["--preview-path", "previewPath"],
  ["--display-name", "displayName"],
  ["--description", "description"],
]);

function getRequestFromArguments(args) {
  if (args.length === 0 || args.length % 2 !== 0) {
    throw new Error(USAGE);
  }

  const request = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const key = requestFlagToKey.get(flag);
    if (key == null || Object.hasOwn(request, key)) {
      throw new Error(USAGE);
    }
    request[key] = args[index + 1];
  }
  return request;
}

async function main() {
  const request = getRequestFromArguments(process.argv.slice(2));
  const result = await createTemplateSkill(request);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
