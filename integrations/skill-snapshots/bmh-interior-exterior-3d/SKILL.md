---
name: bmh-interior-exterior-3d
description: Build, edit, and verify synchronized interior and exterior 3D scenes for Build My Home (BMH), including rooms, stairs, doors, furniture, materials, lighting, camera views, Blender renders, and web GLB assets. Use for BMH room 3D, house visualization, Blender, GLB/glTF, realistic interior/exterior, or drawing-to-3D requests. Check actual tools and engine availability; this skill does not itself install or connect Blender.
---

# BMH Interior & Exterior 3D

Honor explicit user instructions and current publication authorization. Keep the measured model, material choices, and visual output tied to the user's current design.

## Establish input and tools

1. Locate the real BMH project and inspect its current plan, shared geometric helpers, material selections, and renderer. Read [scene-contract.md](references/scene-contract.md) before adapting axes, units, stairs, or export formats.
2. Discover actual Blender MCP tools or an available Blender executable. Verify access with a small isolated scene and object read-back before claiming to control Blender. Preserve the user's open scene.
3. Use current source files, confirmed dimensions, and design revision as the authority. Treat uploaded imagery as a style reference unless its measurements were calibrated.
4. Continue available BMH renderer/code work when Blender is unavailable. State the backend actually used and the connection still needed for a Blender-native deliverable. Do not substitute a generated picture for a measured 3D scene.

## Build from shared geometry

1. Capture the same design snapshot used by the architectural drawing workflow. Preserve the plot and building footprint, setbacks, floor levels, wall thickness, door/window spans, stair flights/landings, upper stairwell holes, and roof footprint.
2. Keep room edits, stair direction, doorway position, and furniture rotation consistent in the plan and model. Merge shared walls and cut openings before placing frames or glass.
3. Place furniture at real scale with room bounds and circulation in mind. Use geometry bounds of imported assets; verify orientation and keep them off stairs and doorway clearances.
4. Give objects stable names/identifiers linked to room and opening ids so editing or regenerating a room updates the intended objects.
5. Use selected product specifications and actual textures when available. Track generic visual materials as generic; do not claim an unrelated texture is the selected SKU.
6. Compose exterior and individual room views with suitable lens, target, clipping planes, and exposure. Keep roof/ceilings out of interior inspection views without deleting them from the authoritative model.
7. Add appropriate roughness, glass, light sources, shadows, and material scale. Compare with the user's reference style and revise framing and detail from actual renders. Do not call a scene photorealistic solely because a render completed.

## Produce and verify

- Save the requested native scene, rendered images, or web assets. Export GLB/glTF for BMH when requested; inspect actual exporter options and version.
- Reimport exports into a fresh scene or suitable viewer. Check dimensions, transforms, material/texture references, scene bounds, and floor/room identifiers.
- Compare a known building span, opening size, and stair height/landing to the drawing snapshot.
- Inspect an exterior, a furnished room, and a stairwell from actual output. Check clipping, missing assets, intersections, light/exposure, and room-specific camera framing.
- For web integration, verify asset loading and editing -> render -> room focus -> save/reload. Check desktop/mobile orbit, zoom, reset, and layout. Ensure a delayed 3D download can upgrade from a visible compatibility view when complete; test no-WebGL and interrupted context when relevant.
- Render expensive samples at preview settings first. Ask only when a real requested external paid service or irreversible action lacks authorization; follow existing authorization.
- Keep Gemini visual generation as an optional illustration workflow using the user's existing server configuration. Verify image generation and quota separately from key acceptance; keep secrets server-side and select supported models from runtime discovery.
- Report delivered outputs and actual checks. Separate measured geometry from illustrative renders and identify unresolved missing input that materially affects the result.

## Setup guidance

Use the current MCP for Blender upstream instructions when asked to connect it. Explain that Blender must run where the chosen connection can reach it. Distinguish a local Codex client from a web/cloud session. Verify returned scene objects before reporting a successful connection.

