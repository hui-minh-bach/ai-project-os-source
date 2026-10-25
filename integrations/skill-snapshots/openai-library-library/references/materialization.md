# Resolved-reference materialization

Read this reference only when local bytes are needed from a selected Library
`@` mention or another resolved reference that did not come from `list` or
`search`. Files returned by `list` or `search` use the stdin-only
`library_download.py` fast path in `SKILL.md` instead.

## Resolve the bundled helper

Resolve `library_file_transfer.py` once immediately before use.

- For a filesystem-backed skill, derive its path from this skill's known
  `SKILL.md` path:

  ```bash
  skill_md_path="<absolute path of the Library SKILL.md>"
  helper_path="$(dirname "$skill_md_path")/scripts/library_file_transfer.py"
  ```

- For an MCP-backed `skill://.../library` source, read child resources
  `scripts/library_file_transfer.py` and `scripts/library_hosted_apps.py` from
  the same skill URI and write both returned `text/x-python` contents unchanged
  into one private temporary directory.

Do not search `/root/.codex`, infer an MCP-backed filesystem path, drop the
`/library` skill directory, inspect helper implementation, or invoke `--help`.

## Prepare the resolved file

Parse the selected `oai-library://...` URI as described in
`evidence-and-citations.md`. Call `prepare_materialize` with the exact resolved
identifiers, including `library_file_id` whenever it is present:

```json
{
  "items": [
    {
      "file_id": "<resolved file_id>",
      "file_name": "<resolved file_name>",
      "library_file_id": "<resolved library_file_id>"
    }
  ],
  "destination": {
    "directory": "<absolute requested destination parent>"
  }
}
```

Choose the destination before preparation. When the runtime provides a
conversation-scoped workspace, keep the destination inside it so Library can
place eligible bytes there directly. Otherwise, retain the signed-URL path.

Sediment-backed Library files require `library_file_id`. Omitting it can return
`INVALID_ARGUMENT`.

Read transfers from `structuredContent.result.transfers` when the result wrapper
is present, or from `structuredContent.transfers` otherwise. Parse JSON text
only when structured content is unavailable. Preserve every transfer as one
object. A transfer contains either an absolute `workspace_path` whose bytes are
already local or a short-lived `download_url`; do not reduce it to its URL or
flatten its fields into the outer result.

## Complete each transfer

When a transfer contains `workspace_path`, use that exact path and pass the
complete transfer object to apply and verify its returned attributes:

```bash
python3 "$helper_path" \
  apply-xattrs "$workspace_path" <<'JSON'
<complete selected transfer object>
JSON
```

Otherwise choose an absolute destination under the workspace or at the path
the user requested. Pass the complete transfer object—not the outer transfers
object, a content block, or the URL alone—to the helper:

```bash
python3 "$helper_path" materialize "$destination" <<'JSON'
<complete selected transfer object>
JSON
```

The helper uses returned headers, downloads the bytes, applies and verifies
all xattrs, persists `library_file_id` as `user.library-file-id`, and atomically
installs the destination. Invoke it once per signed-URL transfer. Never use raw
`curl`.

If the helper is unavailable, stop rather than producing a local file without
its Library metadata. Keep the resolved `library_file_id` and current version
associated with the local path for later replacement.
