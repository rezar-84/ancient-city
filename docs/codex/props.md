# Task B: street props and vegetation

Exports in `props.ts`: `PropParts`, `marketStall(0|1|2)`, `amphoraStack`, `bench`, `statueOnPedestal`, `altar`, `streetFountain`, `milestone`, `lampPost`, `parkedCart`.

Triangle counts (all material parts combined):

| Prop | Triangles |
| --- | ---: |
| Market stall: wool / amphorae / produce | 146 / 158 / 122 |
| Amphora stack (five vessels) | 152 |
| Bench | 36 |
| Statue and pedestal | 100 |
| Altar | 68 |
| Street fountain | 86 |
| Milestone | 48 |
| Lamp post | 72 |
| Parked cart | 148 |

Exports in `vegetation.ts`: `VegetationParts`, `cypress(height=9)`, `olive(height=4.5)`, `plane(height=11)`, `shrub`, `grassTuft`, `createFoliageMaterial(color)`, `patchSwayMaterial(mat)`.

| Vegetation | Triangles |
| --- | ---: |
| Cypress | 28 |
| Olive | 80 |
| Plane | 84 |
| Shrub | 6 |
| Grass tuft | 6 |

All outputs are non-indexed with position, normal and RGB vertex colors, merged once per material key. Origins are at ground level; directional props face +Z. Wood uses tinted ground; wool uses colored plaster. Vessels have pointed bodies, narrow necks, flared lips and ribbon handles. Inscription grooves are abstract bands, not readable text. Props deliberately use coarse silhouettes for distant instancing.

Foliage uses UV-mapped cards and the literal foliage key. Trunks use ground. The shared deterministic 128×128 RGBA DataTexture is generated once without canvas; alpha-tested double-sided materials retain depth writes. Keep the shared texture alive while any foliage material uses it. Tall cypress cards are tapered triangles; olive and plane trunks fork into angled branches.

Patch grass material once, then assign `material.userData.uTime.value = elapsedSeconds` each frame (no allocations). Sway uses base-to-tip aSway weights and per-instance position for phase variation. Grass bounds include maximum wind displacement. Use a dedicated grass material: other foliage does not have aSway. Animated shadow silhouettes require equivalently patched custom depth/distance materials. Texture is intentionally sparse and stylized; no browser visual review was performed.

Validation: runtime generation verified every triangle budget, unique material keys, non-indexed output, required attributes, finite positions, texture dimensions and wind shader injection. TypeScript checked with `npx tsc --noEmit -p tsconfig.app.json`.
