# V0.9.69 — Acceptance evidence / tiếp nhận và sản xuất dịch vụ AI

**State:** SOURCE QA VERIFIED / WINDOWS NATIVE AND OWNER CONNECTED ACCOUNTS **NOT TESTED**. Income and real customer acceptance NOT TESTED. `RELEASE.json` deliberately retains `commercial_ready: false`.

## Implemented in real application code

- A one-brief service-order intake in Idea Studio, validated server-side (30–4000 chars), with two explicit actions: client article or narrated client video.
- Each click creates a separate persisted project/request and requests a gateway-bound Worker, then a **distinct** Reviewer account/model for claim checks. Reviewer may reject or request one correction round. Test-only AI fixture is never used by normal launch.
- Automatic local rendering through the pre-existing media engine. Video requires real sound and final MP4 checked with FFprobe; `ffmpeg volumedetect` blocks near-silent MP4/WAV. Subtitle and narration artifacts are required, with no preview substituted for final. Concat only when its API is configured; otherwise FFmpeg is clearly identified as the fallback.
- One local handoff inbox after approved output. `client-delivery.zip` includes only files from the specific completed customer run, plus a SHA-256 manifest and usage-rights caveat. Vault guard and no implicit social publishing.
- At most 3 simultaneously **running** orders of the same client type. Separate projects do not block each other while a previous customer's file awaits receipt. Idempotent request IDs prevent double creation.
- Retains the v0.9.68 Space Studio/WebGL scene, seated live robots, 10-tab UI, existing old workflow/media routes and external connections. No legacy role assignment rewritten.

## Tests performed (Linux container, 2026-10-24)

- `npm run check` — source syntax check for 192 JS modules, 0 syntax failures.
- All 119 root `test/*.test.mjs` modules run in 11 isolated Node test groups using `--test-force-exit`. Details in `evidence/v0969/regression-results.json` and `test/client-commercial-v0969.test.mjs`. Two media-engine integration test modules also executed separately.
- New service tests cover article writing and distinct Review, rejected claims, content ZIP and SHA-256, two separate projects, real FFmpeg test video containing video+audio, missing WAV and silent MP4 rejection, and old config migration.
- Browser/API integration `scripts/verify-client-business-v0969.py` ran against the **real localhost server and Chromium UI**: clicked submit, displayed status, generated two customer delivery ZIPs, verified checksums, decoded an MP4 with audio/video. Both AI-provider and Concat/Comfy/Windows voice endpoints were **isolated fixtures**; the MP4 frames/voice were genuinely produced by FFmpeg/eSpeak in the test container. See `evidence/v0969/report.json` and screenshots/video.
- Existing news-to-video workflow `scripts/verify-automatic-r9.py` re-run against same app; all six checks passed, including actual output MP4 decoding with test-only Concat RPC and AI fixtures.
- 81 protected 3D asset/controller paths compared against v0.9.68 source; expected all byte-identical. **Not** a new 3D redesign and not native Windows GPU acceptance.

## Non-passing or still-open commercial acceptance gates

1. **REAL USER ACCOUNTS**: no credentials provided. Worker/Reviewer Gemini/OpenAI/Claude login and account rate limits cannot be verified in this container; credentials must remain in owner Vault.
2. **WINDOWS**: `AI-Project-OS.exe` in ZIP is a previously built launcher. Native 0.9.69 EXE, Windows installer/driver/GPU and clean-PC install NOT TESTED.
3. **NATIVE CONCAT + VIETNAMESE SPEECH**: actual Concat desktop/remote API, Piper models and Windows Vietnamese SAPI not run on target Windows device; test fixture is not equivalent.
4. **VISUAL QUALITY & RIGHTS**: procedural test illustrations are not customer-quality AI-generated art. Owner must approve visuals, narration clarity, licenses and any person/brand usage. Video speech correctness was not independently transcribed and verified.
5. **TRANSACTION/REVENUE**: no commercial customer sale, website checkout, billing or conversion demonstrated; cannot guarantee sales or earnings.
6. **COMPETITION/LIVE FLEET**: role routing/recorded tasks work but real parallel multi-provider quota, long-running recovery and 30+ successive live customer jobs must be tested on owner hardware before declaring commercial-grade availability.

## Reproduction and provenance

Run `npm run check` and `node --test --test-force-exit test/client-commercial-v0969.test.mjs`. Linux/Chromium fixture E2E needs FFmpeg, FFprobe, Python Playwright, eSpeak and executes `python3 scripts/verify-client-business-v0969.py`. It does NOT log in to real AI accounts and never calls for money. Source integrity: `node scripts/verify-release-manifest.mjs`, and separately ZIP CRC verification; these checks prove identity, not business utility.

Do not sell this source as a guaranteed turnkey commercial Windows application until the Windows/live-provider and quality gates above are passed on the target machine. Do not overwrite original customer data or assume an old EXE is rebuilt simply because the source version changed.
