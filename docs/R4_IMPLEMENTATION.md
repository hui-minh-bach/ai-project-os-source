# Workflow Reliability R4 - implementation and review record

## Scope
The R3 room screenshot was accepted. Geometry, material, lighting, avatars, camera, modules under `public/space-studio/` and assets under `public/assets/` are protected. This work repairs execution and read-only attribution, not another visual redesign.

## Observed faults and changes
1. R3 project inference only rotated on quota within the same provider/model pool. R4 uses one bounded dispatcher for Founder, Council, Native Worker/Reviewer and project-scoped media text calls. Explicit role backup precedes unrelated peers; every provider keeps its own selected/catalog model ID. Direct standalone connection probes retain legacy behavior.
2. An attempted Antigravity tool call in a text-only bridge failed the whole request. It remains forbidden; R4 classifies this mismatch and can use another allowed text model. The host provides dated configured RSS evidence for news queries rather than granting arbitrary tool/shell authority.
3. The intake button previously navigated to a tab and announced acceptance. It now invokes the real analysis/Council pipeline, pauses at the existing owner specification approval, then builds and executes task dependency waves.
4. Mid-task handoff keeps the current Git worktree, structured task/specification, recent conversation and a complete host-operation metadata ledger. Completed host operations are not automatically replayed. This is not an exactly-once guarantee for arbitrary shell commands; external engines are not silently restarted or elevated.
5. HTTP auth/model errors no longer delete the current-credential catalog needed to resolve the primary role to a healthy backup. Runtime verification is marked unavailable, never falsely verified; credential replacement and explicit catalog invalidation remain strict gates. Auth cooldown is account-wide for that credential, model errors are model-specific.
6. The UI can run/retry tasks after refresh when a primary has a runtime fault but an eligible configured backup is available. Failed founder retries reuse the original message ID. Actual served account/model is shown in conversation, Council, task records, review receipts and fleet projection.
7. Invalid news/video/idea input is rejected before creating phantom projects/runs. Pipeline retry reuses the run, project, input snapshot, script and completed operation task receipts. User-directed retry is bounded to three retries; scheduled failed news cards are not repeatedly consumed. Uncertain external publication is blocked for reconciliation instead of double-posting.

## Limits and non-goals
- Inference retry budgets are per request, not an unlimited autonomous job runner. Default: 4 bindings, 45s per HTTP inference attempt and 180s between-attempt inference budget. Existing CLI initialization/RPC setup has its own timeouts; this is not a hard 180s wall-clock SLA for an entire workflow.
- Invalid/removed accounts, changed identities, vault lock, stale brief/spec, permission or safety refusals are not bypassed. Unknown failures remain explicit. Configuration errors may still require owner correction.
- Fallbacks may use quota or paid credit on another account connected by the same app owner. Scope and opt-out controls are in AI Team. No new account, paid service or external publication was activated during validation.
- Reviewer fallback excludes all accounts that actually served as workers during that run. An explicitly owner-selected original reviewer is not silently replaced by this rule. Do not claim an independent human/AI review of this patch; this was implementation plus automated tests and self-review.
- News retrieval covers configured RSS cards and summaries with publication dates in UTC+07, not general web search or exhaustive market verification. No fresh evidence means an explicit limitation response, not invented current news/prices.
- Closing the whole app still stops its local execution. Checkpoints and retry history are recovery records, not background execution.

## Regression adjustments (explicit, not hidden)
The owner requested a change from R3 routing semantics. The legacy project test expecting backup *after* unrelated pool peers now expects explicit backup first. The old non-quota-no-fallback case explicitly tests opt-out; new fault-injection tests cover default 401/403/408/429/5xx/network/timeout failover. Pure schema rejection tests run with failover disabled, while separate tests prove malformed output can transfer before a tool executes. Credential-change tests now require the in-flight result to fail before commit (stronger than the old historical-completed receipt). Version assertions are updated to 0.9.62. Safety, stale-spec, workspace, publish approval and invalid-input checks were not removed.

## Evidence levels
- `release-regression.log`: full Node test suite and syntax checks; local fixtures, not real vendor credentials.
- `routing-tests.log`: focused dispatch and fleet contracts.
- `browser-report.json`: real local app HTTP endpoints and Git files, UI classic scripts/CSS in Linux Chromium in-memory harness with a session-backed HTTP bridge. Direct localhost navigation is blocked by the environment browser policy; no policy was changed. 3D module is excluded from this workflow harness, not altered in the product.
- Browser screenshots are fixture UI evidence only. Fake provider names are visibly marked LOCAL TEST. They do not prove external AI intelligence or customer-account login.
- `protected-files.json`: exact original hashes for protected modules/assets and a changed-file inventory.
- `verification.json`: combined acceptance status and explicit not-tested gates.

## Repeat checks
Run `npm run check`, `npm test`, or the focused `npm run test:workflow` with Node 22+. The optional `python scripts/verify-workflow-browser.py` uses a Linux Chromium executable (set `CHROMIUM_BIN`), Python Playwright and requests; it is QA tooling, not an app runtime requirement. It starts only loopback fixture services with a fresh temporary data directory, performs checks, stops its processes and writes QA results to a temporary folder (or `AIOS_WORKFLOW_QA_DIR`). Do not point fixture scripts at customer data.
