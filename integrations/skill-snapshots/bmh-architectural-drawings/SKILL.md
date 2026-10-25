---
name: bmh-architectural-drawings
description: Prepare, generate, edit, and verify detailed architectural drawings for Build My Home (BMH), keeping plans, elevations, sections, doors, stairs, and 3D geometry synchronized. Use for BMH architectural drawing, CAD, DXF, SVG, measured plan, floor-plan detail, FreeCAD, or TechDraw requests. Use available BMH code or a verified CAD engine; do not imply that this skill installs or connects FreeCAD.
---

# BMH Architectural Drawings

Honor explicit user instructions and the latest publication authorization. Produce only requested artifacts or necessary code updates.

## Establish the design and tool state

1. Locate the actual BMH checkout or connected repository. Inspect its current project schema, drawing functions, exports, tests, and applicable repository instructions. Treat the user's current project as authoritative.
2. Discover connected CAD tools or an available FreeCAD executable before claiming CAD operations are available. Verify the engine with a small isolated document, measurable box, and read-back. Avoid changing the user's open CAD document for this check.
3. Read [design-contract.md](references/design-contract.md) when converting BMH geometry or choosing a drawing backend.
4. Separate confirmed dimensions from inferred dimensions. For a photo/PDF without calibrated scale, prepare the drawing structure and identify the minimum measurement needed. Do not manufacture plot boundaries, structural dimensions, or surveyed coordinates.
5. Continue useful BMH code work with existing export functions when CAD is unavailable. Label the backend and validation scope accurately. Explain a missing connection only when it blocks the requested output.

## Generate coordinated drawings

1. Capture one design snapshot: plot, setbacks, front direction, floor levels, rooms, openings, stair layout, and selected materials. Use the same snapshot for every sheet and 3D export.
2. Reuse shared wall geometry. Preserve room position, wall thickness, actual opening width/height/sill/offset, stair direction and rise, and upper-floor stairwell openings. Avoid double walls or a neighbouring wall filling an intended doorway.
3. Derive plan, elevation, and section views from actual geometry. Choose a section line intersecting the objects shown. Preserve orientation and annotate north and the entrance consistently.
4. Add legible axes, dimension chains, room names/areas, door/window schedules, levels, scale, and a title block. Keep interactive selection handles, temporary overlays, and UI zoom out of exports.
5. Prefer FreeCAD/TechDraw for CAD model projections when the verified backend supports the requested output. Inspect its actual API/version. Use existing BMH exporters for browser SVG/DXF integration when appropriate.
6. Export the requested formats. Preserve native CAD files when requested; use millimetres at 1:1 for CAD geometry and explicit physical page dimensions for printed sheets. Do not rename an SVG/PDF to a CAD-native extension.

## Verify before delivery

- Check finite coordinates, positive dimensions, bounds, collisions, locked floors/rooms, opening fit, and stair height/headroom against supplied constraints.
- Reopen exported CAD files in a suitable reader. Measure a known span; compare room areas, opening sizes, levels, and stair geometry to the snapshot. A parser audit alone does not establish design correctness.
- Render sheets and inspect labels, dimension overlaps, line weights, clipping, scale, and title-block content at the intended page size.
- Cross-check an edited room, doorway, and stair in both the drawing and 3D representation.
- For BMH code changes, run relevant existing checks and verify the actual desktop/mobile controls involved. Follow the user's current publication instructions.
- Report what was produced and verified. Identify missing design inputs materially limiting the requested drawing. Do not call an unreviewed preliminary export a complete construction dossier.

## Setup guidance

Use the current upstream installation guide in the reference when asked to connect FreeCAD. Explain that the skill is the workflow, FreeCAD is the application, and MCP is the connection. Distinguish local clients from this web/cloud session. Never claim a connection until its tools and read-back succeed.

