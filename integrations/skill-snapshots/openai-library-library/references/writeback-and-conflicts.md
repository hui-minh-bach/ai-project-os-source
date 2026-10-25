# Library writeback and version conflicts

Read this reference for direct create batches, detailed Library-backed edits,
replacement, writeback correlation, or version-conflict resolution. Use
`prepared-uploads.md` for prepared byte transfer and finalization mechanics.

## Direct create

Use direct `create_library_file(file=...)` for exactly one local file confirmed
under about 50 MiB, or when the prepared upload tools are unavailable.

1. Confirm the absolute local path exists.
2. Call `create_library_file` with that path in `file`.
3. Inspect the returned writeback metadata and apply its complete `xattrs`, or
   `[]`, to the original path with `library_file_transfer.py apply-xattrs`.
4. Keep the returned `library_file_id`, `file_id`, filename, path, and version
   with that local path. Later edits replace this item; they do not create
   another one.

Use returned `file_name` and `path` as the source of truth. Library can rename a
new item when its requested destination is already occupied.

When prepared tools are unavailable and every write is a create, use ordered
`create_library_file(files=[...])` batches when `files` is surfaced. Keep each
call under 500 MB total and at no more than 20 files. Inspect `results` in
request order and persist identity for every successful item. Otherwise create
sequentially.

## Edit and replace

Use this flow whenever the file already has Library identity, including a file
materialized from Library and a newly uploaded local file after create returns
its `library_file_id`.

1. Edit the existing local working file when possible. If no working copy
   remains, materialize the current Library item first.
2. If the editor must write another output path, that output is still the
   replacement artifact for the same Library item.
3. Validate the edited artifact with its format-specific workflow.
4. Choose the upload route before writing. Use the prepared flow when both
   prepared tools are surfaced and this task writes several files or this file
   is around 50 MiB or larger. Otherwise call `replace_library_file` with the
   same `library_file_id` and the absolute local path.
5. Pass a retained concrete current version as `expected_current_version` and
   a short `version_reason` when clear. Do not invent a version.
6. Apply returned xattrs and identity to the replacement local path, then report
   the returned version metadata.

Never call create merely because an edit produced a new path. Create only when
no Library identity exists or the user explicitly wants an independent copy.

## Correlate write results

After create, replace, or finalize:

- Inspect every per-item status. Top-level success does not imply every item
  succeeded.
- Pair results with original local paths by request order.
- Use returned names and paths as authoritative.
- Keep each successful `library_file_id`, `file_id`, and version with the
  correct path.
- Apply the complete returned xattrs array, or `[]`, in one helper call. Do not
  set attributes individually.

## Resolve a version conflict

Use this flow only when replacement reports a version conflict. Keep the same
`library_file_id`; do not search for the file again or remove the version guard.

1. Call Library `read` with the same `library_file_id` in `read[0].ref_id`:
   `{"read":[{"ref_id":"<same library_file_id>"}]}`. Keep the `read` array even
   for one file. Load the exact current item and understand the intervening update.
2. When local bytes are required, call `prepare_materialize` with the returned
   current `file_id`, returned name as `file_name`, and the same
   `library_file_id`, following [materialization.md](materialization.md) so the
   destination is chosen before the call. Use this latest materialized file as
   the new working copy; never write the stale artifact.
3. Reconcile the requested change while preserving every unrelated intervening
   change:
   - If the latest version already contains it, make no write.
   - If it still applies cleanly, apply and validate it, then replace with the
     `current_version_number` from `prepare_materialize` as
     `expected_current_version`.
   - If it conflicts or cannot be applied safely, abort without writing.
4. Report whether the change was already present, successfully reapplied, or
   aborted. If another conflict occurs, reload the same item again before any
   further attempt. Never retry stale bytes or omit the guard.

The older `manage_library` `update` operation accepts a finalized `file_uri`
for compatibility. Prefer `replace_library_file` for local Codex files. Do not
reuse a source file already attached to a different Library item; that is a
per-operation conflict. A historical file reference from the same item can be
reused.
