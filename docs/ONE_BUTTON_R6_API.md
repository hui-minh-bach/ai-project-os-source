# R6 API and file map

All routes require the existing local session. Mutations keep the existing origin guard. Vault must be unlocked. Management tokens never belong in request bodies to these routes; send saved connection IDs.

- `POST /api/launch/options`: readonly discovery, `{vercelConnectionId,supabaseConnectionId?}`.
- `POST /api/projects/:projectId/launch`: prepare a run with discovered scope. Fields: `vercelConnectionId,teamId,database,supabaseConnectionId?,organizationSlug?,region?,target,testMode,autoAssign?`. The string `personal` denotes the discovered personal Vercel scope, not a guessed account ID. Regions are restricted to the listed options. Targets: `preview|production`; test mode: `docker|host`.
- `GET /api/projects/:projectId/launch`: latest sanitized state, tasks, actual served model bindings and receipts.
- `POST /api/projects/:projectId/launch/:runId/approve`: `{specificationId,confirmCosts:true,confirmProduction?,confirmHost?}`. Additional booleans are mandatory for the selected risky scopes.
- `POST .../:runId/resume` or `/stop`: act on the saved run, not a replacement job.
- `GET .../:runId/artifact/source.zip` or `/qr.svg`: gated artifact downloads. Project/run binding is checked; traversal and other filenames are rejected.

`launch-artifacts.mjs`: bounded snapshots, manifest, generated schema, local ZIP/QR. `launch-cloud.mjs`: provider REST adapter and receipt reconciliation. `launch-runner.mjs`: durable state machine and approval guards. `launch-context.mjs`: scoped worker contract. `launch-bridge.mjs`: binds real existing AI tasks/review/sandbox to the delivery runner. `public/tabs/launch.js` and `public/launch.css`: additive intake/handoff UI.

No constructor-injected test endpoints can be selected through the public app API. `scripts/fixtures/launch-app-preload.mjs` is a test-only preload, protected by an explicit flag and isolated temp directory; production launchers do not use it.

Commands: `npm run check`, `npm test`, `npm run test:delivery`, and optional `npm run verify:delivery-ui` (Python requests/playwright and Chromium needed only for the QA harness).
