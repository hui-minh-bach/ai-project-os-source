---
name: bmh-design-review
description: Review Build My Home (BMH) design geometry, room usability, floor and opening coordination, drawing/3D consistency and engineering-review gaps. Use for building-design validation, constructibility review, synchronized architectural dossiers, invalid plans and requests for engineer-quality BMH output. Include a read-only snapshot checker; do not certify structural or regulatory compliance.
---

# BMH Design Review

Use alongside bmh-architectural-drawings and bmh-interior-exterior-3d. Read [review-scope.md](references/review-scope.md). Honor publication authorization and preserve user edits, locks and confirmed measurements.

## Capture the authoritative design

1. Locate the actual project and inspect the current schema and shared helpers. Capture a JSON snapshot from the project's canonical store, excluding API keys, tokens and personal media. Record revision, units, footprint, floor levels, rooms, openings and stair geometry.
2. Distinguish surveyed dimensions, customer inputs and inferred photo/PDF values. Do not infer a structural column grid from room-edge reference axes or assume a photograph provides scale.
3. Run `python3 scripts/review_snapshot.py /absolute/path/snapshot.json`. Accept a project object or a state containing project. Read the entire report; it checks basic rectangular room/opening data, not engineering suitability. Inspect any schema differences before adapting the checker.

## Review beyond numerical validity

1. Follow actual access from entrance through rooms and between floors. Check doors, furniture clearances and requested household accessibility. Keep geometric connectivity distinct from unobstructed circulation.
2. Use shared stair geometry for rise/run, direction, landing and upper-floor well. Inspect arrival at the next finished floor, slab holes and measured headroom using actual model geometry. Mark missing guard, support and headroom inputs for review; do not invent approved structural sizes.
3. Inspect wall joins, paired-room door openings, wet-area alignment and actual setbacks. Check edit locks and history before making changes. Avoid silently replacing the customer's chosen design.
4. Distinguish architectural geometry from structural and MEP design. Identify missing site survey, soil information, loads, foundation/structure decisions and service routes when they affect the requested output.
5. Browse current official standards only when checking a specific rule. Record jurisdiction, version, source and assumptions in engineering evidence, while keeping ordinary customer screens readable. Do not embed remembered regulatory thresholds as universal facts.

## Verify coordinated output

1. Derive plan, elevation, actual-cut section, opening schedule and stair details from one snapshot. Reuse existing geometry and export helpers; do not maintain independent lookalike models.
2. Measure a known span, opening width, floor level and stair rise in actual SVG/DXF/PDF and 3D output. Reopen exports with appropriate readers. Inspect physical page scale, legible annotations and untruncated schedules.
3. Exercise a room edit, door motion and stair direction change through real desktop/mobile controls. Verify both drawing and 3D update, undo/redo, save/reload and applicable locks.
4. Separate findings into numerical geometry defects, usability defects, coordination defects and unresolved engineering inputs. Return precise locations and a corrective action. Do not turn a clean checker report into a claim of construction readiness.
5. Fix authorized code/workflow defects and verify actual results. Use bmh-visual-quality for visual shortcomings; passing geometry tests alone does not establish attractive rendering.

Report delivered changes, actual verification and material remaining gaps. Installing this skill does not itself connect CAD software or add customer-facing features to BMH.

