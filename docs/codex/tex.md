# Runtime PBR textures (`tex`)

Built eight procedural, periodic 512×512 material pairs: limestone, travertine,
marble, paving, lime plaster with trowel marks, Roman tegula/imbrex roof rows,
gravelly dirt, and dry grass. No downloaded assets. Existing AR recipes and
`makeStone` are unchanged; new `RUNTIME_RECIPES` and `makeRuntimeSurface` exports
are separate. Bake with `npx tsx scripts/bake_runtime_textures.ts` (JPEG quality 82).
Stone maps reuse `makeStone(RECIPES[name], 512)`, decoding its JPEGs before packing;
this incurs a second lossy encode, intentionally preserving the existing AR API.

`*_albedo.jpg` is sRGB color. `*_nr.jpg` is linear data: R/G encode tangent-space
normal X/Y from −1…1 to 0…1, positive Z is reconstructed, B is roughness 0…1.
Normal Y points image-up (OpenGL), matching TextureLoader's default flipY=true.
JPEG alpha is absent. Patterns and finite differences wrap at the tile boundary;
edge pixels are adjacent periodic samples, not artificially duplicated endpoints.

## Exported runtime API

- `RUNTIME_MATERIALS`, `RuntimeMaterial`, `RuntimeTextures`: eight named `{albedo, nr}` pairs.
- `RUNTIME_TILE_METRES`: limestone 8 m; all others 4 m. Scale is repeats/metre.
- `loadRuntimeTextures(): Promise<RuntimeTextures>`: TextureLoader, RepeatWrapping,
  trilinear mipmaps, anisotropy 4, SRGBColorSpace for albedo, NoColorSpace for NR.
  Call once, retain the result, and dispose all 16 textures when the scene is
  permanently released. It is deliberately not a global singleton; failed loads
  reject and dispose successful siblings after all loads finish.
- `TRIPLANAR_GLSL`: `triAlbedo`, `triNormal`, `triRoughness`,
  `triNormalRoughness` (world normal XYZ + roughness W), `triFade`, and private
  prefixed helpers. All samplers return raw values; blend using `triDetailWeight`.
- `applyTriplanar(shader, opts)`: injects uniforms and GLSL declarations, without
  creating varyings or selecting insertion locations in custom shader bodies.
  Required opts: albedo, nr, scale, near, far, strength. Optional sharpness (1–16,
  default 4), biplanar (default false). Far is capped at 120 m; invalid parameters
  throw before mutation. Repeat calls update uniforms without duplicate GLSL.

## City integration (instructions only; React modules were not edited)

Load maps before installing the material callbacks. Map `roofTile` to `rooftile`,
`ground` to `dirt`; limestone/travertine/marble/plaster map directly. Paving and
grass need an explicit material choice on the React side. Skip water, bronze, dark.
Inside the existing `onBeforeCompile`, after its replacement chain, call:

```ts
applyTriplanar(sh, {
  albedo: textures[name].albedo, nr: textures[name].nr,
  scale: 1 / RUNTIME_TILE_METRES[name], near: 30, far: 120,
  strength: 0.65, sharpness: 4, biplanar: false,
})
```

Keep City’s existing vertex `vW` / `vWN` declarations and instance-aware normal
transform. Do not redeclare them. Insert the following GLSL **inside main**, after
City’s color block and before its final `diffuseColor.rgb = mix(... uPlan ...)`
line. Declare these locals at main scope, outside the existing `{ ... }` block,
so they remain visible to the later roughness and normal stages:

```glsl
triDetailWeight = triFade(length(vViewPosition)) * (1.0 - uPlan);
vec3 triBaseWorld = normalize(vWN);
#ifdef DOUBLE_SIDED
triBaseWorld *= gl_FrontFacing ? 1.0 : -1.0;
#endif
vec4 triSurface = vec4(triBaseWorld, 1.0);
if (triDetailWeight > 0.0) {
  diffuseColor.rgb = mix(diffuseColor.rgb,
    triAlbedo(uTriAlbedo, vW, triBaseWorld, uTriScale), triDetailWeight);
  triSurface = triNormalRoughness(uTriNR, vW, triBaseWorld, uTriScale);
}
```

This blends toward absolute baked color, avoiding multiplying baked stone color
by the already warm material color a second time. At strength 1 the texture
replaces prior color weathering; use lower strengths to retain that variation.
After City’s custom `roughnessFactor = clamp(...)` line insert:

```glsl
roughnessFactor = mix(roughnessFactor, triSurface.w, triDetailWeight);
```

After City’s entire derivative-bump block following `normal_fragment_maps`, insert:

```glsl
if (triDetailWeight > 0.0) {
  vec3 triViewNormal = normalize(mat3(viewMatrix) * triSurface.xyz);
  normal = normalize(mix(normal, triViewNormal, triDetailWeight));
}
```

The chunk's whiteout blend combines each projected detail normal with the world
geometry normal; this final mix transitions from existing procedural bump.
Update the existing customProgramCacheKey to e.g. `hier2-tex-v1-` + key and set
material.needsUpdate when first installing. No useFrame work is needed.

## Terrain integration

Terrain currently has only `vWPos`. Add `varying vec3 vWN;` to **both** shader
common declarations, and append this after its existing vWPos vertex assignment:

```glsl
mat3 triModelNormal = mat3(modelMatrix);
vWN = normalize(triModelNormal * (objectNormal / vec3(
  dot(triModelNormal[0], triModelNormal[0]),
  dot(triModelNormal[1], triModelNormal[1]),
  dot(triModelNormal[2], triModelNormal[2]))));
```

Terrain is not instanced. For an instanced ground variant use City's existing
instance-aware transform. In the map_fragment replacement declare
`vec4 triSurface;` at main scope **before** the existing `{` block. Immediately
before `// plan grade`, insert the City's sampling block above, with these changes:
use `vWPos` in place of `vW`; assign (do not redeclare) `triSurface`; replace all
`diffuseColor.rgb` in that block with `c`; and set the weight to:

```glsl
triDetailWeight = triFade(length(vViewPosition))
  * max(uWalk, uAncient * 0.8) * (1.0 - uPlan) * (1.0 - pool) * (1.0 - trav);
```

Use dirt or grass per ground material; smooth mixed biomes would require extra
samplers/fetches and are outside this helper. Insert the same roughness mix after
`roughnessFactor = tRough;` and the same normal mix after Terrain's derivative
bump block. Call applyTriplanar after the replacement chain with biplanar=true
for phones. Set a distinct customProgramCacheKey and material.needsUpdate.

## Budgets and limits

- Added geometry: **0 vertices, 0 triangles, 0 draw calls**. Existing scene geometry
  and the total walk budget are untouched; full scene rendering was not measured.
- Six fetch sites per shaded fragment (3 albedo + 3 shared NR); biplanar executes
  at most four (2 + 2). Axis-aligned surfaces may execute only two. Do not call
  triNormal and triRoughness separately when both are needed: use the shared vec4.
- Beyond 120 m, or with zero strength/mode weight: **zero new texture fetches**.
  The fade arithmetic/branch still executes. Early returns also protect standalone
  calls, provided triDetailWeight is set before sampling. Default weight is zero.
- GPU storage: 16 × 512² × 4 × mip-chain ≈ **21.33 MiB**, independent of JPEG size.
  Decoded images also consume CPU memory. No per-frame JS allocations.
- Biplanar drops the weakest axis, reducing fetches but can show a seam where the
  dropped axis changes. Triplanar is preferred for close smooth curved surfaces.
  JPEG introduces small normal/roughness errors; these are detail maps, not
  displacement. Scale is world-aligned and roof rows do not follow rotated ridges.
- Implicit mip derivatives at divergent projection/fade boundaries and performance
  on actual M2/phone GPUs require a browser visual pass during React integration.
  Tests check shader structure, not a driver GLSL compile or rendered appearance.
- URLs use `/tex/`; a deployment under a subpath needs the loader URL prefix adapted.
