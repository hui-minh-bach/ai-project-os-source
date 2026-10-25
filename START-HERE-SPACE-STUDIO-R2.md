# AI Project OS 0.9.61 - SPACE STUDIO R2.1

**Source preview, based on the supplied 0.9.60 project. Not a new Windows installer and not commercial acceptance.**

## Open the application on Windows

1. Close the old AI Project OS process/window first. The launcher intentionally refuses to reuse an older running version.
2. Extract this complete archive into a new folder. Do not run it inside the ZIP, and do not overwrite your old copy before inspecting this candidate.
3. Run `RUN-WINDOWS.cmd`. The existing launcher needs Node.js 22 or newer. Its original portable-runtime setup remains available when Node is missing.
4. Open **Idea Studio**, then **Phong 3D R2** (the button has Vietnamese accents in the app). On a new preference this room opens automatically when entering Idea Studio.
5. Select the close workstation camera and press Play. Drag to orbit, scroll to zoom, use the timeline to inspect a contact, or reset to the beginning.

The root `AI-Project-OS.exe` is the inherited launcher from the base project, not a newly built installer. Use the command above for this source candidate. No Windows executable has been certified by this work.

## What changed

- Real, editable Three.js geometry for the whole floating office: nine workstations, independent swivel chairs, leader area, lounge, control desk, four charge pods, an energy chamber, screens, keyboards and plants.
- A single teal/cyan/gold material family and a locked hero view, plus close/side/alternate views and orbit controls.
- The original TAM19 robot mesh is used with articulated joints, analytic two-bone IK, planted-foot walking and a scripted chair interaction. Its embedded old desk/tablet is removed for this scene.
- The chair is an actual 3D object. A grip anchor, seat/pelvis anchor and floor anchors coordinate pulling, sitting and standing.
- One 30-second demonstrator sequence: approach, reach, pull, move in front, sit, move to keyboard, work, move back, stand, return chair, leave. It stops at the end instead of snapping back in a loop.
- Integrated as a real Idea Studio mode. The previous room and all existing account/project/media workflows remain available.
- Real account status is displayed separately. The robot choreography is a visualization, not invented task progress. It is not yet autonomous movement for every linked AI account.
- Failed WebGL startup leaves the old room accessible and shows an error. Leaving the tab disposes the new scene; late asynchronous loads cannot resurrect it.

## View the delivered evidence

`evidence/space-studio/hero_0.png` and the contact sheet are actual renders of source geometry, not AI-generated illustrations.

The delivered MP4 is 36 seconds / H.264 / 1280 x 720 / 24 fps, silent with Vietnamese captions. It contains a whole-room view, the complete chair sequence, and the whole-room view again.

**Render backend:** Three.js evaluates the same room geometry and the same motion controller without a GPU; exported geometry and joint transforms are rendered with VTK EGL/Mesa. It is an offline source render, NOT a Windows screen recording and NOT a successful WebGL render. Material/glass/glow appearance can differ between VTK and the app renderer.

The selected generated concept is retained at `public/assets/idea-master-concept.png`. It remains the target, not evidence that the implementation matches it pixel-for-pixel. This implementation has simpler plants, curved structures and lighting than the concept. Visual acceptance against the concept remains open.

## Skill and continuity

The complete `project-continuity-orchestrator` skill is under `.agents/skills/`, with `AGENTS.md` and a recoverable `.project-state/` checkpoint. It was applied during this work. These files do not install it into the ChatGPT account and do not create an unlimited or background worker.

The separately delivered `skill.zip` is the validated standalone skill package.

## Known limits

- One animated demonstrator, not a collision-free multi-agent simulation.
- Contact-constrained kinematics, not full rigid-body physics. Finger grasp, wheels and foot rolls remain stylized.
- Numerical anchor checks are not proof that every mesh pair is collision-free.
- No successful WebGL render was possible in the current environment. The error fallback was exercised; GPU performance, real browser controls under WebGL and Windows startup still require target-device acceptance.
- The older app's cloud providers, account subscriptions, deployment, device drivers and paid-service workflows were not newly validated against live services.
- Source syntax, unit tests, HTTP routes, DOM lifecycle fixtures and rendered-frame review are recorded separately in the verification report. Do not convert these into a claim of 100% safety or production readiness.

See `docs/IDEA_SPACE_MASTER_PLAN.md`, `docs/SPACE_STUDIO_REPRODUCE.md` and `evidence/space-studio/verification.json`.
