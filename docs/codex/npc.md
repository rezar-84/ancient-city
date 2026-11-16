# NPC geometry

Exports in `src/walk/npcGeometry.ts`:
- `createPersonGeometry(variant)`: Greek 302, Roman 302, Byzantine 314 triangles. Height 1.68 m, feet at origin, facing +Z. Segmented limbs, six-sided cloth panels, drape, sash, faceted head and hair cap; Byzantine adds a veil.
- `createHorseGeometry()`: 416 triangles. Withers approximately 1.6 m; four segmented legs, hooves, ears, mane, tail and harness. Faces +Z.
- `createCartGeometry()`: 284 triangles. Two solid low-poly wooden wheels with visible spoke overlays, bed, side boards, shafts and two wool bales. Origin on the ground under the axle; shafts extend +Z. Position the cart behind its horse during integration.
- `patchCrowdMaterial(material, kind)`: GPU limb motion and normal rotation, breathing, bob, head yaw, gesture/prayer poses, wheel rotation and tint selection. Use a dedicated material for each kind. `material.userData.uTime.value` is seconds; phase is an offset advanced by time and gait speed. No frame-time CPU allocations are needed.
- `createCrowdAttributes(count)`: dynamic anim/tint attributes; attach as iAnim, iTint0, iTint1, iTint2 to the geometry. Defaults are idle and white. After edits, mark affected attributes needsUpdate. Skin and hair share tint1 as specified; baked hair shading darkens that channel. Palette hair colours are available for caller-side styling, not a fourth independent tint channel.
- `ERA_PALETTES`, `SKIN_TONES`: wool, earth, madder, saffron, indigo and limited purple choices with Mediterranean/Anatolian skin tones.

All geometry is non-indexed with position, normal, white-by-default color, aPart, aLimb, aPivot, aBend and aWheel. Cloth vertices use reduced hip weights. Bounds include extra sphere padding for animation. Normals follow the same per-vertex rotations as positions; weighted deformations are an inexpensive visual approximation rather than a full skinning Jacobian.

Crowd.tsx integration is deliberately left to the caller. Attach instanced attributes before rendering, use white base material colours for unmodified palette colours, and avoid redundant CPU bobbing. Animated shadow silhouettes require matching customDepthMaterial/customDistanceMaterial shader patches; the standard material patch alone affects visible rendering. Material cloning requires reapplying the patch.

Validation: geometry smoke check confirmed triangle budgets, matching attribute counts, finite values and person height. TypeScript validation: `npx tsc --noEmit -p tsconfig.app.json`.
Final TypeScript check passed with exit code 0 after the wheel alignment adjustment.
