# Prepared uploads

Always use the upload helper for shared-file replacements, even without
prepared tools. Otherwise, use it with both tools for multiple files or one file
around 50 MiB or larger. It owns preparation, byte transfer, finalization,
ordered result correlation, and local metadata writeback as one operation.

## Build one request

Confirm every `local_path` is an absolute path to a regular file. Preserve the
user's requested order.

To ensure correct upload transfer, stage files in a runtime-provided
conversation-scope workspace when one is active - if provided, it's usually
of the form `workspace/scratch/<id>`.

- Include `directory_id` when the file belongs in a resolved Library folder.
- For a create, set `purpose` to `create_library_file`.
- When the current helper and tool schemas support it, set each create's
  `library_artifact_type` using [Classify New Files](../SKILL.md#classify-new-files).
- For a replacement, set `purpose` to `replace_library_file` and include the
  existing `library_file_id`. Include a retained concrete
  `expected_current_version` and a short `version_reason` when available.
  Never invent or remove a version guard.
- For a shared file, pass `is_shared=true` and
  `library_file_name` when its existing name differs from the local filename.
  Pass `expected_current_version` when known; otherwise the helper recovers the
  version only from matching local file metadata. For a shared writing block,
  use `read` instead of materialization and follow `next_read` while `has_more`.
  Retain the first page's `version_id`; abort if it changes between pages.
  Preserve line boundaries; abort unless `end_line` equals `total_lines` and the
  reconstructed UTF-8 byte count matches its authoritative `size_bytes`. Convert
  the retained decimal `version_id` to the integer `expected_current_version`.
  Shared PDFs are not C2PA-signed yet.
- Do not include replacement fields on creates.

Choose one setup path:

**Locally available skill:** Resolve the helper from the current Library skill
path:

```bash
skill_md_path="<absolute path of this SKILL.md>"
upload_helper_path="$(dirname "$skill_md_path")/scripts/library_upload.py"
```

**Cloud skill:** First follow the [helper refresh steps](../SKILL.md#use-current-helpers).
For an MCP-backed `skill://.../library` source, read child resources
`scripts/library_upload.py`, `scripts/library_hosted_apps.py`, and
`scripts/library_file_transfer.py` from the same current skill URI. Read every
page and write all three complete `text/x-python` contents unchanged into one
fresh private temporary directory. Set `upload_helper_path` to that directory's
`library_upload.py`.

With prepared tools, invoke it once with the whole batch; without them, invoke
it only for shared items in request order. Supply the JSON and its EOF together:

```bash
python3 "$upload_helper_path" <<'JSON'
{
  "uploads": [
    {
      "local_path": "/absolute/path/new-file.ext",
      "purpose": "create_library_file",
      "directory_id": "optional-folder-id"
    },
    {
      "local_path": "/absolute/path/edited-file.ext",
      "purpose": "replace_library_file",
      "library_file_id": "existing-library-file-id",
      "expected_current_version": 3,
      "version_reason": "updated analysis"
    }
  ]
}
JSON
```

Never start the helper interactively and send JSON in a later terminal write.
The helper is batch-only and requires stdin to close after one complete JSON
request.

## Handle the result

The helper splits app calls into batches of at most 20, treats every returned
`workspace_path` as already transferred, transfers `upload_url` items privately,
finalizes only transferred items, and applies returned identity and xattrs to
each original local path. The helper offers every path to Library, and a single
batch may use both direct workspace and signed-URL transfer modes.

Inspect the ordered `results` array. Report each saved or failed Library file
without exposing commands, URLs, transfer output, xattrs, or storage details.
Keep a version conflict as a failed replacement and use the conflict flow in
[writeback-and-conflicts.md](writeback-and-conflicts.md); never remove its
version guard.

Do not call `prepare_uploads` or `finalize_uploads` separately or transfer a
returned URL yourself. Never switch a started helper write to a direct action.
When prepared tools are unavailable, use the helper for shared
replacements and direct actions for other items in their original order.

If a shared replacement or finalization times out, or its outcome is otherwise
unknown, do not automatically retry, shrink the batch, or switch to direct
writes. Library may still be processing the original request; report the
uncertain outcome without creating a second write.
