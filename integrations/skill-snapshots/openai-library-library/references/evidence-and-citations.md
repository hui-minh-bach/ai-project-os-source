# Library evidence and citations

Read this reference when resolving a selected Library mention, using advanced
search filters, verifying recently written content, or citing Library evidence.

## Selected Library mentions

A selected Library `@` mention is serialized as a Markdown link targeting
`mcp-resource://<server>/<percent-encoded-resource-uri>`. Decode the inner URI.
When it is
`oai-library://<library_file_id>/<percent-encoded-file-name>?...`, treat it as
an already-resolved Library item.

Read `library_file_id` from the URI authority/netloc and `file_name` from the
decoded path without its leading slash. Preserve query parameters when present:
`file_id`, `mime_type`, `size_bytes`, `version`, and `updated_at`. Do not call
generic MCP `resources/read` or `read_mcp_resource` merely to recover this
metadata. Search only when a required identifier is missing, fresh Library
metadata is needed, or the target is ambiguous.

## Search, list, read, and find results

Prefer `structuredContent`; parse a JSON text block only when structured
content is unavailable.

- `list` returns `items` plus an optional `next_cursor`. Use `library_path`,
  `include_folders`, and `recursive` for folder browsing. Set `limit` to at most
  200.
- `search` returns `results`, optional `retrieval_title_results`, and an
  optional `next_cursor`. It searches Library files, not conversations. A
  search request accepts at most five queries and `top_k` at most 100.
- `read` and `find` return the ChatGPT files-tool response shapes. Batch
  independent item requests in one call.

Useful returned fields include `id` or `file_id`, `library_file_id`, `name`,
`path`, version metadata, state, MIME type, size, and
`library_artifact_type`. Prefer `library_file_id` for follow-up Library identity
when present; otherwise use the returned `file_id` or `id`. Never use
`result_id` as a readable file reference.

For an actual filename or title, quote the query and set
`search_title_only=true`. Treat `retrieval_title_results` as supplemental fuzzy
candidates, not canonical filename matches. For a descriptive request, use an
ordinary content search instead of pretending the description is a filename.

Content questions require evidence from `read` for every selected file. Use
`find` after candidate resolution for literal, symbol, heading, or regex
matches; use `read` afterward only when the match needs more context.

## Image metadata

Distinguish Library upload time from camera capture time. Use
`filters.image_taken_after` and `filters.image_taken_before` for EXIF capture
time and `filters.image_location` for reverse-geocoded `city`, `region`, or
`country`. Send only the narrowest location component the user supplied or
clearly implied.

Use `include_image_metadata` with `image_taken_at` and/or `image_location` only
when the user asks to see those fields; matching metadata is returned
automatically when its filter is used. Keep a meaningful search query such as
`photos` even when date and location constraints live in filters.

Do not combine contradictory generated-file selectors. For example,
`include_generated=false` conflicts with `filters.source="generated"`.

## Evidence after mutation

Title and metadata search can become available before retrieval-backed content
is indexed. For immediate follow-up, prefer the identifiers returned by create,
replace, finalize, or restore.

For exact verification, inspect the written local artifact or materialize and
compare the current Library bytes. Retrieval search can lag, remain fuzzy, or
surface superseded content. If search is still useful, scope it with the
returned `library_file_id` or `file_id` and treat it as supporting evidence, not
the correctness gate.

## File citations

Use file citations for claims supported by Library `search`, `read`, or `find`
when the evidence includes a valid File Service id beginning with `file_`.
Library `list` results, filename-only or metadata-only matches, and write
confirmations are not supporting text.

Place the marker immediately after each supported claim, in the same sentence,
bullet, or table cell. Do not place one trailing marker after several bullets,
paragraphs, or rows.

Use exactly one of these forms:

- Exact returned lines: `filecitefile_...Lx-Ly`
- No exact returned lines: `filecitefile_...`

Use the exact returned `file_...` id. Never derive it from a filename,
`library_file_id`, chunk id, local path, or URL. Use the smallest returned line
range that fully supports the nearby claim; never estimate lines. If exact
lines are unavailable, omit the range rather than the citation.

When several files support an answer, cite each file's claims separately. One
citation may support several claims only when they appear together and the
cited text supports all of them. After creating or modifying a file, cite it
only if a later Library `search`, `read`, or `find` returns qualifying evidence.
