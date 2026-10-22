# Third-party assets shipped with AI Project OS

Every external asset embedded in this product was verified **free for
commercial use** (MIT / Apache-2.0 / CC0) from its official source on
2026-10-22, per the owner's standing product rule. Anything with an
unclear or non-commercial license is excluded.

| Asset | Source (official) | License | Used for |
|---|---|---|---|
| three.js r160 — `RoomEnvironment.js` | https://github.com/mrdoob/three.js/blob/r160/examples/jsm/environments/RoomEnvironment.js | MIT (three.js LICENSE; a copy ships at `public/vendor/THREE-LICENSE.txt`) | `public/vendor/addons/RoomEnvironment.js` — PMREM environment lighting for the 3D office. Only change vs upstream: the bare `three` import specifier is rewritten to `/vendor/three.module.min.js`, the convention of every vendored addon in that folder. |
| three.js r160 — `RGBELoader.js` | https://github.com/mrdoob/three.js/blob/r160/examples/jsm/loaders/RGBELoader.js | MIT (same as above) | `public/vendor/addons/RGBELoader.js` — loads the HDRI below. Same import-specifier change only. |
| Poly Haven — "Blue Photo Studio" HDRI (1k) | https://polyhaven.com/a/blue_photo_studio (file via https://api.polyhaven.com/files/blue_photo_studio) | CC0 — https://polyhaven.com/license: "Our assets are all licensed as CC0… You can use our assets for any purpose, including commercial work… You can redistribute them… even in a product you sell." | `public/assets/env/blue_photo_studio_1k.hdr` — reflection/ambience envMap for the 3D office room and deck materials. |
| Poly Haven — "Blue Floor Tiles 01" diffuse texture (1k, shipped resized to 512×512 JPEG) | https://polyhaven.com/a/blue_floor_tiles_01 (file via https://api.polyhaven.com/files/blue_floor_tiles_01) | CC0 (same license page as above) | `public/assets/env/blue_floor_tiles_01_diff_512.jpg` — deck floor texture in the 3D office. |
| Kenney — Furniture Kit 2.0 (6 models: plantSmall1, pottedPlant, loungeSofa, lampRoundFloor, bookcaseOpen, rugRound) | https://kenney.nl/assets/furniture-kit (page states "License: Creative Commons CC0"; the kit's own `License.txt`: "License: (Creative Commons Zero, CC0)… This content is free to use in personal, educational and commercial projects.") | CC0 | `public/assets/props/kenney/*.glb` — decorative props at the edges of the 3D office (sofa, rug, bookcase, floor lamp, plants). |

## The owner's own assets (not third-party)

- `public/assets/tam19.glb` and every robot sprite in `public/assets/bots/`
  (including the isometric set in `public/assets/bots/iso/`, rendered from
  that GLB) are the owner's own TAM19 robot model.
- `public/assets/office-iso-backdrop.jpg` was derived from the owner's
  approved "concept B2" office illustration (robots removed by image
  editing) — it is the owner's commissioned concept art, not a stock or
  third-party asset.
