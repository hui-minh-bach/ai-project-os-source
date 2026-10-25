# Free Local Stack - source/QA contract

Base: `v0.9.66` ZIP, feature work: optional ComfyUI HTTP adapter and free-stack diagnostics. No official runtime binaries downloaded.

Protected: `.data`, Vault, all room geometry/graphics, 81 approved scene/asset files, previous Work Center and production review rules.

Component boundaries:
- `comfyui-local.mjs` talks to an external program via localhost HTTP. Workflow ownership rests with the user. No ComfyUI source/binary included or executed by AI Project OS.
- `image-gen.mjs` implements approved binding, free-first preflight and failover: local ComfyUI if online -> installed FLUX worker -> approved account tools; billable accounts only with `allowPaid === true`.
- Comfy output must contain file bytes, with PNG/JPEG/WebP magic, size bounds. No placeholder image replaces a model failure.
- Configured Comfy server is NOT considered healthy until `/system_stats` succeeds; errors in execution remain visible.
- `free-stack.mjs` is read-only and calls only local endpoints `/system_stats`, Ollama `/api/tags`, plus executable version probes.
- `Engine Hub` shows availability and official links. It does not silently install, execute strangers' code or pick a paid cloud vendor.

QA gates: `npm run check`; `node --test test/free-stack-r10.test.mjs`; `npm test`; smoke authorized local HTTP session; verify 3D protected hashes and ZIP integrity.

Open: live GPU on Windows, actual offline image generation/real Comfy workflow/Concat native/voice installed, external providers and complete client-facing A-Z. Commercial distribution licenses require independent review.
