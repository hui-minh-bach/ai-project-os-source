# AI Project OS 0.9.68 - Auto reception, 3D seated workstations and narrated Concat delivery

## What actually changed

- **One-click Radar handoff:** choose a news card and click **Làm việc**. Server creates reception project, carries authorized project AI team assignments and starts `auto-produce` once per reception ID. One job records actual Founder/Worker/Reviewer AI steps; no artificial dialogue is generated.
- **Manager:** `Giao file khi hoàn thành` now reads real workflow records and shows a separate artifact inbox. The old manual video type/voice/image/renderer inputs are removed. Ingestion and actual publishing are separate; no automatic external publication.
- **Actual downloadable outputs:** a successful narrated Concat/FFmpeg story exports the verified final MP4, joined narrated WAV, SRT, VTT, Markdown script and first real scene thumbnail; audio and image/video preview players work from the saved artifact endpoint. A missing/failed Concat export is not replaced by a preview.
- **Voice source:** Concat is an editor/renderer; Concat v0.2 remote JSON-RPC does not provide TTS methods. Windows Vietnamese SAPI/WinRT or installed Piper generates actual WAV, captions are derived from narration, and separate tracks are imported into Concat. Free voice and image capabilities must be ready before starting an unattended job. Optional paid services require separate opt-in.
- **3D:** nine existing workstation positions remain unchanged. First nonempty roster (even after a blank/loading feed) seats up to nine connected robots. Remaining online READY avatars remain at desks instead of collecting at the entrance after an idle timeout. Busy avatars occupy reserved chairs, finishing jobs release chairs when appropriate; excess avatars wait visibly if no station is available. Label overlay is gently separated without changing robot geometry or rig.

## Launch on Windows (source release, not rebuilt native installer)

1. Extract the entire ZIP into a new directory. Preserve original app/data installation; DO NOT overwrite the old app while checking.
2. Install Node.js 22 or newer and FFmpeg/FFprobe if not already present. Run **`RUN-WINDOWS.cmd`**. `AI-Project-OS.exe` in this archive is the unchanged existing launcher, NOT a newly compiled 0.9.68 EXE.
3. Unlock Vault, connect supported AI account(s), verify Founder/Worker/Reviewer and their model bindings in **Kết nối**. Select actual news source in **Radar tin** and click **Làm việc**.
4. Set **Windows Vietnamese Speech** or **Piper** voice once in Media Studio. Connect a local free image generator such as FLUX/ComfyUI or upload eligible scene images. Optionally connect **Concat** using its installed local remote API; app tests readiness before rendering. If Concat isn't configured, the automatic path explicitly uses local FFmpeg instead.
5. Watch **Idea Studio → Giao file khi hoàn thành** for persisted AI job receipts. Download the final MP4, `voice.wav`, `captions.srt`, `captions.vtt`, `script-final.md`, `thumbnail.png` after an actual successful job. Do not publish from that inbox; publishing retains its own explicit approval.
6. If no Vietnamese voice, image service or final Concat API is available, the job returns a diagnosed block rather than silent video generation. The manager UI has a collapsed **Thiết lập hệ thống một lần** section for settings.

## R9 verification and limits

| Gate | Actual evidence | Claim |
|---|---|---|
| Static | `npm run check` | Syntax only |
| Unit/regression | `npm test` | Code behavior incl. media contract and seat allocation |
| Real Three.js DOM/GLB geometry | `python3 scripts/space-studio/r3/verify_browser.py --out evidence/v0968/r9-geometry-browser.json` | Nine independent seats, chair/pelvis/hand contact, no standing-cluster after idle, 23 DOM/geometry checks |
| Real WebGL pixels | `AIOS_XVFB=1 xvfb-run -a python3 scripts/verify-r9-webgl.py` | Chromium Xvfb/software renderer, six bots at six chairs; **not Windows GPU** |
| Offline source render | `evidence/v0968/scene-r9/hero.png`, `robot-close.png` | VTK render of same exported geometry/poses; **not Windows** |
| Actual HTTP/browser pipeline, injected providers | `python3 scripts/verify-automatic-r9.py` | Six end-to-end assertions, actual MP4 with audio+video independently decoded, six files from source and API, browser HTML audio/video/thumbnail elements actually loaded |
| Native Windows, native Concat GUI, owner providers | NOT_TESTED | Must be exercised on intended Windows PC before claiming 100% commercial readiness |

The R9 integration test uses real app HTTP and browser, real audio generated via **test-only eSpeak**, a **mock ComfyUI protocol server** making an explicitly procedural illustration, and a **mock Concat RPC server** whose FFmpeg exports a real narrated MP4. The tests prove app orchestration and artifact delivery; they do not prove that the user's specific Concat app, paid accounts, GPU and installed Vietnamese voice are configured and working.

## Protected scope, trust and provenance

- Compare to original 0.9.67 source: **79/81 protected files unchanged**, only the two authorized live motion/overlay files changed; the 9-chair room meshes and robot GLB are unchanged.
- Preserve prior 0.9.67 delivery artifacts, source, code and skill. Runtime `.data/`, user credentials, encrypted Vault, caches and scratch build logs are excluded from the distributed ZIP.
- No remote GitHub pushes, deployments, API expenses or scheduled processing were done for this release.
- For replay, see `scripts/verify-automatic-r9.py`, `scripts/verify-r9-webgl.py`, `test/auto-reception-r9.test.mjs` and the `evidence/v0968/` JSON/PNG/video fixture evidence.
