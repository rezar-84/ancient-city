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

Run `node tests/walk-physics.test.cjs`, `node tests/terrain-grounding.test.cjs`, `node tests/character-geometry.test.cjs` , `node tests/walk-session.test.cjs` and `node tests/benchmark.test.cjs` from the project root. They cover actual Three.js raycasts, terrain/mesh agreement, geometry validity and detail bounds, depth shader injection, and benchmark reliability. Also run the production build and focused lint.

Browser sockets are blocked in this environment. Visual acceptance, shader compilation on actual GPUs, real-device performance, and keyboard/touch end-to-end checks remain outstanding. Test entry, pause, resume, map travel, information panels, new-character reset, mobile controls and focus loss on a browser before treating the full walk flow as verified.

## Input and crowd correction pass

Map and settings visibility now live in application state. Movement, look input, greeting audio, and crowd simulation share the same blocking rule. Escape closes an overlay before pausing; leaving walk mode clears old overlays. Touch-look cancellation is handled explicitly. Paused crowds skip their simulation/matrix-upload loop. Collision broad-phase candidates are cached in up to 128 spatial cells, with conservative cell-edge bounds and invalidation whenever the scene is refreshed.

The session and physics suites pass 12 cases in this pass, including overlay dismissal/input blocking and collision-cache refresh across distant cells. Focused lint has no errors. These checks do not replace live desktop/mobile testing or demonstrate a measured FPS improvement; local sockets remain unavailable.
