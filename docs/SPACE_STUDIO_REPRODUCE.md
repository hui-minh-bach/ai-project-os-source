# Reproduce the real-source scene and video

## App runtime

No new npm dependencies are needed by this room. Three.js and its required addons are vendored under `public/vendor/`. Geometry and materials are built by `public/space-studio/scene.mjs`; dimensions/layout by `design.mjs`; motion and IK by `motion.mjs`. The source app loads the same modules.

`npm run check` verifies syntax. `npm run test:space-studio` verifies the pure motion/controller modules. The complete existing suite is `npm test`; some fixtures require their own temporary data roots, so do not force one shared AI_PROJECT_OS_DATA_DIR across the whole suite.

## Offline rendering

Optional Python tools: numpy, Pillow, vtk and playwright; a local Chromium executable; FFmpeg on PATH. These tools are not required to use the Windows app.

```text
python scripts/space-studio/export_scene.py --out .cache/space-scene --video --fps 24 --chromium PATH_TO_CHROMIUM
python scripts/space-studio/render_offline.py .cache/space-scene evidence/space-studio
python scripts/space-studio/render_video.py --input .cache/space-scene --output Idea_Studio_R2.mp4 --samples evidence/space-studio/video-samples
python scripts/space-studio/verify_integration.py --chromium PATH_TO_CHROMIUM --out evidence/space-studio/dom-checks.json
python scripts/space-studio/verify_http.py
```

The exporter evaluates the actual local JavaScript modules using in-memory module URLs, with no remote asset requests and no WebGL. TAM19 bytes come from the shipped local GLB. VTK renders those exact mesh attributes, world matrices, texture maps and camera poses. It does not replace the room with a generated picture.

The capture manifest records the source hashes at export. Subsequent lifecycle/error/stop-at-end fixes do not change the deterministic pose or room geometry. The verification report also records delivered-source hashes. This is not a claim that the VTK and Three.js shaders render identical pixels.

## App controls and lifecycle

`app-integration.mjs` lazily mounts the new mode only for Idea Studio. `controller.mjs` owns exactly one scene and disposes a scene that completes after navigation away. The renderer is disposed on leaving the tab. DOM fixtures mock the renderer, so their success does not certify GPU output.

The new rendering mode never triggers provider requests. The existing app supplies a sanitized read-only fleet projection; the visual demonstrator is clearly labelled separately. Locking the Vault returns HTTP 423 on the fleet endpoint, not a misleading empty successful fleet and not an internal server error.

The scene is preauthored, not reconstructed automatically from a photograph. Geometry approximates the chosen concept; more detailed art work and target-GPU review are still needed for the same visual polish.
