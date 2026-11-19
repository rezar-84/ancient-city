import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

export type Era = 'greek' | 'roman' | 'byzantine'
export type Gender = 'm' | 'f'
export type GarmentCut = 'work' | 'full'
export type FabricKind = 'linen' | 'wool'
export type CitizenRole = 'resident' | 'merchant' | 'porter' | 'soldier' | 'pilgrim' | 'priest'
export type AgeGroup = 'child' | 'adolescent' | 'young' | 'adult' | 'older'
export type Palette = { cloth: THREE.Color; skin: THREE.Color; accent: THREE.Color }
export interface CitizenMotion {
  speed: number
  grounded: boolean
  wave: boolean
  look: number
  bend?: number
  reach?: number
  groundAt?: (x: number, z: number) => number
}
export interface CitizenConfig {
  cut?: GarmentCut
  fabric?: FabricKind
  role?: CitizenRole
  age?: AgeGroup
}

/** GLTFLoader for the meshopt-compressed (EXT_meshopt_compression, lossless float attributes) citizen and animal GLBs. */
export function createMeshoptGLTFLoader() {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
}

/** Detail level for one citizen update: full IK + cloth, animation only (skinned hem), or off-screen (time only). */
export const CITIZEN_DETAIL = { offscreen: 0, animated: 1, full: 2 } as const
export type CitizenDetail = typeof CITIZEN_DETAIL[keyof typeof CITIZEN_DETAIL]

/** Generous fixed culling sphere around each rig (world metres at unit root scale), covering raised spears and staffs. */
const CULL_CENTER_Y = 0.95
const CULL_RADIUS = 1.75
/** Cloth solver step: 30 Hz with damping/spring/gravity rescaled from the original 60 Hz tuning. */
const SIM_STEP = 1 / 30

// Module scratch objects shared by every rig (updates are synchronous, never re-entrant).
const _hip = new THREE.Vector3(), _joint = new THREE.Vector3(), _ankle = new THREE.Vector3()
const _tmp = new THREE.Vector3(), _fwd = new THREE.Vector3(), _delta = new THREE.Vector3()
const _footRotation = new THREE.Quaternion()

type Assets = { m: GLTF; f: GLTF; motions: GLTF }
let assets: Assets | null = null
let pending: Promise<void> | null = null

/** Only fetched on entering walk mode. The existing instanced crowd remains available on failure. */
export function loadCitizenAssets() {
  if (!pending) {
    const loader = createMeshoptGLTFLoader()
    pending = Promise.all(['male', 'female', 'motions'].map(n => loader.loadAsync(`/models/citizens/${n}.glb`)))
      .then(([m, f, motions]) => { assets = { m, f, motions } })
      .catch(error => { pending = null; throw error })
  }
  return pending
}

/** Procedural warp/weft linen slubbing vs diagonal fulled wool twill without extra texture fetches. */
function patchGarmentMaterial(mat: THREE.MeshStandardMaterial, uWeave: { value: number }) {
  mat.userData.uWeave = uWeave
  mat.customProgramCacheKey = () => 'citizen-garment-v2'
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWeave = uWeave
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGarmentLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGarmentLocal = position;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uWeave;
varying vec3 vGarmentLocal;
float gHash(vec2 p) { p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 34.23); return fract(p.x * p.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  // uWeave = 0 -> crisp slubbed flax linen; uWeave = 1 -> soft diagonal combed Anatolian wool
  vec2 uv = vec2(atan(vGarmentLocal.z, vGarmentLocal.x) * 28.0, vGarmentLocal.y * 95.0);
  float warp = sin(uv.x * 6.28318) * 0.5 + 0.5;
  float weft = sin(uv.y * 6.28318 + gHash(floor(uv)) * 1.4) * 0.5 + 0.5;
  float linen = (warp * 0.55 + weft * 0.45 - 0.5) * 0.085;
  float twill = (sin((uv.x + uv.y) * 4.2) * 0.5) * 0.055;
  float grain = mix(linen, twill, uWeave);
  diffuseColor.rgb *= 1.0 + grain;
}`)
  }
  mat.needsUpdate = true
}

interface BindPose { rotation?: number[]; translation?: number[] }
/** Keep target bone lengths; apply animation deltas relative to each pack's own bind pose. */
export function retargetCitizenClip(clip: THREE.AnimationClip, target: THREE.Object3D, source: THREE.Object3D, bindPose?: Record<string, BindPose>) {
  const tracks: THREE.KeyframeTrack[] = []
  for (const track of clip.tracks) {
    const parsed = THREE.PropertyBinding.parseTrackName(track.name)
    const name = parsed.nodeName ?? ''
    const bone = target.getObjectByName(name), original = source.getObjectByName(name)
    if (!bone || !original) continue
    const bind = bindPose?.[name]
    if (parsed.propertyName === 'quaternion') {
      const rest = bind?.rotation ? new THREE.Quaternion().fromArray(bind.rotation) : original.quaternion.clone()
      const correction = bone.quaternion.clone().multiply(rest.invert())
      const values = track.values.slice(), q = new THREE.Quaternion()
      for (let i = 0; i < values.length; i += 4) q.fromArray(values, i).premultiply(correction).normalize().toArray(values, i)
      tracks.push(new THREE.QuaternionKeyframeTrack(track.name, track.times.slice(), values, track.getInterpolation()))
    } else if (parsed.propertyName === 'position' && name === 'pelvis') {
      const rest = bind?.translation ? new THREE.Vector3().fromArray(bind.translation) : original.position.clone()
      const ratio = bone.position.length() / Math.max(0.001, rest.length())
      const values = track.values.slice()
      for (let i = 0; i < values.length; i += 3) {
        values[i] = bone.position.x + (values[i] - rest.x) * ratio
        values[i + 1] = bone.position.y + (values[i + 1] - rest.y) * ratio
        values[i + 2] = bone.position.z + (values[i + 2] - rest.z) * ratio
      }
      tracks.push(new THREE.VectorKeyframeTrack(track.name, track.times.slice(), values, track.getInterpolation()))
    }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks)
}

function makeRigidSkinned(geometry: THREE.BufferGeometry, boneIndex: number, skeleton: THREE.Skeleton, bindMatrix: THREE.Matrix4, material: THREE.Material) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  const n = g.getAttribute('position').count
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) { si[i * 4] = Math.max(0, boneIndex); sw[i * 4] = 1 }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4))
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4))
  g.computeVertexNormals()
  const mesh = new THREE.SkinnedMesh(g, material)
  mesh.bind(skeleton, bindMatrix)
  // Accessories receive but do not cast shadows; culling uses the rig's fixed bounding sphere.
  mesh.castShadow = false; mesh.receiveShadow = true
  return mesh
}

/** Build era-differentiated bodice, simulated pleated skirt with rear seat ease, waist belt, clavi/hem trims, and role gear. */
function makeOutfit(body: THREE.SkinnedMesh, era: Era, palette: Palette, gender: Gender) {
  const source = body.geometry.index ? body.geometry.toNonIndexed() : body.geometry.clone()
  const position = source.getAttribute('position')
  source.computeBoundingBox(); const height = source.boundingBox!.max.y
  // Era-differentiated sleeve reach: sleeveless/pinned Hellenistic chiton, short-sleeved Roman tunica, long-sleeved Byzantine dalmatica
  const sleeveSpan = era === 'greek' ? height * 0.205 : era === 'roman' ? height * 0.275 : height * 0.345
  const keep: number[] = []
  for (let i = 0; i < position.count; i += 3) {
    const y = (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / 3
    const cx = (position.getX(i) + position.getX(i + 1) + position.getX(i + 2)) / 3
    const cz = (position.getZ(i) + position.getZ(i + 1) + position.getZ(i + 2)) / 3
    const x = Math.max(Math.abs(position.getX(i)), Math.abs(position.getX(i + 1)), Math.abs(position.getX(i + 2)))
    // Keep full shoulder coverage up to 0.885*height while opening a clean collar around the neck
    const inNeck = y > height * 0.835 && Math.hypot(cx, cz) < height * 0.062
    if (y > height * 0.45 && y < height * 0.885 && x < sleeveSpan && !inNeck) keep.push(i, i + 1, i + 2)
  }
  const top = new THREE.BufferGeometry()
  for (const key of ['position', 'normal', 'skinIndex', 'skinWeight']) {
    const attribute = source.getAttribute(key), count = attribute.itemSize
    const values = new Float32Array(keep.length * count)
    keep.forEach((vertex, i) => { for (let j = 0; j < count; j++) values[i * count + j] = attribute.array[vertex * count + j] })
    top.setAttribute(key, key === 'skinIndex' ? new THREE.Uint16BufferAttribute(values, count) : new THREE.Float32BufferAttribute(values, count))
  }
  const p = top.getAttribute('position'), normals = top.getAttribute('normal')
  const topColors = new Float32Array(p.count * 3).fill(1)
  // Bloused kolpos overhang just above the belt (strongest in Greek chiton & Roman belted work tunic, tailored in Byzantine dalmatica)
  const kolposAmp = era === 'greek' ? 0.022 : era === 'roman' ? 0.015 : 0.008
  for (let i = 0; i < p.count; i++) {
    const py = p.getY(i), px = p.getX(i)
    const kolpos = kolposAmp * Math.exp(-(((py / height - 0.635) / 0.032) ** 2))
    const shell = 0.018 + kolpos
    p.setXYZ(i, px + normals.getX(i) * shell, py - kolpos * 0.35 + normals.getY(i) * 0.018, p.getZ(i) + normals.getZ(i) * shell)
    // Vertical clavi stripes on Roman & Byzantine tunics; shoulder fibula bands on Greek chiton
    const clavus = (era === 'roman' || era === 'byzantine') && Math.abs(Math.abs(px) - height * 0.058) < height * 0.011 && py > height * 0.56
    const cuff = era === 'byzantine' && Math.abs(px) > height * 0.28
    if (clavus || cuff) {
      topColors[i * 3] = 0.62; topColors[i * 3 + 1] = 0.42; topColors[i * 3 + 2] = 0.48
    }
  }
  top.setAttribute('color', new THREE.Float32BufferAttribute(topColors, 3))
  top.computeVertexNormals()

  // Sample the actual waist of this body in bind space (front and back are asymmetric).
  let halfWidth = 0, back = Infinity, front = -Infinity
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(position.getY(i) / height - 0.61) > 0.025) continue
    halfWidth = Math.max(halfWidth, Math.abs(position.getX(i)))
    back = Math.min(back, position.getZ(i))
    front = Math.max(front, position.getZ(i))
  }
  const waistX = halfWidth + 0.024
  const waistZ = (front - back) / 2 + 0.024
  const centerZ = (front + back) / 2
  const hem = era === 'greek' ? 0.35 : era === 'roman' ? 0.31 : 0.18
  const foldCount = era === 'greek' ? 14 : era === 'roman' ? 12 : 10
  const foldAmp = era === 'greek' ? 0.032 : era === 'roman' ? 0.028 : 0.022
  // Snug contoured waist opening smoothly into natural pleated seat & stride volume below the belt.
  const skirt = new THREE.CylinderGeometry(height * 0.132, height * 0.168, height * (0.61 - hem), 24, 5, true)
    .translate(0, height * (0.61 + hem) / 2, 0)
  const sp = skirt.getAttribute('position'), si = new Uint16Array(sp.count * 4), sw = new Float32Array(sp.count * 4)
  const skirtColors = new Float32Array(sp.count * 3).fill(1)
  const pelvis = body.skeleton.bones.findIndex(b => b.name === 'pelvis')
  const spine1 = body.skeleton.bones.findIndex(b => b.name === 'spine_01')
  const spine2 = body.skeleton.bones.findIndex(b => b.name === 'spine_02')
  const left = body.skeleton.bones.findIndex(b => b.name === 'thigh_l'), right = body.skeleton.bones.findIndex(b => b.name === 'thigh_r')
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i)
    const angle = Math.atan2(z, x)
    const belowBelt = THREE.MathUtils.clamp((height * 0.61 - y) / Math.max(0.01, height * (0.61 - hem)), 0, 1)
    const fold = 1 + Math.cos(angle * foldCount) * foldAmp * (0.35 + 0.65 * belowBelt)
    const waist = THREE.MathUtils.smoothstep(y / height, 0.51, 0.61)
    // Extra rear pleat ease stored behind the belt so bending or striding never pulls taut across the seat
    const rearEase = z < 0 ? -0.026 * Math.sin(Math.min(1, belowBelt * 1.4) * Math.PI * 0.85) * (-z / Math.max(0.04, Math.hypot(x, z))) : 0
    const sx = THREE.MathUtils.lerp(x * fold, waistX * Math.cos(angle), waist)
    const sz = THREE.MathUtils.lerp(z * fold * 0.97 + rearEase, centerZ + waistZ * Math.sin(angle), waist)
    sp.setXYZ(i, sx, y, sz)
    // Woven border band along the hem (Greek meander / Byzantine segmenta) and vertical clavi
    const nearHem = belowBelt > 0.88
    const onClavus = (era === 'roman' || era === 'byzantine') && Math.abs(Math.abs(sx) - height * 0.058) < height * 0.012
    if ((nearHem && era !== 'roman') || onClavus) {
      skirtColors[i * 3] = 0.64; skirtColors[i * 3 + 1] = 0.44; skirtColors[i * 3 + 2] = 0.48
    }
    const leg = THREE.MathUtils.clamp((height * 0.61 - y) / height, 0, 0.24)
    const blend = THREE.MathUtils.smoothstep(x, -height * 0.12, height * 0.12)
    si[i * 4] = pelvis; si[i * 4 + 1] = left; si[i * 4 + 2] = right
    sw[i * 4] = 1 - leg; sw[i * 4 + 1] = leg * blend; sw[i * 4 + 2] = leg * (1 - blend)
  }
  skirt.setAttribute('color', new THREE.Float32BufferAttribute(skirtColors, 3))
  skirt.computeVertexNormals()
  skirt.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4))
  skirt.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4))
  source.dispose()

  const uWeave = { value: era === 'roman' ? 0 : 0.6 }
  const cloth = new THREE.MeshStandardMaterial({ color: palette.cloth, roughness: 0.78, vertexColors: true, side: THREE.DoubleSide })
  patchGarmentMaterial(cloth, uWeave)
  const trim = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.86, side: THREE.DoubleSide })
  const leatherMat = new THREE.MeshStandardMaterial({ color: '#5b3926', roughness: 0.76, side: THREE.DoubleSide })
  const metalMat = new THREE.MeshStandardMaterial({ color: era === 'byzantine' ? '#9e8858' : '#b78d4a', metalness: 0.58, roughness: 0.38, side: THREE.DoubleSide })
  const woodMat = new THREE.MeshStandardMaterial({ color: '#7a593a', roughness: 0.88 })

  // Fitted tunic waist cinch / calfskin cord belt with knot/buckle
  const beltH = era === 'roman' ? 0.028 : 0.038
  const belt = new THREE.CylinderGeometry(1, 1, beltH, 24, 1, true)
    .scale(waistX + 0.005, 1, waistZ + 0.005)
    .translate(0, height * 0.61, centerZ)
  const bi = new Uint16Array(belt.getAttribute('position').count * 4), bw = new Float32Array(bi.length)
  for (let i = 0; i < bi.length; i += 4) { bi[i] = pelvis; bw[i] = 1 }
  belt.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(bi, 4))
  belt.setAttribute('skinWeight', new THREE.Float32BufferAttribute(bw, 4))

  const baseMeshes = [top, skirt, belt].map((geometry, i) => {
    const mesh = new THREE.SkinnedMesh(geometry, i === 2 ? trim : cloth)
    mesh.bind(body.skeleton, body.bindMatrix)
    // Tunic top and skirt cast shadows; the belt only receives.
    mesh.castShadow = i !== 2; mesh.receiveShadow = true
    return mesh
  })

  // Role-specific historical garments & equipment (created once per pooled citizen, toggled cleanly via visibility)
  // Close-draped himation / palla shawl: wraps back and one shoulder without protruding above collar or in front of face
  const mantleGeo = new THREE.CylinderGeometry(waistX * 1.05, waistX * 1.13, height * 0.24, 18, 2, true, Math.PI * 0.55, Math.PI * 1.25)
  const mp = mantleGeo.getAttribute('position')
  for (let i = 0; i < mp.count; i++) {
    const ang = Math.atan2(mp.getZ(i), mp.getX(i))
    mp.setY(i, mp.getY(i) + height * 0.022 * Math.cos(ang))
  }
  mantleGeo.scale(1, 1, (waistZ / waistX) * 1.04).translate(0, height * 0.70, centerZ - 0.006)
  const mantle = makeRigidSkinned(mantleGeo, spine2 >= 0 ? spine2 : pelvis, body.skeleton, body.bindMatrix, trim)

  // Fitted shoulder cape (paenula / birrus) resting from neck collar over shoulders (pilgrims & Byzantine clergy)
  const capeGeo = new THREE.CylinderGeometry(waistX * 0.60, waistX * 1.32, height * 0.16, 18, 1, true)
    .scale(1.06, 1, 1.15)
    .translate(0, height * 0.795, centerZ + 0.018)
  const cape = makeRigidSkinned(capeGeo, spine2 >= 0 ? spine2 : pelvis, body.skeleton, body.bindMatrix, trim)

  const headBone = body.skeleton.bones.find(b => b.name === 'Head')
  const lowerArmLBone = body.skeleton.bones.find(b => b.name === 'lowerarm_l')
  const handRBone = body.skeleton.bones.find(b => b.name === 'hand_r')
  const boneAttachments: THREE.Mesh[] = []
  const attachToBone = (bone: THREE.Bone | undefined, geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]) => {
    geo.computeVertexNormals()
    const m = new THREE.Mesh(geo, mat)
    m.position.set(...pos)
    m.rotation.set(...rot)
    m.castShadow = false; m.receiveShadow = true
    m.visible = false
    if (bone) bone.add(m)
    boneAttachments.push(m)
    return m
  }

  // Open-front head veil / monastic cowl attached directly to Head bone so it tracks head turns cleanly without covering the face
  const veilGeo = new THREE.SphereGeometry(0.132, 16, 10, Math.PI * 0.78, Math.PI * 1.44, 0, Math.PI * 0.80)
    .scale(1.02, 1.16, 1.06)
  const veilMat = era === 'byzantine' && gender === 'm'
    ? new THREE.MeshStandardMaterial({ color: '#3b332c', roughness: 0.92, side: THREE.DoubleSide })
    : (gender === 'f' && era === 'byzantine' ? trim : cloth)
  const veil = attachToBone(headBone, veilGeo, veilMat, [0, 0.088, -0.022])

  // Soldier: scale/lamellar cuirass + INDEPENDENT military equipment belt (cingulum militare with pteruges) + bone-attached helmet, spear & shield
  const cuirassGeo = new THREE.CylinderGeometry(waistX * 1.14, waistX * 1.06, height * 0.23, 18, 1, true)
    .scale(1, 1, (waistZ / waistX) * 1.06)
    .translate(0, height * 0.725, centerZ)
  const cuirass = makeRigidSkinned(cuirassGeo, spine2 >= 0 ? spine2 : pelvis, body.skeleton, body.bindMatrix, metalMat)

  // Independent military equipment belt fitted over hip crest (0.568 * height) with hanging pteruges apron strips
  const cingulumParts: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(1, 1, 0.046, 20, 1, true)
      .scale(waistX * 1.11, 1, waistZ * 1.12)
      .rotateX(0.05)
      .translate(0, height * 0.568, centerZ + 0.004),
  ]
  for (let s = -2; s <= 2; s++) {
    cingulumParts.push(new THREE.BoxGeometry(0.024, height * 0.11, 0.012).translate(s * 0.032, height * 0.50, centerZ + waistZ * 1.13))
  }
  const cingulumGeo = mergeSimple(cingulumParts)
  const cingulum = makeRigidSkinned(cingulumGeo, pelvis, body.skeleton, body.bindMatrix, leatherMat)

  // Helmet attached directly to Head bone: bronze/iron dome + neck guard + brow band
  const helmetGeo = mergeSimple([
    new THREE.SphereGeometry(0.132, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.56).scale(0.98, 1.06, 1.08),
    new THREE.CylinderGeometry(0.134, 0.146, 0.055, 14, 1, true, Math.PI * 0.65, Math.PI * 0.7).translate(0, -0.035, -0.015),
  ])
  const helmet = attachToBone(headBone, helmetGeo, metalMat, [0, 0.118, -0.006])

  // Spear gripped directly inside hand_r palm, standing upright (+Y rotated ~+150° around X so tip points cleanly UP)
  const spearGeo = mergeSimple([
    new THREE.CylinderGeometry(0.015, 0.017, 1.95, 8).translate(0, 0.25, 0),
    new THREE.ConeGeometry(0.034, 0.22, 4).translate(0, 1.32, 0),
    new THREE.CylinderGeometry(0.019, 0.019, 0.08, 8).translate(0, -0.74, 0),
  ])
  const spear = attachToBone(handRBone, spearGeo, woodMat, [0.02, 0.075, 0.025], [Math.PI * 0.82, 0, 0.06])

  // Round/oval buckler shield strapped flush to the outer face (-X) of lowerarm_l with central boss
  const shieldGeo = mergeSimple([
    new THREE.CylinderGeometry(0.32, 0.32, 0.028, 18).rotateZ(Math.PI / 2),
    new THREE.SphereGeometry(0.075, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5).rotateZ(Math.PI / 2).translate(-0.015, 0, 0),
  ])
  const shield = attachToBone(lowerArmLBone, shieldGeo, trim, [-0.072, 0.13, 0.015], [0, 0.12, 0])

  // Porter: crossed hemp rope harness + dorsal Phrygian amphora / woven pack basket
  const porterGeo = mergeSimple([
    new THREE.TorusGeometry(waistX * 0.95, 0.014, 4, 14).scale(0.85, 1.35, 0.72).rotateY(0.45).translate(0, height * 0.72, centerZ),
    new THREE.TorusGeometry(waistX * 0.95, 0.014, 4, 14).scale(0.85, 1.35, 0.72).rotateY(-0.45).translate(0, height * 0.72, centerZ),
    new THREE.LatheGeometry(
      [[0, -0.18], [0.06, -0.12], [0.115, 0.04], [0.085, 0.16], [0.04, 0.21], [0.052, 0.26]].map(([x, y]) => new THREE.Vector2(x, y)),
      10,
    ).rotateX(-0.22).translate(0, height * 0.75, centerZ - waistZ * 1.45),
  ])
  const porterLoad = makeRigidSkinned(porterGeo, spine2 >= 0 ? spine2 : spine1, body.skeleton, body.bindMatrix, woodMat)

  // Pilgrim: walking staff gripped in hand_r + eulogia ampulla pouch at hip
  const pilgrimStaffGeo = new THREE.CylinderGeometry(0.016, 0.020, 1.55, 8).translate(0, 0.10, 0)
  const pilgrimStaff = attachToBone(handRBone, pilgrimStaffGeo, woodMat, [0.02, 0.075, 0.025], [Math.PI * 0.82, 0, 0.06])
  const pilgrimPouchGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.024, 10).rotateX(Math.PI / 2).translate(waistX * 1.04, height * 0.55, centerZ + 0.04)
  const pilgrimGear = makeRigidSkinned(pilgrimPouchGeo, pelvis, body.skeleton, body.bindMatrix, leatherMat)

  // Merchant belt coin pouch (marsupium) hanging cleanly at the right hip
  const pouchGeo = new THREE.SphereGeometry(0.042, 10, 8)
    .scale(0.85, 1.25, 0.75)
    .translate(-waistX * 1.04, height * 0.565, centerZ + 0.035)
  const merchantPouch = makeRigidSkinned(pouchGeo, pelvis, body.skeleton, body.bindMatrix, leatherMat)

  const extraMeshes = [mantle, cape, cuirass, cingulum, porterLoad, pilgrimGear, merchantPouch]
  const allExtras: THREE.Mesh[] = [...extraMeshes, ...boneAttachments]
  allExtras.forEach(m => { m.visible = false })

  return {
    baseMeshes,
    extraMeshes,
    boneAttachments,
    materials: veilMat !== trim && veilMat !== cloth ? [cloth, trim, leatherMat, metalMat, woodMat, veilMat] : [cloth, trim, leatherMat, metalMat, woodMat],
    clothMat: cloth,
    trimMat: trim,
    uWeave,
    setRoleVisuals(role: CitizenRole, age: AgeGroup = 'adult') {
      allExtras.forEach(m => { m.visible = false })
      baseMeshes[2].visible = role !== 'soldier' // soldier uses independent cingulum equipment belt
      const isYouth = age === 'child' || age === 'adolescent'
      if (role === 'resident') {
        mantle.visible = !isYouth
        veil.visible = !isYouth && gender === 'f' && era === 'byzantine'
      } else if (role === 'merchant') {
        merchantPouch.visible = true
      } else if (role === 'porter') {
        porterLoad.visible = true
      } else if (role === 'soldier') {
        cuirass.visible = true
        cingulum.visible = true
        helmet.visible = true
        spear.visible = true
        shield.visible = true
      } else if (role === 'pilgrim') {
        cape.visible = !isYouth
        pilgrimGear.visible = !isYouth
        pilgrimStaff.visible = !isYouth
        veil.visible = !isYouth && gender === 'f' && era === 'byzantine'
      } else if (role === 'priest') {
        mantle.visible = era !== 'byzantine'
        cape.visible = era === 'byzantine'
        veil.visible = era === 'byzantine' || gender === 'f'
      }
    },
  }
}

function mergeSimple(parts: THREE.BufferGeometry[]) {
  const nonIdx = parts.map(g => g.index ? g.toNonIndexed() : g)
  let count = 0
  for (const g of nonIdx) count += g.getAttribute('position').count
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3)
  let offset = 0
  for (const g of nonIdx) {
    pos.set(g.getAttribute('position').array as Float32Array, offset * 3)
    nor.set(g.getAttribute('normal').array as Float32Array, offset * 3)
    offset += g.getAttribute('position').count
    g.dispose()
  }
  parts.forEach(g => g.dispose())
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  return out
}

/** Post-animation two-bone IK, torso posture (age/role/bend), and two-capsule leg + seat position-based cloth solver. */
function secondaryMotion(root: THREE.Group, skirt: THREE.SkinnedMesh, fabricParams: { damping: number; spring: number }) {
  root.updateMatrixWorld(true)
  const legs = ['l', 'r'].map(side => {
    const thigh = root.getObjectByName(`thigh_${side}`)!, calf = root.getObjectByName(`calf_${side}`)!, foot = root.getObjectByName(`foot_${side}`)!
    const hip = new THREE.Vector3(), kneePos = new THREE.Vector3(), ankle = new THREE.Vector3()
    return { thigh, calf, foot, sole: foot.getWorldPosition(new THREE.Vector3()).y - root.position.y,
      hip, kneePos, ankle,
      // Two-segment leg capsules (thigh->knee, knee->ankle), built once per rig.
      segments: [{ a: hip, b: kneePos, r: 0.094 }, { a: kneePos, b: ankle, r: 0.078 }],
      bones: [thigh, calf, foot], saved: [thigh, calf, foot].map(b => b.quaternion.clone()), adjusted: false }
  })
  const spine1 = root.getObjectByName('spine_01'), spine2 = root.getObjectByName('spine_02'), headBone = root.getObjectByName('Head')
  const upperArmR = root.getObjectByName('upperarm_r'), lowerArmR = root.getObjectByName('lowerarm_r')
  const upperArmL = root.getObjectByName('upperarm_l'), lowerArmL = root.getObjectByName('lowerarm_l')
  const postureBones = [spine1, spine2, headBone, upperArmR, lowerArmR, upperArmL, lowerArmL].filter(Boolean) as THREE.Object3D[]
  const postureSaved = postureBones.map(b => b.quaternion.clone())
  let postureAdjusted = false

  const geometry = skirt.geometry.clone()
  const cloth = new THREE.Mesh(geometry, skirt.material)
  cloth.name = 'SimulatedTunic'; cloth.castShadow = cloth.receiveShadow = true
  skirt.parent!.add(cloth); skirt.visible = false
  const particles = Array.from({ length: 144 }, () => new THREE.Vector3())
  const previous = particles.map(p => p.clone()), targets = particles.map(p => p.clone())
  const edgeList: number[] = []
  for (let row = 0; row < 6; row++) for (let col = 0; col < 24; col++) {
    const i = row * 24 + col
    edgeList.push(i, row * 24 + (col + 1) % 24)
    if (row < 5) edgeList.push(i, i + 24, i, (row + 1) * 24 + (col + 1) % 24)
  }
  const edges = Uint16Array.from(edgeList), edgeCount = edges.length / 2
  const restLengths = new Float32Array(edgeCount)
  let ready = false, accumulator = 0, extraStoop = 0, simulated = true
  const lastRoot = new THREE.Vector3(), inverse = new THREE.Matrix4()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), direction = new THREE.Vector3(), bend = new THREE.Vector3(), knee = new THREE.Vector3(), target = new THREE.Vector3()
  const rotation = new THREE.Quaternion(), parentRotation = new THREE.Quaternion(), worldRotation = new THREE.Quaternion()
  const pelvis = root.getObjectByName('pelvis')!, seat = new THREE.Vector3(), seatLocal = new THREE.Vector3(), inverseRootRotation = new THREE.Quaternion()
  const forwardWorld = new THREE.Vector3()
  function aim(bone: THREE.Object3D, child: THREE.Object3D, point: THREE.Vector3) {
    bone.getWorldPosition(a); child.getWorldPosition(b)
    b.sub(a).normalize(); c.copy(point).sub(a).normalize()
    rotation.setFromUnitVectors(b, c)
    bone.getWorldQuaternion(worldRotation); bone.parent!.getWorldQuaternion(parentRotation).invert()
    bone.quaternion.copy(parentRotation.multiply(rotation).multiply(worldRotation))
    bone.updateWorldMatrix(false, true)
  }
  function restore() {
    for (const leg of legs) if (leg.adjusted) {
      for (let i = 0; i < leg.bones.length; i++) leg.bones[i].quaternion.copy(leg.saved[i])
      leg.adjusted = false
    }
    if (postureAdjusted) {
      for (let i = 0; i < postureBones.length; i++) postureBones[i].quaternion.copy(postureSaved[i])
      postureAdjusted = false
    }
  }
  return {
    cloth,
    restore,
    setStoop(rad: number) { extraStoop = rad },
    setHeadScale(s: number) { if (headBone) headBone.scale.setScalar(s) },
    reset() { restore(); ready = false; accumulator = 0 },
    /** false: hide the simulated hem and show the skinned skirt (distant rigs skip IK and cloth). */
    setSimulated(on: boolean) {
      if (on === simulated) return
      simulated = on; cloth.visible = on; skirt.visible = !on
      if (on) { ready = false; accumulator = 0 }
    },
    update(dt: number, motion: CitizenMotion) {
      const reach = THREE.MathUtils.clamp(motion.reach ?? 0, 0, 1)
      const totalBend = extraStoop + (motion.bend ?? 0) + reach * 0.16
      if (Math.abs(totalBend) > 1e-4 || Math.abs(motion.look) > 1e-4 || reach > 1e-4) {
        for (let i = 0; i < postureBones.length; i++) postureSaved[i].copy(postureBones[i].quaternion)
        postureAdjusted = true
        if (spine1 && Math.abs(totalBend) > 1e-4) spine1.rotateX(totalBend * 0.55)
        if (spine2 && Math.abs(totalBend) > 1e-4) spine2.rotateX(totalBend * 0.45)
        if (headBone) {
          if (Math.abs(totalBend) > 1e-4) headBone.rotateX(-totalBend * 0.45)
          if (Math.abs(motion.look) > 1e-4) headBone.rotateY(THREE.MathUtils.clamp(motion.look, -0.85, 0.85) * 0.55)
        }
        if (reach > 1e-4) {
          // Merchant / artisan reaching forward (+Z) over a counter or stall bench
          if (upperArmR) { upperArmR.rotateX(reach * 0.92); upperArmR.rotateZ(-reach * 0.14) }
          if (lowerArmR) lowerArmR.rotateX(reach * 0.25)
          if (upperArmL) { upperArmL.rotateX(reach * 0.58); upperArmL.rotateZ(reach * 0.12) }
          if (lowerArmL) lowerArmL.rotateX(reach * 0.22)
        }
      }
      root.updateWorldMatrix(true, true)
      if (motion.grounded && motion.groundAt) for (const leg of legs) {
        const hip = leg.thigh.getWorldPosition(_hip), joint = leg.calf.getWorldPosition(_joint), ankle = leg.foot.getWorldPosition(_ankle)
        const floor = motion.groundAt(ankle.x, ankle.z)
        if (!Number.isFinite(floor) || Math.abs(floor - root.position.y) > 0.4) continue
        const sole = leg.sole * root.scale.y
        // Swing feet keep their clearance; only near-ground feet settle onto the surface.
        const lift = Math.max(0, ankle.y - root.position.y - sole)
        const contact = 1 - THREE.MathUtils.smoothstep(lift, 0.035, 0.18)
        const correction = Math.max(0, floor + sole - ankle.y) + Math.min(0, floor + sole - ankle.y) * contact
        target.copy(ankle); target.y += THREE.MathUtils.clamp(correction, -0.25, 0.3)
        const upper = hip.distanceTo(joint), lower = joint.distanceTo(ankle)
        direction.copy(target).sub(hip)
        const distance = THREE.MathUtils.clamp(direction.length(), Math.abs(upper - lower) + 0.001, upper + lower - 0.001)
        direction.normalize(); target.copy(hip).addScaledVector(direction, distance)
        bend.copy(joint).sub(hip).addScaledVector(direction, -_tmp.copy(joint).sub(hip).dot(direction))
        if (bend.lengthSq() < 1e-6) {
          _fwd.set(0, 0, 1).applyQuaternion(root.quaternion)
          bend.copy(_fwd).addScaledVector(direction, -direction.dot(_fwd))
        }
        bend.normalize()
        const along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
        knee.copy(hip).addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)))
        for (let i = 0; i < leg.bones.length; i++) leg.saved[i].copy(leg.bones[i].quaternion)
        leg.adjusted = true
        leg.foot.getWorldQuaternion(_footRotation)
        aim(leg.thigh, leg.calf, knee); aim(leg.calf, leg.foot, target)
        leg.foot.parent!.getWorldQuaternion(parentRotation).invert()
        leg.foot.quaternion.copy(parentRotation.multiply(_footRotation))
        leg.foot.updateWorldMatrix(false, true)
      }
      skirt.skeleton.update()
      const teleported = !ready || lastRoot.distanceToSquared(root.position) > 1
      accumulator = Math.min(accumulator + dt, 2 * SIM_STEP)
      const stepping = teleported || accumulator >= SIM_STEP
      // Between 30 Hz solver steps only the pinned waist row is re-sampled from the skinned skirt.
      const sampledRows = stepping ? 6 : 1
      for (let row = 0; row < sampledRows; row++) for (let col = 0; col < 24; col++) {
        skirt.getVertexPosition(row * 25 + col, targets[row * 24 + col]).applyMatrix4(skirt.matrixWorld)
      }
      for (let i = 0; i < 24; i++) { particles[i].copy(targets[i]); previous[i].copy(targets[i]) }
      if (teleported) {
        for (let i = 0; i < particles.length; i++) { particles[i].copy(targets[i]); previous[i].copy(targets[i]) }
        ready = true
      } else if (!stepping) {
        // Carry the free hem with the walker between steps (velocity preserved) so it never stutters behind the body.
        _delta.copy(root.position).sub(lastRoot)
        for (let i = 24; i < particles.length; i++) { particles[i].add(_delta); previous[i].add(_delta) }
      }
      lastRoot.copy(root.position)
      if (stepping) {
        for (let e = 0; e < edgeCount; e++) restLengths[e] = targets[edges[e * 2]].distanceTo(targets[edges[e * 2 + 1]])
        for (const leg of legs) {
          leg.thigh.getWorldPosition(leg.hip)
          leg.calf.getWorldPosition(leg.kneePos)
          leg.foot.getWorldPosition(leg.ankle)
        }
        pelvis.getWorldPosition(seat)
        root.getWorldQuaternion(inverseRootRotation).invert()
        forwardWorld.set(0, 0, 1).applyQuaternion(root.quaternion)
        // 60 Hz tuning converted to a 30 Hz step: per-second damping/spring retention and dt^2-scaled gravity/drag stay equal.
        const damping = fabricParams.damping * fabricParams.damping
        const spring = 1 - (1 - fabricParams.spring) * (1 - fabricParams.spring)
        const gravity = 2.2 / 900
        const trailingDrag = Math.min(motion.speed, 6) * 0.35 / 900
        const scaleX = root.scale.x
        while (accumulator >= SIM_STEP) {
          accumulator -= SIM_STEP
          for (let i = 24; i < particles.length; i++) {
            const p = particles[i]
            const rowF = Math.floor(i / 24) / 5
            a.copy(p); b.copy(p).sub(previous[i]).multiplyScalar(damping)
            p.add(b).addScaledVector(c.copy(targets[i]).sub(p), spring)
            p.y -= gravity
            // Natural aerodynamic trail backward along -forwardWorld so side & rear silhouettes billow cleanly in motion
            p.addScaledVector(forwardWorld, -trailingDrag * rowF)
            previous[i].copy(a)
          }
          for (let iteration = 0; iteration < 4; iteration++) {
            for (let edge = 0; edge < edgeCount; edge++) {
              const i = edges[edge * 2], j = edges[edge * 2 + 1]
              const p = particles[i], q = particles[j], rest = restLengths[edge]
              a.copy(q).sub(p); const length = a.length()
              if (length < 1e-8) continue
              a.multiplyScalar((length - rest) / length)
              if (i >= 24) p.addScaledVector(a, j < 24 ? 1 : 0.5)
              if (j >= 24) q.addScaledVector(a, i < 24 ? -1 : -0.5)
            }
            for (let i = 24; i < particles.length; i++) {
              const p = particles[i]
              a.copy(p).sub(targets[i]); if (a.length() > 0.12) p.copy(targets[i]).add(a.setLength(0.12))
              // Two-segment leg capsules (thigh->knee and knee->ankle) keep side-view bent knees and rear calves cleanly covered.
              for (const leg of legs) {
                for (const seg of leg.segments) {
                  a.copy(seg.a); b.copy(seg.b).sub(a)
                  const t = THREE.MathUtils.clamp(c.copy(p).sub(a).dot(b) / Math.max(b.lengthSq(), 1e-8), 0, 1)
                  a.addScaledVector(b, t); c.copy(p).sub(a)
                  const radius = seg.r * scaleX
                  if (c.lengthSq() < radius * radius) p.copy(a).add(c.lengthSq() > 1e-8 ? c.setLength(radius) : c.set(radius, 0, 0))
                }
              }
              // Keep the rear panel outside the pelvis & seat as thighs and torso rotate.
              seatLocal.copy(p).sub(seat).applyQuaternion(inverseRootRotation)
              const sx = seatLocal.x / (0.185 * root.scale.x), sy = seatLocal.y / (0.185 * root.scale.y), sz = seatLocal.z / (0.168 * root.scale.z)
              const radiusSq = sx * sx + sy * sy + sz * sz
              if (radiusSq < 1) {
                seatLocal.multiplyScalar(1 / Math.sqrt(Math.max(radiusSq, 1e-6))).applyQuaternion(root.quaternion)
                p.copy(seat).add(seatLocal)
              }
            }
          }
        }
      }
      inverse.copy(cloth.matrixWorld).invert()
      const positions = geometry.getAttribute('position')
      for (let row = 0; row < 6; row++) for (let col = 0; col <= 24; col++) {
        a.copy(particles[row * 24 + col % 24]).applyMatrix4(inverse)
        positions.setXYZ(row * 25 + col, a.x, a.y, a.z)
      }
      positions.needsUpdate = true
      // Shading normals only change with the solver (translation between steps leaves them valid).
      if (stepping) {
        geometry.computeVertexNormals()
        const normals = geometry.getAttribute('normal')
        for (let row = 0; row < 6; row++) {
          const first = row * 25, last = first + 24
          a.fromBufferAttribute(normals, first); b.fromBufferAttribute(normals, last); a.add(b).normalize()
          normals.setXYZ(first, a.x, a.y, a.z); normals.setXYZ(last, a.x, a.y, a.z)
        }
        normals.needsUpdate = true
      }
    },
    dispose() { geometry.dispose() },
  }
}

export function createRiggedCitizen(era: Era, palette: Palette, gender: Gender = 'm') {
  if (!assets) throw new Error('Citizen assets must finish loading before instantiation')
  return instantiateCitizen(assets[gender], assets.motions, era, palette, gender)
}

/** Exported for CPU regression tests without requiring a renderer or network. */
export function instantiateCitizen(model: GLTF, motions: GLTF, era: Era, palette: Palette, genderHint?: Gender) {
  const gender: Gender = genderHint ?? (model.scene.name.toLowerCase().includes('f') ? 'f' : 'm')
  const root = new THREE.Group(), content = clone(model.scene)
  root.add(content); content.updateMatrixWorld(true)
  const ownedMaterials = new Set<THREE.Material>(), skeletons = new Set<THREE.Skeleton>()
  let body: THREE.SkinnedMesh | null = null
  content.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return
    const originals = Array.isArray(o.material) ? o.material : [o.material]
    const materials = originals.map(m => { const copy = m.clone(); ownedMaterials.add(copy); return copy })
    o.material = Array.isArray(o.material) ? materials : materials[0]
    o.receiveShadow = true
    if (o instanceof THREE.SkinnedMesh) {
      skeletons.add(o.skeleton)
      if (!body || o.geometry.getAttribute('position').count > body.geometry.getAttribute('position').count) body = o
    }
  })
  if (!body) throw new Error('Citizen model has no skinned body')
  const bodyMesh = body as THREE.SkinnedMesh
  // Only the body (and the generated tunic) cast shadows; eyes, hair and props only receive.
  content.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = o === bodyMesh })
  // Measure height from the bare body BEFORE adding role props (e.g. tall spears) so human stature stays 1.75 m.
  const bounds = new THREE.Box3().setFromObject(content)
  const outfit = makeOutfit(bodyMesh, era, palette, gender)
  for (const mesh of [...outfit.baseMeshes, ...outfit.extraMeshes]) bodyMesh.parent!.add(mesh)
  outfit.materials.forEach(m => ownedMaterials.add(m))
  const scale = 1.75 / (bounds.max.y - bounds.min.y)
  content.scale.setScalar(scale); const baseY = -bounds.min.y * scale; content.position.y = baseY
  const rawAnimations = motions.parser.json.animations as Array<{ name: string; extras?: { bindPose?: Record<string, BindPose> } }>
  const clips = motions.animations.map(c => retargetCitizenClip(c, content, motions.scene, rawAnimations.find(a => a.name === c.name)?.extras?.bindPose))
  const skirtPositions = outfit.baseMeshes[1].geometry.getAttribute('position')
  const workCut = skirtPositions.clone()
  let currentCut: GarmentCut = 'work'
  let currentFabric: FabricKind = era === 'roman' ? 'linen' : 'wool'
  let currentRole: CitizenRole = 'resident'
  let currentAge: AgeGroup = 'adult'
  const fabricParams = { damping: 0.92, spring: 0.052 }
  const secondary = secondaryMotion(root, outfit.baseMeshes[1], fabricParams)
  const applyFabric = (fabric: FabricKind) => {
    currentFabric = fabric
    outfit.uWeave.value = fabric === 'linen' ? 0 : 1
    outfit.clothMat.roughness = fabric === 'linen' ? 0.72 : 0.93
    fabricParams.damping = fabric === 'linen' ? 0.93 : 0.89
    fabricParams.spring = fabric === 'linen' ? 0.062 : 0.044
  }
  applyFabric(currentFabric)

  // Frustum culling stays on: skinned parts and the simulated hem share one generous fixed sphere that follows the root.
  root.updateMatrixWorld(true)
  const cullCenter = new THREE.Vector3(), cullScale = new THREE.Vector3()
  const fitSphere = (o: THREE.Object3D) => {
    o.getWorldScale(cullScale)
    const s = Math.max(1e-6, Math.min(Math.abs(cullScale.x), Math.abs(cullScale.y), Math.abs(cullScale.z)))
    return new THREE.Sphere(o.worldToLocal(cullCenter.set(0, CULL_CENTER_Y, 0)), CULL_RADIUS / s)
  }
  root.traverse(o => {
    if (o instanceof THREE.SkinnedMesh) { o.boundingSphere = fitSphere(o); o.frustumCulled = true }
  })
  secondary.cloth.geometry.boundingSphere = fitSphere(secondary.cloth)

  const mixer = new THREE.AnimationMixer(content)
  const actions = new Map(clips.map(c => [c.name, mixer.clipAction(c)]))
  let current: THREE.AnimationAction | null = null, actionName = '', lastGrounded = true, wasGreeting = false, gestureUntil = 0, elapsed = 0, landingUntil = 0
  /** Animation time owed by off-screen updates, applied in one mixer step when the rig is seen again. */
  let pendingMixerDt = 0
  const choose = (name: string, once = false) => {
    const next = actions.get(name)
    if (!next || next === current) return
    next.reset().setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity)
    next.clampWhenFinished = once; next.setEffectiveWeight(1).setEffectiveTimeScale(1).play()
    if (current) current.crossFadeTo(next, 0.2, false)
    current = next; actionName = name
  }
  const syncStoop = () => {
    const ageStoop = currentAge === 'older' ? 0.13 : 0
    const roleStoop = currentRole === 'porter' ? 0.16 : currentRole === 'merchant' && currentAge === 'older' ? 0.06 : 0
    secondary.setStoop(ageStoop + roleStoop)
    secondary.setHeadScale(currentAge === 'child' ? 1.14 : currentAge === 'adolescent' ? 1.05 : 1)
  }
  const applyCut = (cut: GarmentCut) => {
    if (cut === currentCut) return
    currentCut = cut
    const porterHitch = currentRole === 'porter' ? -0.05 : currentAge === 'child' ? -0.045 : 0
    for (let i = 0; i < workCut.count; i++) {
      const row = Math.floor(i / 25) / 5
      const extra = cut === 'full' && currentAge !== 'child' ? row * row : 0
      skirtPositions.setXYZ(
        i,
        workCut.getX(i) * (1 + extra * 0.11),
        workCut.getY(i) - extra * 0.135 - porterHitch * row,
        workCut.getZ(i) * (1 + extra * 0.095),
      )
    }
    skirtPositions.needsUpdate = true
    secondary.reset()
  }
  choose('Idle_Loop')
  return {
    root, clips, gender: model.scene.name,
    get role() { return currentRole },
    get fabric() { return currentFabric },
    get cut() { return currentCut },
    get age() { return currentAge },
    setCut(cut: GarmentCut) { applyCut(cut) },
    setFabric(fabric: FabricKind) { applyFabric(fabric) },
    setRole(role: CitizenRole) {
      currentRole = role
      outfit.setRoleVisuals(role, currentAge)
      syncStoop()
    },
    setAge(age: AgeGroup) {
      currentAge = age
      outfit.setRoleVisuals(currentRole, currentAge)
      syncStoop()
    },
    configure(cfg: CitizenConfig) {
      if (cfg.role) currentRole = cfg.role
      if (cfg.age) currentAge = cfg.age
      outfit.setRoleVisuals(currentRole, currentAge)
      if (cfg.fabric) applyFabric(cfg.fabric)
      syncStoop()
      if (cfg.cut) {
        currentCut = cfg.cut === 'full' ? 'work' : 'full' // force recompute when role hitch changes
        applyCut(cfg.cut)
      }
    },
    setPalette(next: Palette) {
      outfit.clothMat.color.copy(next.cloth)
      outfit.trimMat.color.copy(next.accent)
    },
    reset() { secondary.reset(); mixer.stopAllAction(); current = null; actionName = ''; gestureUntil = landingUntil = 0; lastGrounded = true; wasGreeting = false; pendingMixerDt = 0; choose('Idle_Loop') },
    /** detail: 2 full (IK + cloth), 1 animation only with the skinned hem (distant), 0 off-screen (advances time only). */
    update(rawDt: number, motion: CitizenMotion, detail: CitizenDetail = CITIZEN_DETAIL.full) {
      const dt = Math.max(0, Math.min(rawDt, 0.05)); elapsed += dt
      secondary.restore()
      if (motion.wave && !wasGreeting) gestureUntil = elapsed + 1.6
      wasGreeting = motion.wave
      if (!lastGrounded && motion.grounded) landingUntil = elapsed + 0.18
      if (!motion.grounded) {
        const next = lastGrounded || (actionName === 'Jump_Start' && (current?.time ?? 0) < 0.2) ? 'Jump_Start' : 'Jump_Loop'
        choose(next, next === 'Jump_Start')
      }
      else if (elapsed < landingUntil && motion.speed < 0.2) choose('Jump_Land', true)
      else if (elapsed < gestureUntil && motion.speed < 0.3) choose('Idle_Talking_Loop')
      else choose(motion.speed < 0.15 ? 'Idle_Loop' : motion.speed < 3.5 ? 'Walk_Loop' : motion.speed < 6 ? 'Jog_Fwd_Loop' : 'Sprint_Loop')
      lastGrounded = motion.grounded
      const ageCadence = currentAge === 'child' ? 1.26 : currentAge === 'adolescent' ? 1.1 : currentAge === 'older' ? 0.9 : 1
      if (current && ['Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop'].includes(actionName)) {
        current.setEffectiveTimeScale(THREE.MathUtils.clamp((motion.speed * ageCadence) / (actionName === 'Walk_Loop' ? 1.5 : actionName === 'Jog_Fwd_Loop' ? 4 : 7), 0.5, 1.85))
      }
      if (detail === CITIZEN_DETAIL.offscreen) {
        // Keep the clock running cheaply so the pose does not freeze-pop when the rig re-enters the view.
        pendingMixerDt = Math.min(pendingMixerDt + dt, 30)
        return
      }
      mixer.update(dt + pendingMixerDt); pendingMixerDt = 0
      secondary.setSimulated(detail === CITIZEN_DETAIL.full)
      if (detail === CITIZEN_DETAIL.full) secondary.update(dt, motion)
    },
    get action() { return actionName },
    dispose() {
      secondary.dispose(); mixer.stopAllAction(); mixer.uncacheRoot(content)
      ownedMaterials.forEach(m => m.dispose()); skeletons.forEach(s => s.dispose())
      ;[...outfit.baseMeshes, ...outfit.extraMeshes, ...outfit.boneAttachments].forEach(m => { m.removeFromParent(); m.geometry.dispose() })
    },
  }
}
