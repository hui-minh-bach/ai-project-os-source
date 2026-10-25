# BMH design review scope

## Canonical representation

Inspect current code before relying on this historical schema: `project.site` stores width/depth/floors and optional floorHeight/slabThickness/ceilingDrop in metres; `project.plan.rooms` stores id/floor/type/x/y/w/h; `openings` stores id/roomId/floor/kind/side/width/height/sill/offset. Floors are zero-based. Room depth is plan Y; Three.js height is vertical Y, with plan depth mapped to Z. Confirm glTF/Blender axes when exporting.

The checker is read-only. It validates finite positive dimensions, rectangular lot bounds, duplicate ids, room overlaps, opening references/floor/side/width/offset and optional opening vertical fit. Room-bound rectangles are a coarse model. It cannot establish parcel-polygon fit, shared-wall topology, swing clearance, furniture access, stair suitability, structure, MEP or legal compliance. Inspect them separately with real geometry.

## Review layers

| Layer | Evidence | Unresolved information |
| --- | --- | --- |
| Basic geometry | Canonical snapshot and checker report | Invalid/missing numeric inputs |
| Circulation | Actual doors, furniture and model walk-through | User mobility needs, unobstructed clearances |
| Stairs | Flights, landing, floor levels, slab holes, section | Headroom, guards, support, reviewed dimensions |
| Architecture | Same-revision plans, elevations, actual-cut sections | Confirmed lot boundary, setbacks, roof/wall construction |
| Structural/MEP | Qualified design inputs and reviewed calculations/routes | Survey, soil, loads, foundations, services |
| Regulation | Current official jurisdiction-specific sources | Applicable building classification and reviewer acceptance |

Do not supply invented structural member sizes or foundation recommendations from a photograph. Treat site/soil suggestions as preliminary until actual inputs support them. A 3D cutaway omitting walls or ceilings is a presentation view, not proof that the building can be constructed that way.

## Current workflow inspection

Locate scenePlanGeometry, projectLevels, openingWallSpan, doorLeafGeometry, stairGeometry, stairFloorHoles, slabPanels and drawingRevision when available. Compare floor heights and top-finished-floor offsets, not only step count. Verify that a common wall opening is retained from either adjoining room. Keep user camera zoom out of physical-scale exports. Persist drawing selection and section cut through canonical state merging.
