# Walk-mode update

Ground queries now interpolate the same triangles as the rendered heightfield. Previously bilinear queries could disagree with the mesh on non-planar cells. Raised city streets are included in collision queries; NPCs, horses and carts also query solid support rather than terrain alone. Player feet snap to support, and footsteps use distance actually moved rather than desired velocity.

Physics includes rotated-instance normals, rotated-house broad-phase bounds, third-person camera obstruction, head clearance under roofs, and delayed collision readiness on entry. This remains a lightweight ray-based controller, not a rigid-body or skeletal foot-IK simulation.

Character assets are generated in code: rounded limbs and head, jaw/nose/eyes/brows/ears, hands, sandal straps, clothing folds/hems and belt details. Joint animation adds knees, elbows and a waving arm. Crowd stature/build varies. Animated depth materials keep directional shadows aligned; the sun shadow region follows the walker. No external assets or new download licenses were introduced.

## Controls and session flow

- Choose a character, then Begin. Starting a new walk resets the spawn.
- Escape or Pause opens a keyboard-accessible native pause dialog. Resume continues in place. Click the scene to regain mouse look on desktop.
- Return to city map preserves position and view for this page visit. Walk the city then Resume walk restores the character and period. Reloading the page does not retain a save.
- Switching character starts a new walk. Losing window focus pauses movement.
- G or Greet / wave triggers a wave. A nearby townsperson can reply with an existing voiced/subtitled line, with a cooldown. Space / touch jump uses existing surface audio for take-off and landing.
- Place information and the travel map suspend movement. Delayed fast travel is cancelled when leaving walk mode.

## Verification

Run `node --test tests/*.test.cjs` from the project root (covering `walk-physics`, `terrain-grounding`, `character-geometry`, `imported-citizens`, `walk-session`, `roman-route`, `landmarks-audit`, `performance-lod`, `water`, and `benchmark`), along with `npx tsc -b`, `npm run lint`, and `npm run build`.

## Live browser route & optimization pass

Collision broad-phase and instanced raycasts (`src/walk/physics.ts`), near/far crowd LOD (`src/walk/Crowd.tsx`), shared water stone materials (`src/scene/water/pools.ts`), spatially bucketed house facade recycling (`src/scene/CityDetails.tsx`), GPU geometry/material disposal (`src/scene/CityGrid.tsx`, `src/scene/CityDetails.tsx`), and module-level walk asset caching (`cart-horse.glb`, `sheep.obj`) were verified in headless Chrome against the live dev server on `ANGLE (Intel, Mesa Intel(R) HD Graphics 620 (KBL GT2), OpenGL ES 3.2)` at fixed `1280 × 800`, `DPR = 1`:

- **Initial load lazy gating:** `0` citizen/animal model requests during initial Explore load (`11.57 MB` initial dev transfer); `male.glb`, `female.glb`, `motions.glb`, `cart-horse.glb`, and `sheep.obj` fetch only on entering walk mode, with `0` extra model fetches when exiting and resuming walk mode.
- **Roman route walk (`AD 200`, Aurelia, 3rd-person, `showGrid = true`):**
  - Scene triangles dropped from `1,578,743` to `1,090,978` (`-30.9%`), live GPU geometries from `418` to `358`, compiled shader programs from `88` to `59`, and draw calls from `359` to `344`.
  - Post-warmup frame timings on headless integrated Intel HD 620 (`1280 × 800`, `DPR = 1`, `3072²` shadows): `medianMs = 66.7 ms`, `p95Ms = 116.7 ms` for both `fx=0` and `fx=1` (`p95Ms` improved from `283.3 ms`). Physical Apple Silicon / discrete desktop GPUs and physical iOS/Android handsets still require on-device profiling before claiming 30/60 FPS hardware targets.
- **Desktop & mobile touch end-to-end checks:** Verified `M` travel map open/Escape close, `Escape` pause/resume dialog, explore-to-walk session position preservation, `390 × 844` mobile virtual joystick displacement & reset, view toggle, jump trigger, and `/docs/design/fitting.html` canvas/era/role studio with `0` runtime errors.
