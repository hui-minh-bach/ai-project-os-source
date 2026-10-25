# One-button web delivery R6 - scope and operating contract

## What this build is

This is v0.9.63 source, based on the last available verified v0.9.62 Workflow R4 archive. It is an additive **web-delivery pilot**, not a claim that every possible product can be built or operated automatically. The interrupted R5 source was not available. Its Radar/category/media/intake changes must not be inferred to exist here from historical screenshots.

All 81 approved `public/space-studio/` and `public/assets/` files are byte-identical to the supplied R4 baseline. The new intake panel, delivery backend and Skill Hub entry do not alter room geometry, cameras or robot animation.

## Beginner journey

1. Launch `RUN-WINDOWS.cmd`, open the existing Vault and select/save a project in Idea Studio. Keep the old data directory; use a new source folder, not a stack of patches.
2. In Connections, add real AI bindings and load their model catalogs. A worker and a different reviewer binding are required. Existing project role choices and failover settings are respected; missing roles can be assigned from verified/configured catalogs.
3. Add Vercel **management token** and, only when needed, Supabase **management PAT** to the app Vault. Connecting a ChatGPT plugin or signing into a vendor's website does not automatically give this local app a credential. A project's public Supabase key is insufficient to create infrastructure. CLI-only connections are not supported by this adapter.
4. In the intake panel, select **Prepare delivery**. Choose a discovered Vercel account/team, optional Supabase organization, a region, and Preview or Production. Choose Docker testing, or explicitly acknowledge the risks of Host execution. Docker must be installed and running; Git and Node/npm must be available. The app does not silently install tools or buy services.
5. Read the AI analysis/Council specification and exact account scope. Explicitly approve the requirement, possible account charges, and any Production/Host permissions. This is the one decision that authorizes the already-listed stages; it is not a separate confirmation for every stage.
6. The host creates/executes tasks, reviews and tests the source, provisions authorized resources, configures public app settings, waits for a READY deployment, checks its source marker and HTML routes, then returns the real link, locally generated QR and source ZIP **inside Idea Studio**.
7. Review the actual product. An HTTP 200, a passed generated test or model consensus is not end-user acceptance. Check the business journeys with representative data before sharing with customers.

A new delivery run currently provisions new isolated infrastructure. It is **not an in-place upgrade/migration of an existing customer database**, a rollback service or a domain-transfer workflow. Existing cloud projects and customer data are not silently modified or deleted.

## Ten execution stages

| Stage | Completion evidence |
|---|---|
| Build | Existing worker execution, preserved tool ledger, independent review and actual Git merges |
| Validate | Every task done/reviewed; final `npm test` PASS; immutable source snapshot |
| Database | Newly provisioned Supabase reference, exact approved organization, ACTIVE_HEALTHY |
| Schema | Generated transaction journal hash; owner-scoped RLS declarations; private bucket settings read back |
| Hosting | Vercel project ID, exact name and account ownership |
| Environment | Public Supabase URL/key only; separate Preview/Production targets |
| Deploy | File uploads with digests; saved deployment ID; READY state |
| Auth | Site URL and redirect configuration on the new database project |
| Smoke | HTTPS routes and deployed-source marker match the frozen source |
| Handoff | Actual URL, QR SVG and ZIP. Business acceptance remains pending |

Supabase-related stages are skipped when the product manifest does not use Supabase. Skipped is not described as completed database work.

## Source/manifest contract

Supported framework packaging is `static`, `vite` or `nextjs`, with a version 1 `aios.delivery.json`. The worker must produce runnable code and meaningful offline tests. The host does not accept `NOT_RUN` as a test pass. It does not guarantee the quality or completeness of model-generated requirements/tests.

The pilot database schema supports owner-owned tables with `id`, `user_id`, `created_at`, and explicit simple columns, plus private Storage buckets with MIME/size limits. It rejects arbitrary SQL, public buckets and privileged browser keys. Shared multi-tenant roles, relationship migrations, server secrets for arbitrary APIs, scheduled jobs and external mail/OAuth/payment integrations require additional reviewed adapters; do not weaken RLS or claim they were implemented.

Limits: 500 source files, 24 MiB total, 5 MiB per file; 12 tables, 24 custom columns per table; 4 buckets, maximum 20 MiB per stored object; up to 5 HTML smoke routes. Symlinks, private configuration, database dumps and runtime logs are rejected. Dependencies/build caches and `.git` are not uploaded. The secret scanner is defense-in-depth, not a proof that arbitrary source contains no secret.

Static apps load `/aios-public-config.js`. Vite uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; Next.js uses the corresponding `NEXT_PUBLIC_` names. Admin/service keys never enter those variables or the returned ZIP. Framework dependency installation is not automated locally in this pilot; a missing dependency/test prerequisite pauses the run instead of skipping tests.

## Recovery and permissions

Run states: `preparing -> needs-approval -> running -> delivered`, with `needs-action`, `interrupted` or `stopped` when appropriate. Checkpoints live under the existing app data directory, in `delivery-runs/`. Cloud IDs and operation intents are saved before later effects. A lost create response is reconciled by the same run's exact name/metadata; it is not blindly recreated.

A provider error uses the existing R4 bounded inference failover and the same task/workspace/tool ledger. It is not permission to replay completed external effects. A failed deployment or all-model failure pauses with a concrete error. Resume is explicit, capped at eight attempts, and retains completed receipts. Changing the approved brief, specification or credential identity invalidates the old authority.

Stop means stop after the current operation; an in-flight request may complete. Already-created resources can still incur account charges. No automatic deletion, plan upgrade, domain purchase or disabling of deployment protection occurs. A protected preview cannot be advertised as a public customer URL; it must pass the access check before QR handoff is reported successful.

Vault lock blocks private status/actions/downloads and further authorized steps. A damaged delivery journal blocks only this module, not the rest of the app. Closing the execution host interrupts work; this feature and the continuity skill do not run indefinitely outside a running app.

## Verification boundary

See `evidence/one-button-r6/` for the actual latest results. Tests use isolated synthetic AI/cloud services. They exercise real app HTTP endpoints, model failover, file operations, npm tests, Git merge and UI controls. The Chromium UI harness loads the shipped HTML/CSS/classic scripts in memory and bridges authenticated requests to the real localhost server because direct URL navigation is blocked by the environment policy; no policy is altered. The 3D ES module is excluded from that workflow harness.

A QR decoder and an independent standard ZIP reader check the delivered fixture artifacts. The fixture URL is not a deployed customer website. Live Vercel/Supabase provisioning, actual Supabase cross-user RLS tests, live account billing, Windows/GPU/device performance and commercial readiness remain **not_tested**.

During regression, a pre-existing Kokoro array-buffer download race was repaired: the unused write stream could truncate the fallback-written file. Windows Host npm invocation now uses Node plus `npm-cli.js`, not a batch wrapper with shell disabled. These are targeted reliability fixes, not claims of native Windows or real TTS acceptance.
