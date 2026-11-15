# Task: procedural Roman/Byzantine building generators for Hierapolis (three.js r169, TypeScript)

Write ONLY these files (do not touch anything else in the repo):
- src/scene/materials.ts
- src/scene/generators/*.ts (one file per generator + index.ts re-exporting all)

Constraints
- three@0.169, TypeScript strict, ESM. Import from 'three' and 'three/examples/jsm/utils/BufferGeometryUtils.js' (mergeGeometries) only. No React in these files.
- Units: metres. Each generator returns a THREE.Group whose origin is the building's centre at ground level (y=0), "front" faces +Z, north is -Z. Geometry must extend ~3 m below y=0 (a plinth/foundation) so it sits on sloped terrain without gaps.
- PERFORMANCE (target: MacBook Air M2 integrated GPU, whole city ~60 fps): merge all parts that share a material into ONE mesh per material per building (mergeGeometries). Use InstancedMesh for repeated elements when count > 50 (columns, seats, tombs). Low poly: columns 8–10 radial segments, arches 8–12 segments. No textures required; use vertex colors for subtle stone variation (slight random tint per block) — set material.vertexColors = true where used.
- castShadow/receiveShadow = true on meshes.
- Each generator accepts an options object with sensible defaults (documented with JSDoc) so dimensions can be tuned later.
- Style: clean, stylized "museum diorama" look — readable silhouettes, not noisy.

materials.ts: export a function `getMaterials()` returning a cached object of MeshStandardMaterial: marble (warm white #efe8dc), travertine (#e6dccb), limestone (#d6c4a4), roofTile (#b5653f), bronze/dark (#5a4a3a), water (#7fc8d6, transparent 0.8, roughness 0.1), plaster (#e9d9bf), ground (#cdb48e). roughness ~0.85 for stone.

Generators (with defaults approximating the real monuments):
1. theatre.ts `createTheatre(o)`: Greco-Roman theatre built into a hillside. Cavea semicircle-plus (≈ 200°) outer radius 50 m, orchestra radius 10 m, two tiers of seating separated by a diazoma (walkway) at ~60% radius, ~45 rows total, seat row height 0.4 m / depth 0.8 m, radial stairways (kerkides: 8 lower, 16 upper rendered as gaps/steps), retaining outer wall at top. Stage building (scaenae frons) facing the cavea: length 70 m, depth 12 m, height 3 storeys (~20 m) with columned aediculae on the front (2 tiers of columns), central royal door + two side doors, a raised stage (pulpitum) 1.5 m high. The cavea front faces +Z? NO: the cavea opens toward +Z (audience looks toward +Z where the stage is). Use InstancedMesh or merged stepped geometry for seats.
2. gate.ts `createFrontinusGate(o)`: triple-arched gateway (3 equal arches, each 3.5 m wide, 7 m high), total width ~ 14 m, depth 3 m, flanked by two round towers (diameter 8 m, height 11 m, crenellated or plain cylindrical with conical caps omitted). Passage axis along Z.
   Also `createByzantineGate(o)`: simple square towers + single arch in a wall segment.
3. colonnade.ts `createColonnadedStreet(o)`: straight street along Z, length (default 300), carriageway width 14 m paved, on each side a stoa/portico 6 m deep with front column row (column height 6 m, spacing 3.5 m) and a back wall with shop doorways, flat/lean-to tiled roof. Columns as InstancedMesh.
4. temple.ts `createTemple(o)`: prostyle/peripteral temple on a podium (podium 2.5 m high, w 20, l 35), 6 front columns 10 m tall, pediment roof (roofTile), cella walls, stair at front (+Z).
5. agora.ts `createAgora(o)`: large rectangular square (default 170 x 280 m) enclosed by stoas on three sides (column rows + back wall + roof, 10 m deep), open/paved centre, a basilica-stoa on the long east side taller (2 storeys).
6. martyrium.ts `createMartyrium(o)`: St Philip martyrium: central octagon (inner diameter 20 m) with a dome-like octagonal roof/drum, surrounded by a square enclosure ~ 60 x 60 m formed by ranges of rectangular rooms, with porticoes on the outer sides, entrances on axes.
7. baths.ts `createBaths(o)`: big Roman bath complex: rectangular block 70 x 60 m of tall halls (14 m) with barrel vaults (half-cylinders) roofing, an open palaestra court in front.
8. nymphaeum.ts `createNymphaeum(o)`: monumental fountain: U-shaped two-storey columned facade 60 m long, 12 m high, with a water basin in front (water material).
9. necropolis.ts `createNecropolis(o: {area: {w:number,d:number}, seed?, tumuli=40, sarcophagi=250, houseTombs=60})`: scattered tombs in a rectangle area centred on origin: tumuli (circular drum base r 4–8 m + mound), sarcophagi on pedestals (2.4 x 1.2 x 1.4 m with gabled lid), house tombs (small gabled buildings 4 x 6 m). Use a seeded PRNG (mulberry32). Return also `positions` metadata so a caller can re-snap y to terrain: Group.userData.instances = Array<{type, x, z}>. IMPORTANT: provide a function `snapToTerrain(group, heightAt:(x:number,z:number)=>number, origin:{x:number,z:number})` that updates instance matrices so every tomb sits on the terrain.
10. walls.ts `createWall(points: Array<[number,number]>, o)`: city wall following a polyline in XZ (height 8 m, thickness 2.5 m), square towers every ~60 m. Also accepts heightAt callback to follow terrain (each segment's base at terrain).
11. latrine.ts `createLatrine(o)`: long rectangular building 40 x 10 m, two rows of internal columns, roof.
12. church.ts `createChurch(o)`: Byzantine basilica (nave + 2 aisles, apse at -Z end... use apse at east = +X; document it), 25 x 50 m.

index.ts re-exports everything plus a `BUILDERS` map: Record<string, (o?: any) => THREE.Group>.

Quality bar: run `npx tsc --noEmit -p tsconfig.app.json` and make sure your files compile with zero errors. Keep each file self-contained and readable. When done, print a short summary of files and default dimensions.
