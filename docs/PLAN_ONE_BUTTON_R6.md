# One-button product delivery - implementation plan

1. Audit R4 and freeze the approved 3D assets (done).
2. Add persisted delivery run, approvals, exact identities and retry/reconcile rules.
3. Wire current founder/council/worker/reviewer engine; preserve model failover.
4. Add read-only connection preflight and strict Vercel/Supabase REST adapters.
5. Build safe deployment snapshot, declarative owner-scoped DB schema and private storage, optional auth.
6. Verify deployment state and actual HTTPS response; create local QR and source archive.
7. Render progress, approval and deliverables inside intake, leaving office scene unchanged.
8. Expose continuity skill in Skill Hub and execution prompts.
9. Test failure/restart/duplicate/outcome-unknown/security paths; package full source.

Acceptance is narrower than the long-term A-Z vision: native desktop/mobile installers, payments, custom DNS, arbitrary email providers, social publishing and universally correct AI outputs are not implemented by this web delivery adapter. Never imply the ChatGPT connector grants credentials to this local application.
