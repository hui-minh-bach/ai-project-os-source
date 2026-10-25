# One-button delivery contract (R6)

Baseline: v0.9.62 WORKFLOW R4; interrupted R5 source is NOT present.
Goal: approved idea -> existing AI workflow -> reviewed source -> explicitly authorized new cloud resources -> verified deployment -> link/QR/source handoff in Idea Studio.
Protected: all public/space-studio and public/assets bytes; customer Vault, data, existing workflows and providers. No existing cloud project mutation without an explicit exact target.
Scope: web delivery pilot (static, Vite and Next.js); new isolated Supabase project optional. No claim of all arbitrary products or production certification.
Consent: user chooses cloud account, team/org, optional database and publication target; one approval covers listed steps. No paid upgrades, domain purchases, existing database changes or automatic production deployment without approval.
Required gates: current spec; independent task review; test receipt (never NOT_RUN as pass); bounded source snapshot and secret scan; durable receipts before next effect; no blind replay of unknown create outcome; accessible HTTPS deployment; local QR from actual verified URL.
States: preparing, needs-approval, running, needs-action, interrupted, stopped, delivered. Resume reuses existing receipts and rejects changed spec/credentials.
Verification: Node unit/integration with injected provider contracts, localhost API/browser, QR decode. Cloud real credentials and Windows execution NOT_TESTED unless performed.
Deliver one full ZIP including readable source, this plan/checkpoint and evidence.
