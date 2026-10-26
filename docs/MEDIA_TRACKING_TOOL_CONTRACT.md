# Media motion cleanup — tool contract for AI

## Tools that actually exist
- `media.region-remove`: queued, explicitly approved cleanup. Input has source, rightsConfirmed and regions.
- `media.localize`: seven-step Vietnamese localization. `cleanupMode=regions` uses those same regions. Its input stage validates a motion plan before ASR/translation/speech. Other provider/cost/Vault/source-hash gates still apply.
- `POST /api/integrations/media/regions/track`: authenticated local preview with Vault open; computes actual per-frame matches, does not edit the original or publish. Returns source, geometry, frame trajectory and score summary.

A moving region is `{x, y, width, height, start, end, tracking:"template", referenceTime}`. Coordinates are percentages in the selected source frame. `referenceTime` must lie in the active interval. The owner selects the seed; an LLM that only has text/transcript/metadata must not invent it. At most one tracked template per task; fixed regions may accompany it. Rights confirmation remains mandatory for editing.

## Director behavior
The `xoa-logo` intent with `logoMotion=moving` opens the actual region tool with tracking requested and `needsVisualSeed=true`. A localization request with the same motion hint opens `media.localize` configuration. This is a request for the missing visual seed/consent, not a claim the AI has already found/removed the logo. Unknown motion should be clarified using the visible controls rather than assumed detected.

## Evidence, not simulated success
The engine uses FFmpeg `find_rect` on every normalized frame. It verifies source hash, seeded location, matching score, timestamps/frame count, sudden uncertain jumps and border availability before rendering. A native RGB stream is filled from surrounding border samples at the tracked positions. This is spatial interpolation, neither a blur/cover operation nor neural inpainting. No automatic OCR/scale/rotation/occlusion recovery is exposed.

On missing/ambiguous/low-contrast/unsupported/edge cases return the actual typed error and request another seed/interval. Never silently apply a guessed mask or mark missing frames as removed. The new pipeline preserves seven persisted stage receipts and won't call providers after failed input tracking.

Only technical file integrity is checked automatically. Preview/review the entire video for wrong matches and background artifacts. A synthetic QA fixture is not a customer sample, live-provider test, Windows acceptance or commercial certification. Official native-filter reference: https://ffmpeg.org/ffmpeg-filters.html .


## v0.9.79 complex background
A selected template region may add `restoration: "temporal"`. UI selects this mode explicitly; Director sets `backgroundMode: "temporal"`, routes `restorationRequested: "temporal"` and still requires an owner-selected visual seed. No box may be invented.
The native engine searches unmasked rings for integer translations (up to 24 pixels), requires two clean donor patches to agree, copies observed pixels and feathers only the outer 2 pixels. Donors outside the tracked active interval are excluded because their logo position is unknown. This is temporal observed-background restoration, not neural inpainting.
Limits: one region, 30 s, 1280×720 pixel area, 30 FPS, 1.5 GB temporary RGB budget. Disk space is checked. Raw data is deleted on success/failure. No silent fallback to spatial interpolation. Output includes each donor ID, alignment, ring error and donor agreement.
In seven-step localization this restoration runs and is sealed in the input stage before ASR/translation/TTS; the cleanup stage reuses that exact verified artifact. Retry verifies hashes and does not repeat completed inference.
Confidence is not ground truth: independently moving objects behind an opaque logo may be unknowable. Scene cuts, no revealed background, rotation, deformation and large camera motion may stop or remain unsupported. Review output; do not promise universal removal.
