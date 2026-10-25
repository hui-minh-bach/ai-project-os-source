# BMH scene contract

## Design source

Inspect the current project schema and BMH helpers before adapting the scene. Historically the source stores lengths in metres, rooms as x/y/w/h with zero-based floors, openings linked to room ids, and floor height/slab/ceiling dimensions in project.site.

Reuse scenePlanGeometry, projectLevels, openingWallSpan, roomFurnitureLayout, stairGeometry, stairFloorHoles, slabPanels, and sceneFootprintBounds when present. Do not create a second independent layout that only looks similar to the drawing.

Record the axis conversion for each backend. BMH's plan depth axis, Three.js vertical Y, Blender vertical Z, and glTF export conventions must be mapped deliberately. Apply transforms and reimport to measure a known span. Avoid scaling both mesh coordinates and object transforms for the same unit conversion.

Use one design revision across CAD and 3D. Keep a camera/view specification tied to the selected room/floor. A viewer's landscape rotation and zoom do not change measured geometry.

## Scene acceptance

- Exact building footprint and level heights from confirmed design data.
- Shared wall thickness and actual openings, including wide doors.
- Stairs reaching the next floor with aligned landings and openings; no upward flight through the last-storey roof.
- Actual-scale furniture, doors, windows, and vehicles; stable ids and correct orientation.
- Interior views with visible usable space; exterior views showing the actual entrance and envelope.
- Material references tied to confirmed selections, with generic substitutions identified.
- Reimported GLB/native scene with no missing textures or inverted unit/axis mappings.
- Web assets sized appropriately for the user's device and verified in the actual BMH viewer.

## Tools and primary references

- MCP for Blender: https://github.com/ahujasid/mcp-for-blender
- Blender Python API: https://docs.blender.org/api/current/
- Blender glTF manual: https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html
- FreeCAD MCP: https://github.com/neka-nat/freecad-mcp

Check current upstream installation instructions and available tools. MCP for Blender is a community integration with a Blender addon and a separate MCP process. Its Blender socket port is not an HTTP MCP endpoint. Verify setup against the actual installed version.

For local Codex registration, consult https://learn.chatgpt.com/docs/extend/mcp?surface=cli
For a web/cloud ChatGPT plugin, consult https://developers.openai.com/plugins/quickstart

Keep the local Blender socket private. Use an authenticated connection suitable to the selected surface; do not present a repository link or raw socket as a working web MCP endpoint.

## BMH integration checks

Check scene disposal, renderer remounts, imports, stale asynchronous callbacks, room/floor selection, model loading status, camera resets, and durable material selections in the current implementation.

Provide an interactive compatibility model promptly when GPU support or downloads are unavailable. Permit a slow module to finish and upgrade the viewer; do not permanently cache a timeout as an unavailable renderer.

If a Gemini image is used, capture the matching room/plan reference, track the design signature, and restore the correct room image after reload. Do not alter measured geometry merely to imitate a generated image.
