# Acceptance and limitations

| Requirement | Implementation | Status for this release |
|---|---|---|
| Import MP4/MOV/etc, FFprobe, frames/audio, scene/silence analysis | Real FFmpeg | PASS on generated MP4; other containers untested |
| Whisper real STT with transcript | Gateway support and optional whisper.cpp bridge; model missing in this environment | BLOCKED — no fabricated transcription |
| Manual subtitle edits/translation/SRT/VTT | Segment operations; translation requires provider | Subtitle editing PASS; translation BLOCKED until provider |
| Rule- or AI-produced structured plan | Deterministic fallback, AI via Gateway | PASS fallback; model route not live-tested |
| Actual edit clip render/preview/final MP4 | FFmpeg | PASS with real 6-second video |
| Movie scene partial cache/retry | Content-aware chunks + atomic clip rename | PASS in functional render; interruption test pending |
| Narration from original Vietnamese story >=1,000 chars | espeak Vietnamese demo via test gateway | PASS mechanical output; naturalness BLOCKED |
| Story illustration consistency | Deterministic repeatable generated landscape; optional image gateway | PASS procedural landscape; **character illustration consistency NOT VALIDATED**; AI image provider BLOCKED |
| Story subtitle synchronization | FFprobe measures each synthesized scene audio duration | PASS 24 measured phrase boundaries; **word accuracy NOT VALIDATED** |
| Story 720p/1080p formats | 1280x720/1920x1080 output switch | 720p video 1280x720 PASS; 1080p mode implemented, not tested |
| Black/audio anomaly detection | FFmpeg blackdetect/silencedetect, audio/video probe | PASS on current test samples |
| OAuth platform posting & scheduling | Draft store, explicit opt-in design, idempotency strategy | BLOCKED V10; no authorized posting tests |
| CoreServices v1 host registration | 4-port adapter registered in tests | PASS mock; BLOCKED host integration (not in supplied ZIP) |
| Concat JSON-RPC render | Read-only version probe; FFmpeg primary | BLOCKED external Concat not installed |
| PR in target AI Project OS repository | Requires accessible correct repository | BLOCKED; local `feat/ai-media` git bundle provided |

**Do not treat all criteria as DONE.** A production DONE requires real Whisper transcriptions, verified Vietnamese natural TTS, host CoreServices integration, and authorized publisher API tests, among other host-level regression testing.
