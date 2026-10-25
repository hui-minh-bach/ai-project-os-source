# Windows voice / image pool / Concat: implementation contract

## Frozen scope
Delivered R8 is the base. Approved Space Studio/robot/layout assets are protected. No cloud deployment, new public publishing or automated paid image calls were performed during development. This change concerns narrated illustrated story/video production only, not every app feature.

## Real production pipeline
1. Local session + Vault + current project authorization.
2. Read installed SAPI and OneCore/WinRT voices; exact language/voice choice; preview as an actual WAV. PowerShell is static encoded source; narration travels as JSON on stdin. No registry copy, shell text interpolation, browser audio recording or mandatory Piper/HeyGen.
3. Preflight Concat JSON-RPC 0.2 and FFmpeg/FFprobe before image spending. Model catalog discovery has no generation request.
4. Create a fixed image pool from actual Vault identity/catalog/adapter. Auto includes ChatGPT account built-in image tool (runtime permission checked), OpenAI GPT Image API, Gemini Image/Imagen API. Vision/text-only models are excluded. Local FLUX stays an explicit local option. Unknown adapters are not declared supported.
5. Distribute scenes across accounts and fail over the SAME prompt. Four attempts per scene maximum, authentication/quota skips the remaining models of that account. Safety refusal, Vault lock or identity changes stop. Account quota consent and optional billable-API permission are separate; frontend cannot falsify billing/capability bindings.
6. Cache each validated voice phrase and image by content/config hash with SHA-256 receipts. Preserve the successful outputs on a new explicitly approved continuation of the same failed story; Core generic external-replay guards stay intact.
7. FFmpeg prepares independent silent scene clips with modest slow zoom and fade, plus a continuous narration track. Concat creates an EDITABLE project with independent visual, voice, optional music, native title and caption clips. Concat export.run produces the FINAL MP4. This is not a flattened FFmpeg master disguised as a Concat output. It is also not a claim that zoom/fade keyframes are native Concat effects: those are baked into each independently editable scene clip.
8. Verify streams, resolution, duration, narration tail, audible peak, captions, full decode and artifact hash. Only the current run's task artifacts can be delivered. Missing Concat export never becomes an unrelated preview.
9. Save the project, release it for the editor and deliver the MP4/SRT/manifest/Concat receipt to the existing product panel. Publishing still requires separate approval.

## Recovery
- Interrupted image call may have consumed quota even when its outcome is unknown; the UI does not claim exactly-once provider billing.
- Export receipt loss: reconcile a stable fully decodable existing output rather than issue a duplicate export.
- Uncertain or running Concat output: keep the job pending/error with an actionable message. Do not race another exporter. A killed native export may need the user to close/reopen Concat and reconcile; no forced arbitrary process termination.
- Retrying an unchanged scene does not regenerate valid image/audio artifacts. Changed credentials/models fail closed and require fresh approval.
- The app does not keep working after the user's machine/worker is off.

## Scope limits
Concat story supports 1-24 scenes, <=5 minutes, 360p/720p/1080p at25fps. Use shorter pieces for long narratives. No cinematic-text-to-moving-video promise: this pipeline creates voiced illustrated video from still images with motion/effects. Windows only exposes voices it supports; installing a language/keyboard or seeing a browser cloud voice does not guarantee an exportable local TTS voice. No voice cloning.

## QA labels
Native Windows/Concat and customer image credentials were NOT exercised here. The automated UI uses shipped HTML/JS and actual app HTTP through an in-memory bridge because direct browser localhost navigation is blocked in this environment. No CSP was weakened. Speech uses a test-only eSpeak boundary; image APIs and Concat use local protocol fixtures. The fixture emits real H264/AAC media using FFmpeg so video/Range/decode checks are real, while external capability/quality checks remain open. Do not cite this diagnostic video as a native-Concat or Windows-voice showcase.

## Primary references checked
- Microsoft Windows.Media.SpeechSynthesis.SpeechSynthesizer: https://learn.microsoft.com/en-us/uwp/api/windows.media.speechsynthesis.speechsynthesizer
- OpenAI image generation: https://platform.openai.com/docs/guides/image-generation
- Google Gemini image generation: https://ai.google.dev/gemini-api/docs/image-generation
- Concat native API0.2 v0.2.7: https://github.com/jub0t/Concat/blob/v0.2.7/src/README.md
- API requests: https://github.com/jub0t/Concat/blob/v0.2.7/src/crates/concat-api/src/message.rs
- Concat is separate third-party AGPL-3.0 software. This package includes our RPC client, not a redistributed modified Concat binary/source or font files. Existing third-party notices remain.

## Reproduce isolated QA
npm run check
npm test
npm run test:video-pipeline
npm run verify:video-pipeline-ui

UI diagnostic additionally needs Python requests/Playwright, Chromium, eSpeak, FFmpeg, FFprobe. These are test dependencies, not production speech fallback. No test loader is used by RUN-WINDOWS.
