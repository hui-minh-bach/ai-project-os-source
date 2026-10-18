# Worker A – Core Services v0.8 security & automation handoff

## Source provenance and boundaries
- Baseline: `AI_PROJECT_OS_V077_FULL_WINDOWS_RENDER_CLIP_FIX_2026-10-16.zip`
- Baseline SHA-256: `bdf3b08a52d19366c3970a5e4b1cff88c9e2e454c832e1a5852ec5c495219b97`
- Source application version: `0.7.7-customer-release-candidate`; Worker A does **not** bump the host app version or build a customer installer.
- Ownership: all changes under `integrations/ai-core/`. Zero changes to UI, Media Engine, `src/server.mjs`, `src/lib/integration-host.mjs`, `package.json`, installer, schema version, production infrastructure or secrets.
- Core modes: compatibility is default for preserving v0.7.7; newly added `createCore({commercialPolicy:true})` is strict. Integration owner must review and enable strict mode with the signed/authorized UI approval flows before commercial rollout.

## Initial RED reproduction before edits (recorded)
`node --test integrations/ai-core/tests/commercial-a.test.cjs`
- Failed `file_read` with `.env`: expected PATH_DENIED but read was allowed.
- Failed restart during in-flight `file_write`: v0.7.7 requeued it without fresh human approval.
- Failed billed request approval: `ProviderGateway.generateApproved` did not exist; v0.7.7 had a single global spend cap only.
- Initial result: **0 pass / 3 fail**, exact log `REPRO_RED.log` in Worker A evidence folder.

## Implemented in code (not merely a plan)
- Workspace security: deny `.env*`, `.git`, `.ssh`, `.npmrc`, key material, dependency folders and symlink escape in tool read/write/check, even when a tool name was approved; file-tool READY now does an actual local write/read/remove probe.
- Durable task recovery: never automatically requeue active writes/provider calls after restart; persist `interrupted`; separate `recover(..., {approved:true})` for safe local steps; block re-dispatch of external/model/publish/other side effects under stale task identity.
- Provider strict mode: model capability verification by approved bounded probe (text only, no invented vision/tools); pin credential fingerprint and 24-hour verification freshness; model/role changes invalidate scope; provider redirects disabled and response size/time bounded.
- Per-action paid request: `quote`, `approveCharge`, `generateApproved` with project/role/model/idempotency key, persisted *dispatched before network send*. Network outage/cancel/429 does not automatically use a new charge. Quota with accurate observed scope and UNKNOWN when absent. Auth expiration, 429 cooldown and optional provider request headers are handled without fake 5-hour/weekly quota.
- Cost ledger: **observed spent** (`spendUsd`) versus **unresolved possible charge** (`uncertainUsd`) versus reservation (`reservedUsd`). Unknown consumption never becomes confirmed spend. Global budget blocks new charges when unresolved usage could exceed ceiling.
- Planner validation: validate *all* AI PM tasks and dependencies before creating any, no untrusted publication instructions, no agent text changing task permissions. Independent sandbox reviewer requirement for model-generated software stays in place; syntax-only model output cannot become `completed`.
- Artifacts: digest verification before task completion; filename hygiene, richer metadata (`sourceTaskId`, `kind`, `mimeType`, `relativePath`, `sha256`, `sizeBytes`, `verifiedAt`, `provenance`). Original `size` retained for compatibility.
- PublicationGate: prepare with verified source/dependency artifacts, exact destination confirmation, private GitHub by default, reviewed commit SHA for production, persistent one-use dispatch/uncertain states. Direct `publish` module calls are disabled under strict mode until the integrator binds a permissioned publisher.
- Local OutcomeKit: generates actual HTML/JS and Markdown assets with verified SHA-256 and a clear origin; user-provided URLs are labeled **unverified provenance**. It does not falsely claim AI-generated knowledge, web preview or public deployment.
- Task payload scrub: rejects high-entropy API tokens, password/credential fields and JS prototype-pollution properties before persisting to Core TaskQueue.

## Tests reproduced and results
```
node --version
npm run check
node --test integrations/ai-core/tests/*.test.cjs
npm test
node integrations/ai-core/examples/generate-local-outcomes.cjs /path/to/new-empty-output
node integrations/ai-core/tests/live-provider-smoke.cjs
```
- Node runtime during testing: `v22.16.0` (Linux x64).
- `npm run check`: **PASS**.
- `node --test integrations/ai-core/tests/*.test.cjs`: **59/59 PASS**, latest log `evidence/CORE_FINAL.log`.
- Full-app run command returned exit code **0** on the final source, not merely intermediate output.
- Core isolated regression: **59 passed, 0 failed, 0 skipped** after the dedicated hardening tests. (The `commercial-a.test.cjs` first had 3 failures as above. The final tests also seal the paid-call sentinel in a WeakMap, count unresolved possible charges against the remaining budget, and use ephemeral HTTP ports to prevent parallel-test collisions.)
- Entire v0.7.7 suite after ownership-only changes: **219 passed, 0 failed, 1 skipped (220 total)** when run sequentially; see `evidence/APP_FULL_FINAL.log` in the handoff package. The skipped media render is a test-suite condition, **not** an acceptance success.
- Real on-disk local artifact demo: **PASS** (one HTML, one JS and one Markdown). SHA-256 receipts: see `A_LOCAL_OUTCOMES.json`; the inputs are deterministic fixtures, not live LLM research.
- Provider mock tests: HTTP 401, 429 cooldown, expired/stale model, model mismatch, missing quota, token-less usage, double submission, uncertain network result; mock pass proves fail-closed behavior, **not** live provider access.
- Publishing mocked adapter tests: private repository gating, one dispatch only, cross-project/artifact tampering denied. **No real repo was created and no Vercel deployment was made.**
- Live smoke script without explicit credential/approval: **SKIP – no network/no charges** (confirmed).

## Open release blockers (integration owner / real customer environment)
1. **CORE AUTH INTEGRATION**: `src/server.mjs` and `src/lib/integration-host.mjs` are owned by integration lead and still use legacy Core constructor; enabling commercial policy requires authenticated confirmation UI and per-action quote/approval. Do not mark approved solely because a browser sends `approved:true`.
2. **SCHEMA/ROLLBACK**: new in-memory/disk task states `interrupted` and `waiting_approval` require an integration-owner backward-compatible migration and rollback backup. The old 0.7.7 parser rejects these new states; do NOT directly downgrade a modified state folder without restoring its exact previous backup.
3. **LIVE PROVIDERS**: no authorized live Codex/Claude/Gemini or paid API test was performed. Consumer ChatGPT install ≠ API permission; model entitlements and quota require official provider evidence.
4. **LIVE PUBLISH**: GitHub private repository and Vercel Preview/Production were **not** exercised with approved real provider accounts. Integration adapter must enforce repo/project, preview smoke, no-production-without-confirmation and rollback.
5. **WINDOWS**: no Windows 10/11 clean machine test, credentials, signing, customer pilot or installer verification. Not a commercial release.
6. **MEDIA**: video, caption and Concat code belongs to Worker B and is unchanged. This patch does not claim to fix Media Engine bugs.

## Evidence interpretation and status
Worker A scoped source + deterministic tests: **delivered**. Full application commercial readiness: **BLOCKED** until integration gates, live provider tests, Windows acceptance, licensing and authorized production publishing are independently verified. Never substitute this file for those release records.
