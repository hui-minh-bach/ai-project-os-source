# THIRD PASS AUDIT — AI CORE GPT1 — 2026-10-15

**Scope:** V2 independent code inspection against supplied `không xóa không xóa.zip`, security and QA regression on isolated Linux container. **Acceptance: PARTIAL/BLOCKED**, not production ready and not proved error-free. This package supersedes V2.

## Evidence and corrective actions

1. Model-generated source previously passed solely on file-exists / JS syntax and optional AI review, which does not demonstrate runtime correctness. **FIX:** code generation remains `blocked / REVIEW_INSUFFICIENT` until an independent, explicitly approved sandbox verifier supplies a verified ArtifactStore evidence ID. `queue.registerVerifier(fn,{approved:true})`, then `await queue.verifyTask(id)`. No automatic arbitrary-source execution on host. The verifier must be furnished independently, never by the Worker under review. Example in `docs/VERIFIER_INTEGRATION.md`.
2. `resume`, `retry`, `approve` could race an in-flight provider call. **FIX:** reject with `TASK_IN_FLIGHT` until the previous execution completes; require verification instead of re-running source awaiting review.
3. User-supplied invalid task identifiers could reach workspace paths. **FIX:** strict UUID task ID validation prior to persistence or workspace creation; `projectId` already restricted to a safe identifier.
4. `State.update` could mutate in-memory data before validation and persistence. **FIX:** copy-on-write and rollback in-memory change if persistence throws.
5. Local file writes could truncate an existing file before complete output. **FIX:** atomic staging before replace, recheck path; no privilege expansion.
6. Explicit browser Origin on HTTP requests was not rejected. **FIX:** reject browser-originated requests; trusted local server-to-server clients without Origin remain supported. Must NOT expose bearer token in JS/browser code.
7. Unknown MCP/custom tools were shown with `installed=true`. **FIX:** report `installed:null/status:unverified` until an independent live health verification is available. Builtins check availability where possible.
8. Installer used dry run and backups but could leave partial patch application after an error. **FIX:** best-effort rollback of touched files when checksum unchanged, preserve backup for manual restoration. **PowerShell not available here — not executed on Windows**.
9. Model reviewer rejection with empty findings could have produced no issue. **FIX:** record mandatory `AI Reviewer rejected output` when disapproved.

## Test result

- `node --test` from the extracted patch: **28/28 passed, 0 failed** (Node.js v22.16.0; container Linux).
- Tests cover two isolated workers / worktrees, reviewer feedback, crash-state recovery, model call cancellation, provider role pinning and budgets with **synthetic fetch**, encrypted Vault, local bearer auth, model-generated code acceptance gating, reject unsafe task IDs, pause race, filesystem state immutability, verifier evidence binding and non-fake tool availability.
- Git bundle contains **a synthetic local Git baseline and a local `feat/ai-core` branch**, not an upstream commit or user repository PR.
- No real OpenAI / Gemini / Claude request; no Windows PowerShell, Docker, full app UI, FFmpeg, media/social publish execution; no trusted external Reviewer approval. Do not report DONE.

## Residual risks and independent acceptance requirements

- **BLOCKED — correct original AI Project OS source missing.** Attached original is KBL Video Worker, not the 10-tab AI Project OS. Patch adds a separate backend only; integration into running GUI was not tested. Original config/work/video/browser profiles are untouched.
- **BLOCKED — independent verifier integration.** No untrusted generated code runs on host automatically. A trusted verifier must enforce a real Windows/Docker sandbox boundary; a JS callback alone does not provide isolation.
- **BLOCKED — real providers and billing.** User key/permission required. Local costs are approximate using user-supplied price tables and usage; provider invoices/quota can differ. Activate and monitor external provider spending limits separately. The default 0 USD budget is the safe state.
- **BLOCKED — Windows install, rollback and interruption smoke test.** Run on a fully backed-up copy of the exact Worker; verify Windows ACL, PowerShell compatibility and node/git versions. Make a full offline backup first.
- **BLOCKED — upstream repo and independent reviewer.** No GitHub Local Worker repository or PR exists in connected account; no independent approval. Do not push into BMH.
- **BLOCKED — GPT 2 + 3 integration.** No Concat / video editor / social publisher or AI Project OS 10-tab UI included or changed.
- **No absolute zero-error guarantee** is possible from this test suite alone.
