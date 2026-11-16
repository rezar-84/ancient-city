import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

type Era = 'greek' | 'roman' | 'byzantine'
type Gender = 'm' | 'f'
type Palette = { cloth: THREE.Color; skin: THREE.Color; accent: THREE.Color }
export interface CitizenMotion { speed: number; grounded: boolean; wave: boolean; look: number }
type Assets = { m: GLTF; f: GLTF; motions: GLTF }
let assets: Assets | null = null
let pending: Promise<void> | null = null

/** Only fetched on entering walk mode. The existing instanced crowd remains available on failure. */
export function loadCitizenAssets() {
  if (!pending) {
    const loader = new GLTFLoader()
    pending = Promise.all(['male', 'female', 'motions'].map(n => loader.loadAsync(`/models/citizens/${n}.glb`)))
      .then(([m, f, motions]) => { assets = { m, f, motions } })
      .catch(error => { pending = null; throw error })
  }
  return pending
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

/** Build an opaque tunic shell from body skinning plus a separately weighted skirt. */
function makeOutfit(body: THREE.SkinnedMesh, era: Era, palette: Palette) {
  const source = body.geometry.index ? body.geometry.toNonIndexed() : body.geometry.clone()
  const position = source.getAttribute('position')
  source.computeBoundingBox(); const height = source.boundingBox!.max.y
  const keep: number[] = []
  for (let i = 0; i < position.count; i += 3) {
    const y = (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / 3
    const x = Math.max(Math.abs(position.getX(i)), Math.abs(position.getX(i + 1)), Math.abs(position.getX(i + 2)))
    if (y > height * 0.45 && y < height * 0.84 && x < height * 0.27) keep.push(i, i + 1, i + 2)
  }
  const top = new THREE.BufferGeometry()
  for (const key of ['position', 'normal', 'skinIndex', 'skinWeight']) {
    const attribute = source.getAttribute(key), count = attribute.itemSize
    const values = new Float32Array(keep.length * count)
    keep.forEach((vertex, i) => { for (let j = 0; j < count; j++) values[i * count + j] = attribute.array[vertex * count + j] })
    top.setAttribute(key, key === 'skinIndex' ? new THREE.Uint16BufferAttribute(values, count) : new THREE.Float32BufferAttribute(values, count))
  }
  const p = top.getAttribute('position'), normals = top.getAttribute('normal')
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + normals.getX(i) * 0.018, p.getY(i) + normals.getY(i) * 0.018, p.getZ(i) + normals.getZ(i) * 0.018)
  const hem = era === 'greek' ? 0.35 : era === 'roman' ? 0.31 : 0.18
  const skirt = new THREE.CylinderGeometry(height * 0.12, height * 0.19, height * (0.58 - hem), 24, 5, true)
    .translate(0, height * (0.58 + hem) / 2, 0)
  const sp = skirt.getAttribute('position'), si = new Uint16Array(sp.count * 4), sw = new Float32Array(sp.count * 4)
  const pelvis = body.skeleton.bones.findIndex(b => b.name === 'pelvis')
  const left = body.skeleton.bones.findIndex(b => b.name === 'thigh_l'), right = body.skeleton.bones.findIndex(b => b.name === 'thigh_r')
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i), fold = 1 + Math.cos(Math.atan2(z, x) * 12) * 0.025
    sp.setXYZ(i, x * fold, y, z * fold * 0.72)
    const leg = THREE.MathUtils.clamp((height * 0.58 - y) / height, 0, 0.35)
    // Blend across the centre so adjacent skirt vertices cannot split along a leg seam.
    const blend = THREE.MathUtils.smoothstep(x, -height * 0.12, height * 0.12)
    si[i * 4] = pelvis; si[i * 4 + 1] = left; si[i * 4 + 2] = right
    sw[i * 4] = 1 - leg; sw[i * 4 + 1] = leg * blend; sw[i * 4 + 2] = leg * (1 - blend)
  }
  skirt.computeVertexNormals(); skirt.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); skirt.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4))
  source.dispose()
  const cloth = new THREE.MeshStandardMaterial({ color: palette.cloth, roughness: 0.95, side: THREE.DoubleSide })
  const trim = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.85, side: THREE.DoubleSide })
  const belt = new THREE.CylinderGeometry(height * 0.125, height * 0.126, 0.045, 24, 1, true).scale(1, 1, 0.73).translate(0, height * 0.58, 0)
  const bi = new Uint16Array(belt.getAttribute('position').count * 4), bw = new Float32Array(bi.length)
  for (let i = 0; i < bi.length; i += 4) { bi[i] = pelvis; bw[i] = 1 }
  belt.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(bi, 4)); belt.setAttribute('skinWeight', new THREE.Float32BufferAttribute(bw, 4))
  return [top, skirt, belt].map((geometry, i) => {
    const mesh = new THREE.SkinnedMesh(geometry, i === 2 ? trim : cloth)
    mesh.bind(body.skeleton, body.bindMatrix); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false
    return mesh
  })
}

export function createRiggedCitizen(era: Era, palette: Palette, gender: Gender = 'm') {
  if (!assets) throw new Error('Citizen assets must finish loading before instantiation')
  return instantiateCitizen(assets[gender], assets.motions, era, palette)
}

/** Exported for CPU regression tests without requiring a renderer or network. */
export function instantiateCitizen(model: GLTF, motions: GLTF, era: Era, palette: Palette) {
  const root = new THREE.Group(), content = clone(model.scene)
  root.add(content); content.updateMatrixWorld(true)
  const ownedMaterials = new Set<THREE.Material>(), skeletons = new Set<THREE.Skeleton>()
  let body: THREE.SkinnedMesh | null = null
  content.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return
    const originals = Array.isArray(o.material) ? o.material : [o.material]
    const materials = originals.map(m => { const copy = m.clone(); ownedMaterials.add(copy); return copy })
    o.material = Array.isArray(o.material) ? materials : materials[0]
    o.castShadow = o.receiveShadow = true; o.frustumCulled = false
    if (o instanceof THREE.SkinnedMesh) {
      skeletons.add(o.skeleton)
      if (!body || o.geometry.getAttribute('position').count > body.geometry.getAttribute('position').count) body = o
    }
  })
  if (!body) throw new Error('Citizen model has no skinned body')
  const bodyMesh = body as THREE.SkinnedMesh
  const outfit = makeOutfit(bodyMesh, era, palette)
  for (const mesh of outfit) { bodyMesh.parent!.add(mesh); ownedMaterials.add(mesh.material as THREE.Material) }
  const bounds = new THREE.Box3().setFromObject(content)
  const scale = 1.75 / (bounds.max.y - bounds.min.y)
  content.scale.setScalar(scale); const baseY = -bounds.min.y * scale; content.position.y = baseY
  const rawAnimations = motions.parser.json.animations as Array<{ name: string; extras?: { bindPose?: Record<string, BindPose> } }>
  const clips = motions.animations.map(c => retargetCitizenClip(c, content, motions.scene, rawAnimations.find(a => a.name === c.name)?.extras?.bindPose))
  const mixer = new THREE.AnimationMixer(content)
  const actions = new Map(clips.map(c => [c.name, mixer.clipAction(c)]))
  let current: THREE.AnimationAction | null = null, actionName = '', lastGrounded = true, wasGreeting = false, gestureUntil = 0, elapsed = 0, landingUntil = 0
  const choose = (name: string, once = false) => {
    const next = actions.get(name)
    if (!next || next === current) return
    next.reset().setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity)
    next.clampWhenFinished = once; next.setEffectiveWeight(1).setEffectiveTimeScale(1).play()
    if (current) current.crossFadeTo(next, 0.2, false)
    current = next; actionName = name
  }
  choose('Idle_Loop')
  return {
    root, clips, gender: model.scene.name,
    setPalette(next: Palette) {
      for (let i = 0; i < outfit.length; i++) (outfit[i].material as THREE.MeshStandardMaterial).color.copy(i === 2 ? next.accent : next.cloth)
    },
    reset() { mixer.stopAllAction(); current = null; actionName = ''; gestureUntil = landingUntil = 0; lastGrounded = true; wasGreeting = false; choose('Idle_Loop') },
    update(rawDt: number, motion: CitizenMotion) {
      const dt = Math.min(rawDt, 0.05); elapsed += dt
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
      if (current && ['Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop'].includes(actionName)) current.setEffectiveTimeScale(THREE.MathUtils.clamp(motion.speed / (actionName === 'Walk_Loop' ? 1.5 : actionName === 'Jog_Fwd_Loop' ? 4 : 7), 0.5, 1.6))
      mixer.update(dt)
    },
    get action() { return actionName },
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(content); ownedMaterials.forEach(m => m.dispose()); skeletons.forEach(s => s.dispose()); outfit.forEach(m => m.geometry.dispose()) },
  }
}
