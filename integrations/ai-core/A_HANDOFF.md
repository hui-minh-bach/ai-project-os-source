# How to use Worker A patch

This is the **scoped source deliverable**, not a customer installer.

1. Create an integration branch from the exact baseline ZIP whose SHA-256 is in `A_EVIDENCE.md`.
2. Confirm every file in this package is under `integrations/ai-core/`. Merge those paths only. Do not overwrite Worker B/C paths, install scripts, public UI or the server router.
3. Use the `A_WORKER_PATCH.diff` from the package if using a Git baseline (`git apply --check A_WORKER_PATCH.diff && git apply A_WORKER_PATCH.diff`) or copy the scoped `integrations/ai-core/` paths while preserving the tree.
4. Run `npm run check`, `node --test integrations/ai-core/tests/*.test.cjs`, `npm test` sequentially. Optional offline artifact demo: `node integrations/ai-core/examples/generate-local-outcomes.cjs <NEW_EMPTY_DIRECTORY>`.
5. Read `A_INTEGRATION_CONTRACT.md` and implement the **host** adapters via integration lead; enabling `commercialPolicy:true` without the confirmation UI and migration is not a commercial release.
6. Do not run `tests/live-provider-smoke.cjs` with customer keys. It is explicitly gated, prints `SKIP` by default, and requires a disposable authorized test account plus billing cap to run.

The package intentionally has no executable installer, no `.git`, no credentials, no zip of another worker, and no data files. Release gate remains **RED** until real Windows, authorized provider and preview/production evidence exists.
