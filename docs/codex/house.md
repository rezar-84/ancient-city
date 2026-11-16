# Task C — house and monument geometry

Exports in `src/scene/generators/house.ts`:
- `FACADE_MODULES`: material-separated shared assets, facing +Z, bottom-centred, metre dimensions. Total triangles: door 48, window 60, shopFront 60, stringCourse 24, eave 36, balcony 60.
- `FacadeWing` and `layoutFacade(wing, rand)`: build-time placements on the selected street wall, respecting local +Z=u and local +X=v, with 0.02m outward clearance. Seedable spacing, sparse high windows, upper-storey bands, occasional balconies, clipped final band repeats and corner margins. Allocates only during layout; no frame callbacks.
- `peristyle(courtW, courtD, colH=3.2)`: courtyard column matrices (use `column(colH, 0.18)`), 48-triangle kerb and 60-triangle 1.6×1.0m basin. A 12×16m court has 20 columns; corner columns are not duplicated. Minimum court 2.4×1.8m.
- `theatreScaenaeDetail(width=90, height=28)`: 8,648 triangles, two material meshes, three tiers of nine paired-column aediculae, alternating pediments, five door panels and 22 low-poly statues. Also checked at existing theatre defaults 70×20m. Minimum supported size 30×12m.

Standalone geometries are non-indexed with position, normal and white vec3 color attributes. Building's merged monument meshes are indexed and include normal/color attributes. Materials remain shared; recesses use vertex tint. Dark panels simulate recesses over solid instanced walls rather than cutting openings. The theatre is decorative frontage without a solid backing wall; use the existing scaena behind it.

Existing theatre audience-facing wall points -Z. Rotate detail by PI and place at `(0, 1.5, max(13, outerRadius*0.3)-stageDepth/2-0.71)`. Pass stageWidth/stageHeight for matching dimensions. No integration files changed.

Validation: `npx tsc --noEmit -p tsconfig.app.json` passed. Runtime geometry checks verified finite position/normal/color attributes, module budgets, theatre budget and finite placement matrices for all four wall directions.
