# BMH design contract and CAD backend

## Inspect rather than assume

Locate the current BMH project before using historical field names. The implementation has used:

- project.site: width/depth, floors, floorHeight, slabThickness, ceilingDrop, frontDirection, setbacks, and parcel points.
- project.plan.rooms: id, floor, type, name, x/y, w/h, furnitureRotation, and stairDirection.
- project.plan.openings: id, roomId, floor, kind, side, offset, width, height, and sill.
- ui.planner: view/floor/zoom/selection. Treat these as presentation settings.

Confirm units and axes in source. Historically BMH uses metres and zero-based floor indices. Convert metres to millimetres once for CAD. Make Y inversion and elevation axes explicit. Keep latitude/longitude separate from local Cartesian metres.

Inspect shared helpers such as scenePlanGeometry, projectLevels, openingWallSpan, stairGeometry, stairFloorHoles, slabPanels, planDxf, and drawingSheetSvg when present. Reuse or extend them instead of inventing a second design model.

Automatic SVG rotation to fit a tall house into a landscape viewport must not rotate underlying room coordinates or surveyed boundaries. Match pointer transforms and exports to the intended coordinate system.

## Required consistency

Use one design revision for every output. Derive rooms, walls, opening schedules, elevations, sections, and 3D from that revision. Mark generated images as visualizations; do not infer measured geometry from them.

Preserve edits across save/reload, including dynamic material selections and user constraints. Validate room rotation, actual door sizes, stair rotation, and floor openings after regeneration.

Fit furniture and vehicles to room geometry. A small garage may fit a motorcycle but not an automobile. Report missing clearance measurements when relevant.

Use source-backed material specifications. An unpriced product selection is not a confirmed supplier quote or a verified construction detail.

## FreeCAD and TechDraw

Read current primary instructions for unfamiliar setup or APIs:

- https://github.com/neka-nat/freecad-mcp
- https://github.com/neka-nat/freecad-mcp/blob/main/docs/installation.md
- https://wiki.freecad.org/TechDraw_Workbench
- https://blog.freecad.org/2025/10/10/tutorial-getting-started-with-techdraw/

FreeCAD MCP needs an addon inside FreeCAD and an external MCP process. The addon port is an XML-RPC bridge, not an HTTP MCP endpoint. Find the addon directory from the running application instead of assuming a Windows path. Verify actual tools and geometry after connecting.

For local Codex registration, consult https://learn.chatgpt.com/docs/extend/mcp?surface=cli
For ChatGPT Work on the web, consult https://developers.openai.com/plugins/quickstart
Use the authenticated connection appropriate to the surface. Do not expose the raw bridge publicly or present a GitHub repository URL as an MCP URL.

## Sheet acceptance

Check explicit units, view scale, page size, north/entrance direction; bounds matching confirmed input; actual walls/openings and intersecting section views; floor levels/stair geometry; readable annotations; and a measured known span in the reopened export.

Scale and parser validity are evidence of export correctness, not substitutes for missing structural or installation design inputs.
