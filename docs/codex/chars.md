# Character design and animation v3

Procedural metric figures face +Z; neutral sandal/hoof soles rest at Y=0. People are 1.70 m tall with a 0.226 m head (about 7.5 heads). All construction stays in the rig geometry module: scene Building/combine helpers do not preserve custom per-part rig ownership. No assets or dependencies added; scene placement remains with existing Terrain/gridFrame/stallSpots callers.

## Geometry and exported API

Existing exports remain compatible: `createPersonGeometry(era)`, `createHorseGeometry()`, `createCartGeometry()`, `createCrowdAttributes(count)`, `patchCrowdMaterial(material, kind)`, `ERA_PALETTES`, `SKIN_TONES`.

- `createPersonGeometry(era, lod: PersonLOD = 'near')`: Greek chiton/himation, Roman tunic and diagonal toga/palla-inspired mantle, Byzantine long tunic/mantle. Elliptical waist, flared folded hem, belt, sandals, shaped jaw/nose/brow/ears. Near eyes use fixed vertex colors. Curved primitives retain smooth normals across non-indexed merges. Far removes facial detail and outer mantle folds.
- `HAIR = { short: 0, curly: 1, bun: 2, veiled: 3, bald: 4 }`. Hair shells are selected per instance by collapsing inactive shells to the head pivot. Curly hair uses a subtly displaced cap; bun and optional beard are separate shells. Veil takes cloth tint.
- `POSE = { walk: 0, talk: 1, pray: 2, run: 3, idle: 4, wave: 5, sit: 6, carry: 7, swim: 8, tread: 9, drink: 10 }`. Legacy values 0/1/2 retain walking/rest, conversational gestures, and prayer. Walk with zero gait rests; explicit idle ignores gait. Run enforces at least 0.8 gait. Sit puts the hip at 0.46 m above a 0.45 m seat. Swim rotates around the chest into a horizontal breaststroke; swim/tread place the chest at local Y=0 (set instance origin to the water surface). Drink leans forward. Carry raises both arms for shoulder/head loads.
- `createHeldPropGeometry('amphora' | 'basket' | 'staff' | 'scroll')`: basket sits above the head and uses head rig 5; other props use the figure's right wrist/arm rig 4. Neutral prop coordinates are already in figure space. Do not independently translate props to animated hand positions.
- Horse has rounded barrel/head/muzzle, arched neck, pointed ears, eyes, independent mane/tail motion. Normalized gait blends four-beat walking into diagonal trot from 0.55 to 0.85.
- `PoseBlender` from `src/walk/anim.ts`: `new PoseBlender(count, initialPose = 0, duration = 0.3)`, `set(i, pose, nowSeconds)`, `write(poseAttribute, i, nowSeconds, optionalAnimAttribute): number`. The return value is the active target pose. Typed arrays allocate only in the constructor. Repeated identical targets do not restart a transition. Changes during a transition queue the latest request until the current blend completes, preventing snapping; use monotonic seconds. Mark attributes dirty once after all writes.

## React integration (not edited in this task)

Existing Crowd works with material defaults for the optional attributes, yielding short dark hair without a beard and immediate pose changes. To enable new features:

```ts
const a = createCrowdAttributes(count)
geometry.setAttribute('iAnim', a.anim)
geometry.setAttribute('iTint0', a.tint0) // cloth
geometry.setAttribute('iTint1', a.tint1) // skin
geometry.setAttribute('iTint2', a.tint2) // mantle/belt/accent
geometry.setAttribute('iStyle', a.style)
geometry.setAttribute('iPose', a.pose)
// Hair RGB is linear, e.g. from THREE.Color.set(palette.hair[index]).
a.style.setXYZW(i, hair.r, hair.g, hair.b, HAIR.bun + 5 * Number(beard))
const blender = new PoseBlender(count)
// on state changes:
blender.set(i, POSE.wave, seconds)
// in the existing frame loop, after writing phase/gait/headTurn:
blender.write(a.pose, i, seconds, a.anim)
a.pose.needsUpdate = a.anim.needsUpdate = true
```

Keep `iAnim = (phase, normalizedGait, targetPose, headTurnRadians)`. Write iAnim first, then blender, so the existing Crowd loop cannot overwrite queued targets. Update visible and custom depth material `userData.uTime.value` with the same clock. Both passes execute identical pose, hair-selection, and vertex deformation code. MeshDepthMaterial declarations are moved outside the displacement-map guard. Point-light distance materials are not part of this API.

Batch near and far people into separate InstancedMeshes, with distance hysteresis (for example near <12 m, far >16 m). Remap every instance attribute consistently when moving between batches. One geometry/material per batch, no geometry rebuilding each frame. Keep the same instance transform and attributes on a held-prop batch; patch its visible/depth materials with kind `person`. A basket follows head look; wrist props follow elbow and shoulder transforms. Use `POSE.carry` with amphora/basket; staff/scroll can use walk/talk. Props can instead be merged into dedicated carrier geometries at setup using mergeGeometries, saving a draw call at the expense of another crowd batch.

Packed vertex attributes remain `aRig=(part, limb, bend, wheel/styleTag)` and `aPivot`. Limb IDs: legs 1/2, arms 3/4, head 5; horse tail 6, mane 7. Human aRig.w: cap 1, bun 2, veil 3, beard 4; cart uses it as wheel flag. Part IDs: cloth 0, skin 1, hair 2, accent 3, iris 4, eye white 5. Geometry has position/normal/color/aRig/aPivot (5 slots), instanceMatrix (4), iAnim and three tints (4), iStyle and iPose (2): **15 attribute slots**, leaving one for optional instanceColor. No UV/tangent attribute.

## Measured budgets

Counts include every selectable hair/beard shell, even inactive degenerate shells. Geometry is non-indexed.

| Geometry | Triangles | Vertices |
| --- | ---: | ---: |
| Person near, each era | 1,450 | 4,350 |
| Person far, each era | 271 | 813 |
| Horse | 884 | 2,652 |
| Cart | 284 | 852 |
| Amphora | 272 | 816 |
| Basket | 432 | 1,296 |
| Staff / scroll, each | 32 | 96 |

Each batch costs one draw call per render pass. Example: 32 near + 468 far people and 16 horse/cart pairs = 191,916 triangles and 4 main-pass draw calls before held props. The unchanged Crowd defaults to all near geometry, so React LOD batching is needed to reserve substantial room within the **whole-scene** 900k triangle / 260 draw-call target. Full-scene budgets and device frame time were not measured here.

## Validation and limits

All six `tests/*.test.cjs` scripts pass (25 tests), including LOD budgets, finite geometry, unit normals, ground origins, rig layouts, pose constants emitted in both shaders, depth normal declaration placement, props, blend endpoints/independence/interruptions/input validation.

`npx tsc -b` reached TS5033 errors because this environment mounts `node_modules/.tmp/*.tsbuildinfo` read-only. `npx tsc -b --incremental false` passed with no errors, checking the same projects without writing caches. No configuration was changed. A browser smoke test was attempted but local socket creation and Chromium startup are restricted; tests validate shader generation, not a real GPU compiler or rendered appearance.

These are budgeted approximations, not archaeological costume reproductions or skinned anatomical meshes. Hair curls are a scalloped cap, not individual locks; far faces omit small features. Garments are a single deforming surface rather than cloth simulation; sitting folds and extreme swim/carry gestures can intersect bodies/props. Hem/curl normal perturbations are approximated by the undeformed smooth normals, while joint/body normals use the exact rotations. Foot placement has no terrain IK. Blend helper queues rapid state changes rather than interrupting with a three-pose blend. No automatic water/seat/fountain placement, LOD switching, costume gender selection, collision, prop spawning, or UI changes are included.
