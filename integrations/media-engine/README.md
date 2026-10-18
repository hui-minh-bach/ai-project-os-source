# AI Project OS — Independent Media Engine module (V07–V10)

An **installable module**, not a separate application. Backend video processing runs offline using FFmpeg, with optional AI tasks routed exclusively through host `ProviderGateway`.

## Run the verified demo

```powershell
node --version
ffmpeg -version
ffprobe -version
npm test
npm run demo
```

The demo is an **explicit local mock** of CoreServices. It generates original test patterns and a Vietnamese story with a robotic `espeak` test voice; it is not live Windows host integration or real Whisper STT. Final demo files are in `artifacts/demo-workspace/artifacts/`, acceptance report in `artifacts/validation.json`.

Open `docs/INTEGRATION.md` for task registration, `docs/ACCEPTANCE.md` for PASS/BLOCKED flags, `docs/CONCAT-REVIEW.md` for version and security notes.

Optional: `adapters/whisper-cli-gateway.cjs` is a **host-side** example of using a user-installed Whisper.cpp model through ProviderGateway; do not install models or call paid providers without consent. No credentials, browser cookies, billing integrations or live publishing are included.

## Security

- Dedicated workspace root; rejects paths outside and symlink escapes.
- Bounded import size/duration, process timeout, per-video scene count, bounded CPU threads.
- Cached scene-specific render files; restarted jobs reuse valid chunks and render new clips if inputs changed.
- Concat JSON-RPC limited to loopback with token; publisher `media.publish` is hard locked.
- **Never replace or delete the provided `không xóa không xóa.zip` worker archive.** No files from it are duplicated into this package.
