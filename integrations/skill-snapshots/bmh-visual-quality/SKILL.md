---
name: bmh-visual-quality
description: Improve actual Build My Home (BMH) visualization against user photos, videos or render references. Use when BMH looks ugly, box-like, unfinished or unlike a supplied reference; for production furniture, stair appearance, PBR surfaces, lighting, cameras and visual acceptance. Apply to code and real scene output.
---

# BMH Visual Quality

Use alongside bmh-interior-exterior-3d. Read [visual-review.md](references/visual-review.md) before changing a scene. Honor current publication authorization; improve BMH itself so customers receive the result.

## Establish visual evidence

1. Locate the actual project, renderer and assets. Inspect reference media, extracting representative video frames when needed. Distinguish CAD drafting, interactive 3D and illustrated rendering references. Do not invent missing videos.
2. Capture the existing exterior, living room and stairwell from one saved design snapshot. Record room ids, dimensions, camera, lighting and design revision. Preserve these for comparison.
3. Prioritize visible failures: framing, missing geometry, intersections, primitive silhouettes, surface scale, lighting, then decoration. Identify the highest-impact gap in each view.

## Improve the implementation

1. Preserve shared plan dimensions, openings, stair levels and editable state. Change presentation meshes without changing the customer's plan merely to resemble a reference.
2. Give stairs coherent flights and landing, a plausible underside, separate tread/riser finishes and applicable guards. Derive these from shared stair parts; verify the top reaches the next finished floor. Treat guard/headroom/structure values as design inputs requiring review, not certified defaults.
3. Replace conspicuously primitive furniture with bounded, realistically scaled geometry or licensed assets. Inspect pivots, bounding boxes, upholstery and clearances. Reuse the existing loading/disposal workflow. Do not call a generic model the selected SKU.
4. Use physically scaled maps and meaningful roughness; distinguish colour and data-map colour spaces. Add bevels where they improve edge lighting. Preserve texture caching and disposal.
5. Compose an exterior showing the actual entrance and footprint, and furnished rooms from usable eye-height and overhead cameras. Keep authoritative walls/ceilings while omitting covers in inspection views.
6. Balance daylight, environment and local lights using real screenshots. Check exposure, shadow bias and contact. Do not hide defects behind dark lighting.
7. Verify real Blender/CAD tools before promising native operations. Continue browser-engine work if unavailable. Do not substitute generated imagery for an editable measured model.

## Verify visible results

- Inspect fresh renders beside matching baseline/reference frames. Apply the rubric and revise major failures. Show actual BMH output when reporting improvement.
- Inspect an exterior, furnished living room and stairwell, plus an edited room and changed stair direction. Verify existing customer projects receive the upgrade.
- Check desktop/mobile controls, framing, missing assets, loading and responsiveness. Measure device performance for FPS claims; headless render counts do not establish mobile FPS.
- Run appropriate geometry/function checks separately. Passing tests do not establish visual quality.
- Keep Gemini illustration optional and separately verified. Preserve server-side secrets, design signatures and runtime model discovery.
- Report remaining visible shortcomings candidly. Claim reference-level quality only after inspecting comparable output. Installing this workflow alone does not modify the renderer.

