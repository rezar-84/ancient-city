# Water

Procedural Three.js modules, with no React imports or external assets. Includes a 30 × 22 m scalloped Sacred Pool, east entry treads (0.4/0.8/1.2 m), a 1.9 m central floor, north stylobate, nine portico columns (six fallen), loose drums/capitals, sixty white rimstone terraces descending west, overflow sheets, thermal steam and shared interaction ripples.

## Exports

- `createWaterMaterial({ kind, color?, fizz? })`: owned MeshPhysicalMaterial. `kind` is pool/terrace/basin/sheet. Geometry must supply `aDepth`, position, normal and uv. Color multiplies the depth tint. Physical water IOR supplies Fresnel reflection from `scene.environment` and highlights from scene lights. Two scrolling normal octaves, sixteen expanding ripples, shallow foam, optional fizz and downward sheet streaks are injected through onBeforeCompile.
- `waterUniforms`: shared `uTime` (seconds) and `uRipples` (16 persistent Vector4 entries, world X/Z, start time, amplitude). `addRipple(x,z,amp)` overwrites the next entry, clamps amplitude to 0–1, and allocates nothing. Rings travel at 1.2 m/s and expire in 2.5 seconds.
- `buildWater(terrain)`: `{ group, volumes }`, anchored through the two landmark coordinates. `group.userData.uSteam` is the steam strength uniform. Materials and geometries in the returned group are owned by the caller; masonry materials are clones, not the city material cache.
- `WaterVolume`: id, kind, polygon in local/world XZ, surfaceY, floorY. floorY records the deepest level. Generated floors retain their triangle data privately for accurate interpolation.
- `waterAt(volumes,x,z)`: null or `{ surface, depth, kind }`. A lazily cached 16 m spatial grid filters polygon tests. Boundaries are included; highest surface wins overlaps. Generated floor depth matches the rendered triangle interpolation. Caller-created volumes use constant floorY. Treat the array and polygons as immutable after querying; replacing the array rebuilds the index. This query allocates its result object; call on movement/contact events, not unconditionally each frame.
- `createFountainWater(width,depth,y)`: horizontal rectangular mesh; depth means footprint length along Z. Its visual water depth caps at 0.45 m. Does not add a collision volume.
- `createWaterSheet(width,height)`: vertical XY mesh, top at zero and bottom at negative height. Rotate around Y to face the desired direction.
- `createSteam(points: readonly THREE.Vector3[],count)`: `{ mesh, uSteam }`. Instanced soft billboards animate entirely on the GPU; set uSteam.value in 0–1. No texture or render target. Empty points require zero count.

## React integration

1. Memoize buildWater for the loaded Terrain and mount its group as a primitive. Coordinates and ripple events assume an identity parent transform.
2. Copy `sceneUniforms.uTime.value` into `waterUniforms.uTime.value` before rendering. Do not replace uniform objects after compilation. All water and steam share this clock; no per-frame geometry updates are needed.
3. Set scene.environment and a directional sunlight source for reflections/glints. Drive uSteam.value from time of day. Use group visibility or material opacity for plan/era transitions; these modules deliberately do not import uPlan/uWalk or alter the City patch.
4. Cut/mask the original terrain within the Sacred Pool polygon, down to floorY. Otherwise the unmodified terrain occludes its submerged floor and fallen columns. Terraces use the maximum sampled terrain elevation plus their shallow depth to sit above the slope; their floors need no terrain cut on a planar slope. Extremely irregular terrain can still intersect between samples.
5. Use waterAt for wading and the returned surface-depth as the collision floor. Rim/coping/stylobate collision needs the host walk system. Initial query warms the spatial index.
6. Replace existing water geometry on nymphaeum and props fountains before placing helper meshes, to avoid overlapping transparent surfaces. Nymphaeum uses local basinZ and y≈0.76; street fountain uses y=0.35, footprint 1.2 × 1.2. These existing generators were not edited.
7. Dispose mesh geometries and owned materials on teardown (deduplicate if reusing helpers). The global uniform vectors need no disposal.

## Measured budgets and validation

Node tests count rendered instances and index triangles, including steam:

| Terrain fixture | Mesh draws per main pass | Triangles | Vertices including instances |
| --- | ---: | ---: | ---: |
| Flat | 6 | 67,852 | 102,440 |
| West-descending, 0.3 m/m | 6 | 68,556 | 104,552 |

At most 27 overflow sheets: 69,324 triangles total. Water surfaces, terrace stone and sheets are merged by material; steam is one instanced draw. Transparent water uses forceSinglePass. Shadow passes are additional renderer work; water/steam do not cast shadows. Separate fountain helpers each add one draw and are not included above.

`node tests/*.test.cjs` (each file separately): all pass. Tests cover finite geometry, budgets, volume area and unique vertices, inside/outside/concave/boundary/overlap queries, east entry depth, western descent, ripple storage reuse and shader injection. Shader checks are source-level, not a GPU compilation or visual review.

`npx tsc -b` encounters TS5033 because this worktree's node_modules symlink points to a read-only build-cache directory. Equivalent project checks use writable cache paths: `npx tsc -p tsconfig.app.json --tsBuildInfoFile /tmp/water-app.tsbuildinfo` and the corresponding tsconfig.node.json command.

## Limits

No refraction capture, screen-space reflections, terrain excavation or hydrodynamic simulation. Sheet links approximate spill lips, and are omitted where the sampled receiving terrace is higher. The basin layout is an artistic reconstruction, not a survey. Entry risers use closely paired radial rings; fallen debris is visual and does not alter waterAt. Whole-site merged transparent geometry cannot sort individual terraces against every transparent object. Steam disables frustum culling to account for shader displacement. Mobile appearance and GPU shader compilation still need a browser review when integrated.
