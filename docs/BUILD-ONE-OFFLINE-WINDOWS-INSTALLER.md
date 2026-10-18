# AI Project OS 0.8.5 — one offline Windows installer (build-host procedure)

**This is a developer/build-host instruction; users must not be asked to run PowerShell.**

The portable 0.8.5 source ZIP is not itself an offline installer: the Concat 0.2.7 official binary could not be downloaded into the build workspace used to prepare the ZIP. On a Windows 10/11 x64 build host with Internet, Inno Setup 6 and a trusted copy of the source project, `windows/Build-WorkerC-Internal-RC.ps1` builds **one unsigned internal QA installer** containing:

- AI Project OS portable Windows launcher and application.
- The pinned official Windows Node 22 runtime; no customer npm install.
- The exact Concat v0.2.7 official Windows Inno installer, verified against upstream SHA-256, stored under `vendor/concat`.
- Concat 0.2.7 upstream source archive, LICENSE and THIRD_PARTY_NOTICES for license compliance review.

Developer-only command in PowerShell from the project directory:

```powershell
.\windows\Build-WorkerC-Internal-RC.ps1
```

The script checks downloaded bytes, refuses missing/mismatched assets, stages clean sources (excluding `.data`, Vault and project exports), and compiles `windows/output/AIProjectOS-0.8.5-rc-UNSIGNED-INTERNAL-RC.exe`. You must **verify the actual output path and hash on the build host**; no such offline setup has been compiled in this ZIP.

## Required manual acceptance gates before customers

1. Test installation on clean Windows 10 and 11 VMs, both online and offline. Verify Concat installer is bundled and Windows itself permits it; upstream binary is currently unsigned and Smart App Control may block it. Do not bypass OS protection.
2. Test the one-button Concat install with Vault open; check it creates only `127.0.0.1:7420` Remote config and does not expose the token in browser or logs.
3. Import a customer sample with video, soundtrack, speech and SRT. Render multi-track using a real running Concat GUI/Remote and verify frames/audio/subtitles/timings plus SHA-256.
4. Shut down and restart Concat and AI Project OS; verify no previous user Concat settings/data were lost and archives restore.
5. Legal review of AGPL-3.0-or-later, linked GPL components, source disclosure and notices. Sign the complete installer and address upstream Concat's unsigned components before commercial release.
6. Confirm the release-readiness gate is green using evidence, **not** by modifying the gate flag.

## Portable v0.8.5 ZIP behavior

On Windows x64, open `AI-Project-OS.exe` → Vault → Video & Story Studio → **Cài + kết nối Concat tự động**. This automatically downloads and SHA-256-verifies the Concat installer only if it is not already installed. Customers should not need to visit Concat's website or copy a token. This one-time online installation is different from the final offline commercial installer.
