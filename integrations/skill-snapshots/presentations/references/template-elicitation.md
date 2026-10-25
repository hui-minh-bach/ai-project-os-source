# Artifact Template Selection

Open the template selection picker for creating new presentations when the user has not provided a template, reference, or visual direction. Also open the picker when the user asks to browse or upload templates. Do not open it if the user declines templates, requests a connected-source design search, or if `list_artifact_templates` is unavailable this turn. Subject matter, audience, tone, company names, and source files do not by themselves specify a template or visual direction.

Call `list_artifact_templates({artifactKind, request})` with `artifactKind: "presentation"`, or `"google-slides"` for Google Slides requests. Include compatible Office and Google templates without changing the requested output format.

Before calling `list_artifact_templates`, paginate `list_mcp_resources({server: "codex_apps"})`. Include every resource whose `_meta.skill_name` starts with `artifact-template-`, even when `allow_implicit_invocation` is `false`. Pass at most 100 resources as `pluginTemplates`: `{skillName: _meta.plugin_name + ":" + _meta.skill_name, resourceUri: uri, pluginId: _meta.plugin_id, pluginReleaseSkillId: _meta.plugin_release_skill_id, title, description: resource.description}`. Pass descriptions unchanged. Wait for a nonempty listing before opening the picker. Do not download a template before the user selects it.

Rank templates by relevance, breaking ties in favor of personal or shared templates. Include a mix of styles. Pass their `skillName` values unchanged to `choose_artifact_template({artifactKind, request, templates})` and call it once. Set `includeAllTemplates: true` only when the user requests the full catalog. The picker displays at most ten templates.

Follow the selected template or uploaded reference. Save an uploaded reference only when `saveForFutureUse` is true. Use Template Creator with the returned `displayName`. Continue without a template if the picker is declined, cancelled, unavailable, or fails. Do not replace the picker with `request_user_input` or a chat list. Browsing templates does not authorize artifact creation.
