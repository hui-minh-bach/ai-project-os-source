# Idea Studio: fixed reference, real 3D, honest verification

## Contract
Use the user's selected cyan/teal/gold floating-space-office image as the visual target, not as a flat backdrop disguised as 3D. The concept is not proof of equivalent production geometry. Preserve its zones: manager office, workstations, charging pods, robot-only energy chamber, lounge, control area, hex floor, rounded platform, illuminated trims, and space background.

## Shared scene
- Use one versioned scene description and one deterministic motion controller for stills, MP4, and app integration. Prefer the application renderer. When that renderer cannot run, a documented offline backend may render its exported geometry and transforms, but label the backend difference, preserve unresolved GPU acceptance, and do not claim identical pixels or a screen recording.
- Make tables, chairs, partitions, floor, pods, and structural frames actual geometry. A static texture may decorate monitors or provide a distant starfield; it must not hide missing furniture geometry.
- Use consistent units (metres), axes (Y up in Three.js), material palette, scale, and camera. Save an explicit hero camera and at least one side view.
- Keep seats as distinct objects with seat height, backrest contact, approach, and sitting anchors in local 3D space.
- Keep the demo separated from actual AI tasks. Simulated motion must not claim a real provider is working.

## Contact-aware motion
- Approach from an accessible aisle, decelerate, align, and reach the chair before moving it.
- Maintain the active hand-to-chair contact during pulling and returning.
- Position the pelvis over the cushion and feet on the floor; do not stand on the cushion, penetrate the backrest, or lower the whole model through the floor.
- Move the occupied chair and seated pelvis together. Separate the head/torso animation from lower-body contacts.
- Place typing hands at actual keyboard targets. Stand only after moving clear of the desk; release the chair before walking away.
- Use a contact/IK or explicitly calibrated procedural solver. Report residual error and any incomplete collision coverage. Do not describe scripted kinematics as a rigid-body physics simulation.
- In a live fleet, reserve chairs and fail closed on unavailable destinations. Do not teleport through a blocked path. Do not silently equate preview routing with production multi-agent navigation.

## Review gates
1. Render real hero and side views; compare proportions, silhouettes, palette, camera, and zone placement against the concept.
2. Inspect close views at reach, pull, half-sit, seated, keyboard contact, stand, and return phases.
3. Exercise play/pause/reset, camera controls, resize, reload, repeated mount/dispose, background-tab behavior, missing-model handling, and WebGL failure handling.
4. Test real app integration and relevant regression tests. State exactly which operating system and renderer were exercised.
5. Include actual render/video evidence and open issues in the source package. Do not label the concept's appearance matched unless the produced scene supports that claim.

## Handoff
Provide a full source ZIP, MP4 from that source, a real preview, and the packaged skill. Avoid unrelated reports as separate downloads. Include readable source and instructions, not only minified output. Do not silently replace the user's data or original runtime.
