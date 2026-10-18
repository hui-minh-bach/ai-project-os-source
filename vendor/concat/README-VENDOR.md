# Concat: independent open-source video editor (AGPL-3.0-or-later)

AI Project OS uses the public, token-authenticated JSON-RPC 0.2 API and does not
copy or link Concat Rust code into its Node.js runtime.

- Windows version pinned: Concat v0.2.7, x64.
- Upstream: https://github.com/jub0t/Concat/tree/v0.2.7
- Official installer: https://github.com/jub0t/Concat/releases/download/v0.2.7/Concat-0.2.7-windows-x86_64-setup.exe
- SHA-256: `305e833449c24c234c935244debd339a4ba25866fe5787c744f374c7ee5b9687`
- License: AGPL-3.0-or-later; bundled dependencies have their own notices.

The **Windows BUILD host** runs `windows/Prepare-Concat-Bundle.ps1` to stage a
verified, unmodified Concat installer, corresponding source archive and legal
notices into this folder. The final Windows installer then contains everything
needed for local Concat without separate customer download. If the installer
is NOT staged (for example, a source-only development ZIP), the optional
one-click Video Studio setup obtains the exact same pinned package from GitHub
and verifies its SHA-256 before use. It never executes a substituted file.

Concat remains a separate AGPL application with its own license and copyright.
Do not represent Concat as proprietary AI Project OS code. Before a commercial
release, obtain appropriate legal review for distribution, notices and source.

Upstream Windows build is currently unsigned (SmartScreen / Smart App Control
may block installation); an unsigned Windows RC is **not** commercial-ready.
