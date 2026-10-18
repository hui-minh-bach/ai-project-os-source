# Optional Concat review (checked 2026-10-15)

Public repository: https://github.com/jub0t/concat

- Concat documents JSON-RPC and gRPC (the latter in source builds). Its source uses AGPL-3.0-or-later. No commercial licensing exception has been verified; legal review is required before re-distribution.
- Public repo documentation shows JSON-RPC 2.0 `version`, `project.open`, `edit.apply`, `export.run` and events, plus `concat-cli serve` on 127.0.0.1:7420 with token authorization. Release/API behavior can change between versions.
- This module uses a **loopback-only, token-authenticated** JSON-RPC connector in `src/concat.cjs` that can import an already-rendered MP4, create a project and request export after user approval. It does not install or bundle Concat; the full multi-track editor/Whisper/TTS GUI workflow has not been validated through this JSON-RPC integration.
- If connected, configure an external Concat process on 127.0.0.1 and a short-lived token from the host's secret manager; no wide filesystem access or Internet exposure. Do not store tokens in ZIP or logs.
- GPU acceleration can improve performance, but this package deliberately uses bounded CPU FFmpeg (max 2 threads by default) to work on lower-end Windows hosts.
