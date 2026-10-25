# Library management, restore, and protected artifacts

Read this reference before moving, renaming, deleting, restoring, or otherwise
mutating Library nodes.

## Protected Deep Research reports

Deep Research reports in Library are protected, read-only snapshots. Identify
one when Library or search metadata contains
`library_artifact_type: deep_research_report`. For legacy results without that
metadata, also treat backing JSON containing `backing_conversation_id`,
`widget_session_id`, and `widget_state` as a Deep Research report.

Never edit, replace, overwrite, restore, delete, or otherwise mutate a Deep
Research report or its backing JSON. If the user wants modified content, offer
to create a separate editable copy, but create it only after the user agrees.

If classification is unclear, inspect metadata or content using read-only
operations before mutation. If it remains unclear, do not mutate the item.

## Site-backed Library items

An item with `library_artifact_type: site` represents the Site identified by
`site_metadata.project_id`; its Library record is only a projection. `list`,
`search`, `read`, and `find` remain available. `manage_library` can move the
projection into a folder, but renaming it must update the canonical Site title.
Deleting it deletes the Site itself, so proceed only when the user explicitly
asks to delete that Site.

Never materialize, download, patch, replace, update, overwrite, or restore a
Site projection. It has no user-facing file payload, and Sites owns its content,
versions, and publish history. Route Site content or version changes through
Sites rather than generic Library mutation tools.

## Create folders and move files

Use `manage_library` with `create_folder` and the requested Library `path`. The
returned `directory_id` is the destination id for later moves.

Resolve each source file with Library `search` or `list`, then use `move` with
files-tool node refs:

```json
{
  "source": {"kind": "file", "library_file_id": "<id>"},
  "destination": {"kind": "folder", "id": "<directory_id>"}
}
```

Reuse the returned folder id for several moves into the same newly created
folder. Do not use `update` merely to move a file; `update` records content
replacement and versioning.

## Rename and delete

Use `rename` with `target: {"kind": "file", "library_file_id": "..."}` or
`target: {"kind": "folder", "id": "..."}`, plus `new_name`.

Use `delete` with the same target node shapes only when the user explicitly
asks to delete. File deletion moves the file to trash. Deleting a non-empty
folder subtree requires `recursive: true` and explicit user intent.

## Restore a version

Use `manage_library` with `restore_version` only when the user explicitly wants
an older version to become current. Pass `library_file_id`, `version_number`,
and, when known, `expected_current_version`, `file_name`, and `version_reason`.

Restore itself requires no upload or download. Materialize afterward only when
the user also wants to inspect or edit the restored bytes or exact verification
is required.

For exact verification, compare materialized bytes directly or by SHA-256 with
the requested historical version. Search can lag or surface superseded content;
use it only as supporting evidence after restore. Stale search metadata is a
Library caveat, not a reason to invent a caller-side repair.

## Inspect mutation results

Inspect every `manage_library` `results[].status`. A top-level call can succeed
while an individual move, rename, delete, update, or restore result is failed;
use its `message` and `error_code` to report or recover. Do not invent ids,
paths, versions, or mutation support.
