The largest problems are the uncullable crowd, instance-by-instance collision queries, and incomplete GPU-resource cleanup. These directly threaten the walk-mode budget.

This was read-only: no files, tests, documentation, or commits were created. All **20 existing tests passed**. Both TypeScript projects passed with `--incremental false`. I did not run literal `npx tsc -b`, because it can write build-info files.

Findings below are ranked by impact. Code paths are verified; browser-dependent effects are explicitly marked **unverified**.

**Measured geometry**

I executed the procedural builders in an in-memory Node/TypeScript harness using the repository’s terrain and content. React hooks were stubbed; these are geometry counts, not browser profiling results. Vertices include instance multiplicity.

| Roman walk scene, year 200 | Mesh batches | Triangles | Expanded vertices |
|---|---:|---:|---:|
| Standing City pieces | 168 | 288,760 | 721,812 |
| CityGrid | 8 | 138,202 | 273,458 |
| Static CityDetails | 25 | 69,466 | 208,398 |
| Crowd: 389 NPCs, avatar, 16 horses/carts | 3 | 523,660 | 1,570,980 |
| Terrain surface | 1 | 130,050 | 65,536 |

These total **1,150,138 triangles before grass, facades, skirt, sky, mist, or additional passes**. This is scene inventory; frustum culling reduces some submissions. Actual total draw calls and M2/phone frame times remain **unverified**.

1. **High — GPU budget: the whole crowd renders in both color and shadow passes.**  
   [Crowd.tsx:161](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/Crowd.tsx:161), [Crowd.tsx:194](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/Crowd.tsx:194).

   All three crowd meshes set `frustumCulled = false` and `castShadow = true`. Every NPC also receives CPU simulation and matrix updates regardless of distance. Moving the first-person avatar to Y=-9999 does not remove its submitted vertices.

   The measured crowd costs **523,660 triangles per pass**, or **1,047,320 across color and directional-shadow passes**—already above 900k if “total” includes both passes.

   **Fix:** spatially partition the crowd, maintain conservative bounds, introduce distance-based geometry/detail tiers, and restrict shadow casting to nearby characters. Remove the hidden avatar from the active instance count or render it separately.

2. **High — Collision CPU cost: broad-phase filtering stops at the mesh, not the instance.**  
   [physics.ts:42](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/physics.ts:42), [physics.ts:69](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/physics.ts:69), [Crowd.tsx:55](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/Crowd.tsx:55).

   Instanced meshes are excluded from BVH construction. Their aggregate sphere enters the nearby cache, after which Three’s `InstancedMesh.raycast()` loops over every instance. This affects theatre seats, paving, tombs, and other repeated geometry. Crowd grounding multiplies the work.

   **Reproduced:** one ground query against a 2,000-instance batch invoked 2,000 underlying mesh raycasts.

   **Fix:** spatially index collision instances and query only intersecting cells. Use simplified collision surfaces for paving and seating rather than raycasting their decorative instances. Building a BVH for the shared geometry alone does not eliminate the instance loop.

3. **High — GPU leaks: generated detail and grid geometries are not disposed.**  
   [CityDetails.tsx:139](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/CityDetails.tsx:139), [CityDetails.tsx:142](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/CityDetails.tsx:142), [CityGrid.tsx:415](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/CityGrid.tsx:415).

   Details cleanup calls only `InstancedMesh.dispose()`. Grid cleanup likewise omits the geometries of walls, roofs, courts, and piers. Grass and facade instance meshes have no cleanup.

   The installed Three implementation does not dispose geometry from `InstancedMesh.dispose()`; I verified this with a disposal-event probe. R3F explicitly does not automatically dispose `<primitive>` objects.

   **Fix:** dispose each owned instance mesh and each uniquely owned geometry. Keep shared facade geometries and shared materials under a separate, explicit lifetime owner.

4. **High — GPU leaks: crowd and City cleanup omit instance buffers.**  
   [Crowd.tsx:173](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/Crowd.tsx:173), [City.tsx:287](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/City.tsx:287).

   Crowd cleanup disposes geometry/materials but never calls `dispose()` on its three instanced meshes. City cleanup only disposes geometry, including for instanced descendants. Three releases instance-matrix/color buffers through the instanced mesh’s disposal event.

   **Fix:** dispose instanced mesh objects as well as their owned geometry; deduplicate shared resources. Verify repeated walk entry, character changes, and scene remounts with renderer memory counters.

5. **High — Resource cleanup is also missing for externally supplied mesh properties.**  
   [Terrain.tsx:170](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/Terrain.tsx:170), [PlanInk.tsx:54](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/PlanInk.tsx:54), [Effects.tsx:27](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/Effects.tsx:27), [Effects.tsx:96](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/Effects.tsx:96).

   These components allocate geometry/materials in `useMemo` and pass them as properties, without explicit cleanup. The installed R3F reconciler disposes reconciled objects; it does not recursively dispose arbitrary geometry/material properties on a mesh. The mist’s canvas texture additionally requires its own disposal.

   **Fix:** use declarative resource children where suitable, or explicit cleanup for owned geometry, materials, and textures. Do not dispose shared `useTexture` cache entries independently.

6. **High — Camera ownership bug: entering walk does not cancel an active flight.**  
   [WalkControls.tsx:126](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/WalkControls.tsx:126), [Navigation.tsx:43](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/Navigation.tsx:43).

   Walk entry disables OrbitControls but does not call `killFlight()`. Existing flights continue writing camera position and calling `controls.update()` through `camera.ts`. Entering walk during a landmark flight therefore leaves two camera writers active.

   **Fix:** cancel scripted flights before initializing the walk camera. Also cancel them during scene teardown and prevent new orbit flights while walk owns the camera.

7. **High — Third-person camera collision excludes house walls.**  
   [physics.ts:34](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/physics.ts:34), [WalkControls.tsx:343](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/WalkControls.tsx:343).

   `WorldProbe` includes monuments, ruin masses, and streets, but not CityGrid house meshes. House rectangles constrain player movement only. Consequently, the camera boom can pass through a house behind the player.

   **Fix:** include house proxies in camera collision queries, preferably through the same spatial index used for player collision.

8. **High — Audio race: stopped or superseded voices can start after loading.**  
   [engine.ts:139](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/audio/engine.ts:139), [engine.ts:144](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/audio/engine.ts:144).

   `playVoice()` stops the current source, then awaits loading without a cancellation/version check. Selecting another place or pressing stop during loading does not invalidate that request. Two pending requests can both start; only the last assigned source remains stoppable through `voiceSrc`.

   **Fix:** increment a voice-generation token on every play/stop request and verify it after `await`. Disconnect completed source/gain nodes explicitly.

9. **Medium–high — Recurring allocations in crowd movement and grounding.**  
   [spots.ts:11](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/spots.ts:11), [Crowd.tsx:56](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/Crowd.tsx:56), [Crowd.tsx:199](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/Crowd.tsx:199), [Crowd.tsx:247](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/Crowd.tsx:247).

   `F.P()` returns a fresh array for every moving person and twice per cart. Roman mode produces **342 coordinate arrays per active frame** from these calls alone. Ground-cache refreshes replace `{x,z,y}` objects. Both `forEach` callbacks are also created each frame.

   Horse/cart animation attributes are marked dirty every frame despite remaining unchanged after initialization.

   **Fix:** calculate coordinates into scalars or reusable output storage; use indexed loops and mutable/typed ground caches. Upload only changed attributes.

10. **Medium–high — Allocations inside player collision and movement loops.**  
    [physics.ts:113](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/physics.ts:113), [WalkControls.tsx:278](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/WalkControls.tsx:278), [WalkControls.tsx:286](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/WalkControls.tsx:286).

    Wall hits allocate normal matrices, plus an instance matrix for instanced hits. Moving frames allocate the height array and `tryMove` closure. Spatial-cache keys allocate strings; cache misses allocate filtered arrays and callbacks. Raycast hit records themselves also allocate despite reuse of the outer hits array.

    **Fix:** retain scratch matrices on `WorldProbe`, hoist fixed heights, use a stable movement helper, and use numeric spatial keys. Simplified collision queries should return scalar results into reusable storage.

11. **Medium–high — Large synchronous construction occurs during React rendering.**  
    [City.tsx:216](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/City.tsx:216), [CityGrid.tsx:410](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/CityGrid.tsx:410), [CityDetails.tsx:68](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/CityDetails.tsx:68), [Crowd.tsx:62](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/Crowd.tsx:62).

    City builds all periods immediately. Crowd geometry is built even while invisible. Grid geometry is rebuilt whenever `showGrid` is toggled back on, rather than retained after first use. Details rebuild on every effective year change and walk-mode transition; crowd rebuilds on every walk-year change.

    Several builders also mutate global registries during render. StrictMode and interrupted rendering can repeat construction before cleanup ownership exists.

    **Fix:** cache immutable assets independently of population/layout, key layouts by actual historical transitions, and construct large batches in bounded chunks or workers. Publish global collision/layout registries only after successful construction. Device stall durations are **unverified**.

12. **Medium–high — Collision readiness depends on timers rather than scene readiness.**  
    [WalkControls.tsx:98](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/WalkControls.tsx:98), [Crowd.tsx:47](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/Crowd.tsx:47), [Experience.tsx:237](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/Experience.tsx:237).

    Collision refresh occurs after 350/400 ms. Terrain data readiness does not guarantee that the suspended World subtree, including terrain textures, has committed. A refresh can capture an empty or incomplete scene and still mark the probe ready, with no later scene-ready dependency.

    Refresh also synchronously builds BVHs; a timeout postpones that work but does not split it.

    **Fix:** expose a committed scene/collision revision and refresh against that revision. Share immutable collision data between player and crowd. The slow-loading failure’s browser reproduction is **unverified**.

13. **Medium — Static batching is too geographically broad for effective culling.**  
    [CityGrid.tsx:310](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/CityGrid.tsx:310), [CityDetails.tsx:48](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/CityDetails.tsx:48).

    Grid walls, roofs, courts, and piers are city-wide batches. Details similarly batch whole tree populations or street furniture types. Frustum culling operates on each aggregate bound, so intersecting one part submits all its instances.

    **Fix:** partition static instances into spatial cells with shared geometry/materials. Tune cell size against the 260-draw-call cap; do not replace these batches with individual meshes.

14. **Medium — Shadow work includes paving, water, and tiny decorative surfaces.**  
    [City.tsx:205](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/City.tsx:205), [colonnade.ts:23](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/generators/colonnade.ts:23), [CityDetails.tsx:53](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/CityDetails.tsx:53), [Experience.tsx:31](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/Experience.tsx:31).

    `shadowAll()` indiscriminately enables casting, including water and instanced paving. Detail parts default to casting too. Desktop shadows use 4096² texels; mobile uses 2048². The adaptive quality mechanism changes DPR/postprocessing but not shadow resolution or caster density.

    **Fix:** assign caster policy by object purpose, remove flat paving/water from casting, and reduce distant detail casters. Add a measured shadow-quality tier. Actual shadow GPU time is **unverified**.

15. **Medium — Detail recycling allocates and performs burst work inside `useFrame`.**  
    [CityDetails.tsx:163](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/CityDetails.tsx:163).

    Every 15 m, facade updates allocate maps/arrays and scan all placements. Grass updates allocate matrices/vectors and regenerate 2,200 placements, each potentially scanning every street through `onStreet()`. These are threshold-triggered bursts, not allocations on every frame.

    The callback also continues this work when its parent is invisible because its guard only checks walk mode.

    **Fix:** pre-index facades and street segments, retain scratch objects/maps, spread grass recycling across frames, and gate work on effective visibility.

16. **Medium — HUD polling creates unnecessary React and DOM work.**  
    [WalkHUD.tsx:55](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/WalkHUD.tsx:55), [WalkHUD.tsx:200](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/WalkHUD.tsx:200).

    Every animation frame converts all eligible landmarks to local coordinates, creates coordinate arrays, writes several style strings, and calls state setters. Equal primitive values usually bail out, so this is **not evidence of a full HUD render every frame**. However, `setNear` creates a new updater closure each tick.

    The joystick creates a new state object and rerenders on every pointer move.

    **Fix:** cache landmark coordinates, run proximity detection at 5–10 Hz, update lock state from pointer-lock events, and write visual transforms only when changed. Move joystick knob motion to a ref-driven transform.

17. **Medium — Audio continues after the scene UI unmounts.**  
    [PlaceAudio.tsx:74](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/audio/PlaceAudio.tsx:74), [PlaceAudio.tsx:91](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/audio/PlaceAudio.tsx:91), [PlaceAudio.tsx:145](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/audio/PlaceAudio.tsx:145), [App.tsx:79](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/App.tsx:79).

    Switching to guide/poster routes unmounts `PlaceAudio`. Cleanup removes scheduling but does not stop music, existing bed loops, or an active voice. Bed release relies on future `setBedLevels()` calls, which have stopped.

    **Fix:** add a scene-audio shutdown operation that invalidates pending playback, fades/stops music, stops/releases beds, and stops voices. Retain the AudioContext only if that lifetime is intentional.

18. **Medium — Hash navigation leaves delayed camera actions alive.**  
    [App.tsx:70](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/App.tsx:70), [Pins.tsx:44](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/Pins.tsx:44).

    Once terrain resolves, the 300 ms timeout is not cleared or cancellation-checked. Rapid hash changes or leaving the scene can still trigger an obsolete flight. Selection also triggers the Pins focus effect, producing duplicate flight requests. Terrain rejection is uncaught here.

    **Fix:** centralize selection-driven focus, retain/clear timeout handles if still needed, check the route generation at execution, and handle load errors.

19. **Medium — Theatre detail overlays obstruct reconstructed entrances.**  
    [City.tsx:225](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/City.tsx:225), [house.ts:149](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/generators/house.ts:149), [theatre.ts:38](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/generators/theatre.ts:38).

    The base theatre has three actual door openings. The added facade uses five differently positioned shallow door panels; the central panel occupies the central opening. Because it is beneath `city-root`, it also participates in collision.

    **Fix:** align decorative bays with the actual entrances and omit solid panels across intended passages. Derive detail dimensions and placement from the theatre options instead of hard-coded defaults.

20. **Medium — Collision state can disagree with hidden houses and changing transforms.**  
    [WalkControls.tsx:102](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/WalkControls.tsx:102), [WalkControls.tsx:120](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/WalkControls.tsx:120), [CityGrid.tsx:425](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/CityGrid.tsx:425).

    The house hash ignores grid visibility/year, and exported house rectangles remain populated after grid removal. Unlike mesh queries, house checks do not use `shown()`. Probe bounds also remain cached while City changes vertical scale.

    Normal character entry restores an ancient, visible grid, so exposure through ordinary walk UI is limited.

    **Fix:** apply the same effective visibility predicate to house collisions and rendering; invalidate collision bounds when geometry/transforms change.

21. **Medium — TodayTiles readiness and plan visibility are inconsistent.**  
    [TodayTiles.tsx:31](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/TodayTiles.tsx:31), [Experience.tsx:52](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/Experience.tsx:52).

    Readiness requires more than 25 loaded models, while timeout failure requires zero. A successful view needing only 1–25 models can remain “loading” indefinitely.

    Tiles remain mounted and updated whenever `era === 'today'`, including plan mode, where procedural City/Grid visibility explicitly permits the ancient plan.

    **Fix:** derive readiness from visible coverage/loading completion, handle partial-load timeout states, and gate tile rendering/updates by effective mode. Actual Google tile coverage behavior is **unverified**.

22. **Low–medium — Mist has shared-opacity logic and avoidable draw overhead.**  
    [Effects.tsx:27](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/Effects.tsx:27), [Effects.tsx:35](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/Effects.tsx:35).

    All 26 sprites share one material, but the loop assigns a different opacity through each sprite. The final assignment therefore controls every puff. Animation continues while hidden. When visible, the sprites require up to 26 draws and overlap transparently.

    **Fix:** use an instanced billboard batch with per-instance opacity/phase, and stop updates when hidden.

23. **Low–medium — Remaining animation allocations and teardown gaps.**  
    [Navigation.tsx:80](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/Navigation.tsx:80), [Experience.tsx:64](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/Experience.tsx:64), [Experience.tsx:156](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/scene/Experience.tsx:156), [FastTravel.tsx:40](/home/rubuntu/Projects/ferial/.codex-wt/audit/src/walk/FastTravel.tsx:40).

    Navigation clones a vector every non-walk frame and allocates another during bounds correction. Lights adds its target to the scene but does not remove it. Controls leaves global `rig` references pointing at unmounted objects. FastTravel retains its body-level fade element after unmount.

    **Fix:** reuse navigation scratch vectors; remove the light target; clear matching rig references on teardown; remove the fade element and clear its timers.

**Additional checks and limits**

- I found no Zustand selectors returning fresh object/array snapshots in the requested code. Most selectors are narrow primitives; the major React cost is construction/reconstruction and HUD polling.
- Most procedural architecture already uses merged geometry or instancing. The main GPU issue is batching granularity, crowd detail, and repeated shadow work.
- Terrain height tests passed, including interpolation against rendered triangles. I found no confirmed local-frame unit error.
- Shader compilation stalls are **unverified**. New crowd/material variants and postprocessing are created without a visible prewarming stage. After fixing construction ownership, precompile required variants before releasing walk input.
- StrictMode cleanup/reuse of memo-created `PostFX` composers and tile renderers deserves a browser regression test: their effects dispose objects that effect replay can subsequently reuse. Resulting visual failures are **unverified**.
- Full rendered draw-call compliance remains **unverified**; the inventory above must not be presented as a measured frame.

**Top-10 priority list**

1. Cull and reduce crowd geometry; limit crowd shadow casters.
2. Replace whole-instance-batch collision raycasts with spatially indexed proxies.
3. Fix geometry and instance-buffer disposal across City, Grid, Details, and Crowd.
4. Fix terrain, ink, sky, and mist resource ownership on unmount.
5. Cancel camera flights before entering walk.
6. Add house collision to the third-person camera boom.
7. Add cancellation tokens to asynchronous voice playback.
8. Remove crowd/player hot-loop allocations and redundant uploads.
9. Replace timed collision initialization with committed scene revisions.
10. Cache/chunk procedural construction, then measure complete color-plus-shadow frames against both budgets.