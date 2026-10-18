---
name: ai-media-engine
summary: Safely integrate Media Engine as CoreServices v1 background worker tasks.
---
# AI Media Engine skill

Only register `media.*` tasks through an explicitly supplied `CoreServices` bridge.
Never write in AI Core, Vault, Router, AI Council, or shared UI files. Do not read secrets from another project's config.
Run `npm test` and `npm run demo`, inspect `artifacts/validation.json` and FFprobe on the real resulting MP4s.
For TTS, STT, translation, image model generation, and AI edit plans, call through `ProviderGateway.invoke` ONLY.
Do not silently claim Vietnamese TTS is natural: the espeak adapter is a robotic test double.
Do not publish for real. V10 requires authorized OAuth, real platform API tests, approval, and explicit opt-in.
Concat optional: prefer FFmpeg, JSON-RPC only on loopback, token mandatory, version probe before editing; never expose to the Internet.
A `.zip` upload is a source snapshot, NOT proof the user's live Windows worker has been updated.
