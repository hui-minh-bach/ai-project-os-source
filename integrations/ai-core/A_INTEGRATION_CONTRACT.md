# Worker A → Integration Owner: proposed Core v0.8 API and migration

`src/server.mjs`, `src/lib/integration-host.mjs`, `package.json`, global schemas and final installer are **FROZEN** for Worker A. The snippets below propose adapter changes only. Apply **after** review with B and C. No worker deployed code.

## Boot and capability probe
```js
const core=createCore({root:localDataRoot,commercialPolicy:true,concurrency:2});
const capabilities={version:'core-commercial-policy-v1',paidRequests:'per-action-approval',publish:'explicit-gate',modelVerification:'bounded-probe',mediaIntegration:'unchanged-external-port'};
```
Strict mode is opt-in to preserve running v0.7.7 flows until C's authenticated UI and B's media paid billing are wired. It must be enabled before claiming the commercial Core paid workflow is safe.

## Proposed routes (host HTTP UI adapters, not yet implemented)
All routes require the existing local session, anti-CSRF, strict origin/Host checks and unlocked Vault where applicable. Body booleans alone are **not proof** of a human decision; the host must bind confirmations to a one-use session challenge and clear user action.

| Route | Request | Response | Rule |
|---|---|---|---|
| `POST /api/core/provider/verify` | `{providerId,model,costCeilingUsd,approvalChallenge}` | `{ref,usage,source}` | Enforce recent human approval and authorized billing; never echo key |
| `POST /api/core/model/assign` | `{role,providerId,model}` | verified role binding | Reject unsupported/unverified model; role is Founder/Council/PM/Worker/Reviewer |
| `GET /api/core/quota/:providerId` | query optional `modelId` | `{availability,connectionId,modelId,sharedBucket,windowLabel,consumed,remaining,limit,unit,source,observedAt,resetAt,isEstimated}` or `{availability:'unknown'}` | Never invent shared account/model-specific quota |
| `POST /api/core/cost/quote` | `{role,prompt,maxOutputTokens}` | `{connectionId,modelId,estimatedUpperBoundUsd,approvalRequired,...}` | No provider call; operator-configured prices must be accurate |
| `POST /api/core/cost/approve` | `{role,projectId,idempotencyKey,maxUsd,approvalChallenge}` | `{id,status:'approved',role,model,projectId,maxUsd}` | Session-bound explicit consent per job |
| `POST /api/core/tasks` | validated TaskQueue v1 input including `costApprovalId` / `reviewerCostApprovalId` when AI called | task snapshot | Untrusted plan cannot add paid or publish rights |
| `POST /api/core/tasks/:id/recover` | `{approvalChallenge,resetStep}` | task with `state:'queued'` or error | Only local safe in-flight operations may be manually recovered |
| `POST /api/core/publications/prepare` | `{projectId,taskId,capability,target,artifactIds,privateRepo,commitSha}` | draft id | Private GitHub/preview; production needs exact SHA |
| `POST /api/core/publications/:id/approve` | `{confirmTarget,approvalChallenge}` | approved draft | Exact human-confirmed destination |
| `POST /api/core/publications/:id/dispatch` | id, official authorized GitHub/Vercel adapter | `{ok,url,verifiedAt,commitSha}` | Persist dispatched BEFORE external call; never auto retry uncertain request |

**Sample model binding:**
```json
{"connectionId":"openai-work","providerId":"openai-work","modelId":"verified-model","verifiedAt":"2026-10-16T00:00:00Z","verifiedCapabilities":["text"]}
```
The sample is a type example, NOT a verified connection. Code must not assume vision/speech/tools support unless real provider capability probes support them.

**Budget UI:** show Observed Spend (`spendUsd`), Uncertain Possible Charges (`uncertainUsd`) and Available Budget (`budgetUsd - spendUsd - uncertainUsd - reservedUsd`). An uncertain amount is NOT a confirmed invoice. If pricing is unknown, block paid requests instead of showing a fake estimate. Verification probes themselves require permission and a ceiling.

## Planned adapter workflow
1. User enters idea and opts in to specific billable Founder/Council/PM steps with individual limits. `AgentTeam.plan({projectId,idea,approved:true,costApprovals:{founder,council,pm}})`; every approval ID must be scope-bound.
2. PM task DAG is schema-checked before persistence. New code tasks remain `waiting_approval` and require approved tools + `costApprovalId` to run. `Worker` and `Reviewer` are independently scoped, and generated software stays blocked until an approved sandbox verifier records actual execution evidence.
3. `OutcomeKit.websiteDraft`/`contentDraft` may deliver a user-supplied local artifact. No AI-generated research or live web citation is inferred from source URLs.
4. For remote outputs, create a publish task depending on verified source tasks, generate a `PublicationGate.prepare` draft with SHA-verified assets, obtain exact target confirmation, then call `.dispatch` using an *approved official adapter*. Explicit Preview smoke is required before Production.
5. Media requests still route to Worker B frozen `MediaPlan v2` + `ArtifactStore v1` adapter: do not make the Core decode video or bypass B's billing approval; source SHA-256 must match throughout.

## Disk/state migration, compatibility and rollback
- Base Core state is `version:1`, with new **optional** additive keys: `commercial`, `publications`, `usage.uncertainUsd`. Do not change global `version` from Worker A.
- **Breaking state enumeration**: `interrupted` and `waiting_approval` are now valid Core task statuses. An old binary that expects only queued/running/blocked/... must not read migrated state without an integration-owned compatibility adapter or backup restoration.
- Before enabling strict mode, atomically back up `%LOCALAPPDATA%\\AIProjectOSLocal\\data` and verify SHA-256 of the backup. Migration must map old `running/review` conservatively to `interrupted`, never complete or auto retry them. Rollback must restore the old state snapshot, not simply install the old EXE over new state.
- Preserve `ArtifactStore` legacy `size` while exposing `sizeBytes`, `sourceTaskId`, `relativePath`, MIME, provenance and `verifiedAt`. Never expose the server's real data root, auth token or Vault contents in browser JSON.
- If a provider key/account changes, invalidate old model verification and role binding. A configured provider or installed CLI by itself is not a verified model.

## Front-end/change ownership
- A did **not** alter UI. C provides confirmation prompts, status for `waiting_approval`/`interrupted`, progress and genuine UNKNOWN quota, error recovery and accessibility.
- B owns media tools/voice/captions. Paid media narration calls need explicit operator-approved ceiling and idempotency. Do not pretend these are covered by A's provider API unless B adopts the exact scope contract.
- Integration lead owns the outer routes and combines A+B+C after contract fixture checks. Zero implicit GitHub/Vercel account creation, production pushes, host-shell execution or subscription quota inference.

## Stop conditions
Block integration/release if a provider HTTP POST or external publish can occur without a one-use human grant; if a task can retry an uncertain paid/remote action automatically; if an LLM can overwrite permissions; if artifact hashes/real tests are missing; or if rollback data corrupts. These remain hard gates, not optional polish.
