# Dependency and licensing report

- Node.js runtime >= 20. **No npm dependencies** (package.json dependencies are empty).
- FFmpeg and FFprobe external command-line tools must be installed on the host, with H.264/AAC/libass enabled. This code **does not bundle FFmpeg binaries**; inspect your chosen FFmpeg distribution license.
- Optional Python 3 for DOCX extraction through standard library `zipfile` + XML. Text PDF input uses `pdftotext` or optional `pypdf`. Scanned PDF OCR is not silently attempted.
- Optional eSpeak with Vietnamese (`vi`) voice is **only a demo Gateway** and is not recommended for commercial quality.
- Optional whisper.cpp + user-provided Whisper model, connected as a host ProviderGateway. Not downloaded or installed automatically; no bundled pretrained model.
- Optional Concat external application via token-protected loopback only. Concat is AGPL-3.0-or-later; no commercial exception was verified; **no Concat source code, executables, model, or AGPL dependency is distributed with this module**. Its render endpoint was only tested against a local mock, not a live Concat Windows installation.
- No paid API, cloud subscription, service account, or browser profile is needed to run included offline FFmpeg and eSpeak demo. No social network cookie or OAuth tokens included.
