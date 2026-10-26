# AI Project OS v0.9.81 — GitHub source scope and missing binary inventory

## Uploaded to main
The v0.9.81 Video Studio logic is on `main`: OCR word-sized subtitle repair, 8% optional manual band, media UI, server/package version and release metadata. This update also supplies the v0.9.81 start guide and source-level regression tests.

## GitHub is NOT the 361 MB FULL SOURCE archive
A GitHub repo snapshot of the latest `main` is **not** currently a substitute for the separate FULL_SOURCE ZIP. A historical comparison with the bundled v0.9.72 manifest identified **193 binary paths absent in GitHub**, totaling 376,175,219 uncompressed bytes. Main groups: windows_binary 1, evidence 89, media_artifacts 20, 3d_visual 69, vendor 14. See `docs/v0981-legacy-binary-gap.json`. This is not evidence that the v0.9.81 ZIP deleted those files. There is no verified public GitHub Release asset containing that ZIP yet.

Examples still absent in `main`: `public/assets/office-room.glb`, several `public/assets/tam*.glb`, `AI-Project-OS.exe`, and third-party vendor source bundles. Keep the owner's full ZIP and previously installed models/data; do **not** overwrite or delete local AppData/models.

## Run and review
- Node.js >=22, `npm run check` and `npm test` on the source checkout.
- Scoped source checks: `node --test test/media-precise-cover-v0981.test.mjs test/media-renewal-v0980.test.mjs`.
- To run actual video: use the owner's verified FULL_SOURCE ZIP and `RUN-WINDOWS.cmd`; install FFmpeg, Tesseract OCR language pack, speech and translation tools as needed.
- Review a real source video, especially fast/moving captions and complex backgrounds. OCR interpolation cannot guarantee visual erasure.
- Native Windows, GPU, actual AI voice/translation, and commercial validation remain open, despite prior fixture/source QA.

**Status:** GitHub contains the v0.9.81 Video Studio source changes, but no claim of byte-for-byte FULL ZIP equivalence. Binary upload/release and independent Windows acceptance remain outstanding.
