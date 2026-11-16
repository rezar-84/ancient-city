# Citizen assets

Derived from the user's downloaded Quaternius **Universal Base Characters
[Standard]**, **Universal Animation Library [Standard]**, and **Universal
Animation Library 2 [Standard]**. The included original licenses identify these
assets as CC0. Keep the three LICENSE files alongside the packaged assets.

`male.glb` and `female.glb` contain the full-body male/female models, SimpleParted
and Buns hairstyles respectively, and embedded body/eye base-color textures.
Normal/roughness maps and hair textures are omitted to reduce transfer size.
`motions.glb` contains 12 selected in-place clips, without the library's preview
meshes or textures. Animation extras retain source bind poses for retargeting.
Generated tunics and belts are added at runtime, with era-dependent hems.

Rebuild from the repository root:

```sh
python3 scripts/prepare_characters.py --downloads /home/rubuntu/Downloads
```

The script reads the three original download folders without modifying them.
`manifest.json` records output sizes and SHA-256 hashes.

The approximately 7.3 MB asset set loads on entering walk mode. Detailed rigs
are limited to the third-person player and up to six nearby citizens (two on
coarse-pointer devices); the rest use the existing instanced crowd. If loading
fails, the original crowd remains available. Textures and source geometry are
shared; each visible rig has an independent skeleton and animation mixer.

Movement stays controlled by the existing world collision/grounding code.
Animation clips are retargeted and cross-faded. Post-animation two-bone foot
IK samples terrain/street support, adjusts ankle height within reach limits,
preserves swing clearance, and releases during jumps. It does not lock footsteps
in world space or rotate soles to the slope.

The tunic hem uses 144 welded cloth particles with a pinned waist, damped inertia,
gravity, mild wind, distance constraints, animation tethers and leg capsules.
It steps at 60 Hz with at most three steps per update and resets after teleport
or pool reuse. This is a lightweight hem simulation, without cloth self-collision
or collisions against arbitrary buildings. Only the existing nearby rig pool
and visible third-person player run these solvers. Pausing freezes their updates. CPU regression checks cover skinned bounds, weights, independent
poses, transitions, and the asset-size budget. Real GPU rendering and frame
rate still require a browser check on target devices.
