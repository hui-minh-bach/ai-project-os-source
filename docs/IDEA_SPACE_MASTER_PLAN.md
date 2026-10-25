# Idea Studio - SPACE STUDIO R2

## Frozen input and honest scope
Reference: `public/assets/idea-master-concept.png`, the user-selected generated concept. It is a visual target, not a 3D model or production render.
Base: the supplied AI Project OS v0.9.60 chair V1 full source. Preserve account, project, payment, publishing, task, and storage behavior. Do not deploy or change user data.

## Four stages
1. Specify the shared design: cyan/teal enamel, satin champagne-gold trims, navy structure, rounded edges, hex deck, soft lighting. Use a metre-scale Y-up layout and fixed hero camera. Freeze real anchors rather than image-pixel coordinates.
2. Build the complete real 3D room: floating platform; nine modular workstations; manager desk and elevated corner; lounge sofas; control nook; four charge pods; robot-only energy chamber; screens, keyboards, plants, and structural details. Render actual hero and side views. Do not use a painted room background.
3. Produce MP4 from that exact scene and controller: show the whole scene and a close workstation sequence. Approach, reach, pull, move in front, sit, move to keyboard, work, move out, stand, return chair, leave. Use contact-aware articulated motion and actual geometry depth occlusion. The offline proof uses VTK SSAO/PBR; WebGL shadow maps are implemented but not visually verified here. Inspect contact-phase frames and correct observed errors.
4. Integrate the same Three.js scene and controller into the existing Idea Studio, with camera controls, pause/reset, real-fleet labels separate from preview motion, fallback on WebGL failure, and disposal on navigation. Verify syntax, numerical invariants, actual HTTP routes, DOM lifecycle fixtures and the real WebGL failure path; mark successful WebGL/Windows interaction tests unperformed; deliver a complete source ZIP, not only a patch.

## Geometry contract
Y up, metres. Workstation front is +Z; seated robot faces -Z. Floor y=0. Each chair has a real seat plane, backrest, grip, approach and knee/keyboard anchors. Pulling and sitting anchors live in station space. A floor texture may depict surface seams, but desks, chairs and walls must be geometry.
All decor uses one material family. Gold is not flat yellow. Cyan glow is localized; do not overexpose every surface. Use a real environment for reflections and a modest shadow map. Include a lower-quality mode for weaker GPUs.

## Verification gates
- Source, stills and MP4 use one scene module and one motion controller; no alternate prettier video-only scene.
- Inspect hero, alternate angle, chair contact, half-sit, keyboard and standing frames.
- Numerical checks: finite transforms, phase continuity, IK residual, grounded support feet, chair-seat/pelvis relation, no complete stage without evidence.
- Browser checks: load without console errors, pause/resume, seek/reset, camera selection, resize, repeated mount/dispose, context failure message, app entry point.
- Existing app regression tests are reported separately from visual inspection.
- Windows installer/device testing remains not tested in a Linux container. Do not label source as a new EXE.
- Full reference fidelity and multi-agent collision-free navigation require separate visual acceptance. Report any remaining difference explicitly.

## Execution outcome
The complete geometry and 36-second source MP4 were produced. The proof backend is VTK EGL/Mesa using the actual exported Three.js meshes and transforms. No GPU/WebGL success is claimed. Reference-level polish and autonomous multi-agent behavior remain open acceptance gates.
