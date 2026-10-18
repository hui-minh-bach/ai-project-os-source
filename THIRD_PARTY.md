# Third-party engine catalog notes

AI Project OS v0.2 **không vendor/copy** source code của các dự án dưới đây. Engine Hub chỉ lưu metadata và có thể clone upstream source theo thao tác rõ ràng của người dùng.

| Engine | Upstream | License/status used by catalog | v0.2 behavior |
|---|---|---|---|
| OpenHands Agent Canvas | https://github.com/OpenHands/OpenHands | MIT | allowlisted source clone; no auto-execute |
| mini-SWE-agent | https://github.com/SWE-agent/mini-swe-agent | MIT | allowlisted source clone; detects `mini`; no auto-execute |
| CrewAI | https://github.com/crewAIInc/crewAI | MIT | allowlisted source clone; detects `crewai`; no auto-execute |
| Microsoft Agent Framework | https://github.com/microsoft/agent-framework | MIT | allowlisted source clone; library integration target |
| MetaGPT | https://github.com/FoundationAgents/MetaGPT | verify upstream LICENSE before redistribution | optional source clone; no auto-execute |
| GPT-Pilot | https://github.com/Pythagora-io/gpt-pilot | FSL-1.1-MIT future; upstream security warning | **BLOCKED** |

Before distributing a build that vendors or modifies upstream code, re-check the exact current license at the pinned commit and include all required notices.

## Concat (independent managed AGPL video editor)

- Repository: https://github.com/jub0t/Concat ; upstream tag `v0.2.7`.
- Concat authors retain their own copyright. Licensed under **AGPL-3.0-or-later**; its Slint graphical runtime uses **GPL-3.0-only**, FFmpeg-linked codecs may carry additional GNU terms. See upstream `LICENSE` and `THIRD_PARTY_NOTICES.md` before commercial redistribution.
- AI Project OS does **not merge or relicence** the Concat Rust engine as proprietary Node.js source. Concat is installed as a **separate independent program** controlled using documented authenticated JSON-RPC on `127.0.0.1:7420`.
- ZIP v0.8.4 does **not** contain the Concat installer binary. With the user's consent, it can fetch the original upstream Windows setup (v0.2.7, pinned SHA-256) and install it for that user. The Windows **offline builder** stages that upstream installer, its full corresponding source and notices inside one AI Project OS setup instead.
- Upstream Windows installers are currently **unsigned**; some Windows machines will refuse to run them. Never evade OS policies. Model downloads for Whisper/TTS in Concat occur separately on explicit customer request.
- The `edit.apply` API provides timeline commands, but Concat 0.2 does not expose public standalone Whisper/TTS RPC calls; those stay within Concat GUI or with another opt-in local engine.
- No full commercial AGPL downstream compliance audit has been completed. Do not redistribute a combined offline installer commercially until the obligations, source availability and third-party license notices have been reviewed.

## Whisper.cpp (external optional transcription)

Whisper is not embedded in this ZIP. Enable captions only after installing an authorized `whisper-cli` executable and model separately, and configuring paths locally. Model use remains subject to its own license and privacy conditions.
