# Local Vietnamese narration R8

A Local Worker supplies rendering/queue tools, not inherently an installed TTS voice. The optional in-app setup installs a per-user engine and model only after explicit permission to download and execute them. Nothing is downloaded just by opening the office. The source ZIP contains neither Piper binary nor ONNX model.

## Sources and trust
- Standalone engine: exact archived rhasspy/piper release `2023.11.14-2`, `piper_windows_amd64.zip` at https://github.com/rhasspy/piper/releases/tag/2023.11.14-2 . It is old upstream software, not represented as current/signed. No independently pinned engine SHA or code signature is available in this build; fixed-source HTTPS is the trust boundary. The download SHA is recorded, not described as an authenticity signature.
- Model: `vi_VN-vais1000-medium` from https://huggingface.co/rhasspy/piper-voices/tree/v1.0.0/vi/vi_VN/vais1000/medium . SHA-256: `ec7c89e2c85f4d1edc24b6120c18aaf1bda614f06b511567eb9c7c0de15e2dab`. The download is rejected if it differs.
- Upstream MODEL_CARD: https://huggingface.co/rhasspy/piper-voices/blob/v1.0.0/vi/vi_VN/vais1000/medium/MODEL_CARD . It identifies the VAIS1000 dataset and CC BY 4.0. That is not a legal certification that every engine/dependency/model use has identical licensing. See upstream notices before redistribution; preserve attribution where required. This package does not redistribute those components, does not replace them with a noncommercial VIVOS model and does not bundle the newer Piper fork.
- The voice JSON is fetched from the versioned upstream path and checked for Vietnamese configuration. It is not independently hash pinned; its fetched hash is recorded.

## Operation
Use Reception > Cai / chon giong Viet local. Windows x64 only for automatic setup; other platforms can choose existing compatible Piper paths. Installed files and a provenance/license note are under the per-user DATA_DIR/local-voice; selected paths are in local-voice.json. In-app path selection takes precedence over legacy environment variables. Existing PIPER_CLI_PATH/PIPER_MODEL_PATH/PIPER_CONFIG_PATH remains supported. No privileged install, PATH modification or silent paid fallback.

Before settings become active, the configured executable must synthesize a valid WAV. Download limits, archive CRC/path/symlink/duplicate checks and temporary staging limit damage from a broken download. Runtime/provider secrets are excluded from the offline speech process environment. Failed setup is surfaced and can be retried; the app does not claim a failed voice is ready. A selected local executable is trusted local code, not a sandboxed program.

Preview uses a fixed Vietnamese sentence; the authenticated WAV expires after ten minutes. Paid providers require explicit consent even for preview. Production applies the chosen voice/provider to every scene; image crossfades retain full sequential narration.

## Evidence limits
Public downloads failed in the authoring environment (DNS/network). Installer and archive contracts were tested with controlled fixtures, NOT a real Windows install. The real render test used installed eSpeak Vietnamese through a clearly labelled diagnostic adapter in a temporary test runtime. It proves audio plumbing, not neural voice quality. Do not ship that adapter as Piper or claim commercial-natural speech from this evidence. Real Windows setup, pronunciation/listening review and provider licensing remain separate acceptance.
