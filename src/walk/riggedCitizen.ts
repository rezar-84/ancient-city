import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

type Era = 'greek' | 'roman' | 'byzantine'
type Gender = 'm' | 'f'
type Palette = { cloth: THREE.Color; skin: THREE.Color; accent: THREE.Color }
export interface CitizenMotion { speed: number; grounded: boolean; wave: boolean; look: number; groundAt?: (x: number, z: number) => number }
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

/** Post-animation two-bone IK and a small, welded position-based cloth solver. */
function secondaryMotion(root: THREE.Group, skirt: THREE.SkinnedMesh) {
  root.updateMatrixWorld(true)
  const legs = ['l', 'r'].map(side => {
    const thigh = root.getObjectByName(`thigh_${side}`)!, calf = root.getObjectByName(`calf_${side}`)!, foot = root.getObjectByName(`foot_${side}`)!
    return { thigh, calf, foot, sole: foot.getWorldPosition(new THREE.Vector3()).y - root.position.y,
      hip: new THREE.Vector3(), ankle: new THREE.Vector3(),
      bones: [thigh, calf, foot], saved: [thigh, calf, foot].map(b => b.quaternion.clone()), adjusted: false }
  })
  const geometry = skirt.geometry.clone()
  const cloth = new THREE.Mesh(geometry, skirt.material)
  cloth.name = 'SimulatedTunic'; cloth.castShadow = cloth.receiveShadow = true; cloth.frustumCulled = false
  skirt.parent!.add(cloth); skirt.visible = false
  const particles = Array.from({ length: 144 }, () => new THREE.Vector3())
  const previous = particles.map(p => p.clone()), targets = particles.map(p => p.clone())
  const edges: [number, number][] = []
  for (let row = 0; row < 6; row++) for (let col = 0; col < 24; col++) {
    const i = row * 24 + col
    edges.push([i, row * 24 + (col + 1) % 24])
    if (row < 5) { edges.push([i, i + 24]); edges.push([i, (row + 1) * 24 + (col + 1) % 24]) }
  }
  const restLengths = new Float32Array(edges.length)
  let ready = false, accumulator = 0
  const lastRoot = new THREE.Vector3(), inverse = new THREE.Matrix4()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), direction = new THREE.Vector3(), bend = new THREE.Vector3(), knee = new THREE.Vector3(), target = new THREE.Vector3()
  const rotation = new THREE.Quaternion(), parentRotation = new THREE.Quaternion(), worldRotation = new THREE.Quaternion()
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
      leg.bones.forEach((bone, i) => bone.quaternion.copy(leg.saved[i])); leg.adjusted = false
    }
  }
  return {
    restore,
    reset() { restore(); ready = false; accumulator = 0 },
    update(dt: number, motion: CitizenMotion) {
      root.updateWorldMatrix(true, true)
      if (motion.grounded && motion.groundAt) for (const leg of legs) {
        const hip = leg.thigh.getWorldPosition(new THREE.Vector3()), joint = leg.calf.getWorldPosition(new THREE.Vector3()), ankle = leg.foot.getWorldPosition(new THREE.Vector3())
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
        bend.copy(joint).sub(hip).addScaledVector(direction, -joint.clone().sub(hip).dot(direction))
        if (bend.lengthSq() < 1e-6) bend.set(0, 0, 1).applyQuaternion(root.quaternion).addScaledVector(direction, -direction.dot(new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion)))
        bend.normalize()
        const along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
        knee.copy(hip).addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)))
        leg.bones.forEach((bone, i) => leg.saved[i].copy(bone.quaternion)); leg.adjusted = true
        leg.foot.getWorldQuaternion(worldRotation); const footRotation = worldRotation.clone()
        aim(leg.thigh, leg.calf, knee); aim(leg.calf, leg.foot, target)
        leg.foot.parent!.getWorldQuaternion(parentRotation).invert()
        leg.foot.quaternion.copy(parentRotation.multiply(footRotation))
        leg.foot.updateWorldMatrix(false, true)
      }
      skirt.skeleton.update()
      for (let row = 0; row < 6; row++) for (let col = 0; col < 24; col++) {
        skirt.getVertexPosition(row * 25 + col, targets[row * 24 + col]).applyMatrix4(skirt.matrixWorld)
      }
      edges.forEach(([i, j], index) => { restLengths[index] = targets[i].distanceTo(targets[j]) })
      legs.forEach(leg => { leg.thigh.getWorldPosition(leg.hip); leg.foot.getWorldPosition(leg.ankle) })
      if (!ready || lastRoot.distanceToSquared(root.position) > 1) {
        particles.forEach((p, i) => { p.copy(targets[i]); previous[i].copy(p) }); ready = true
      }
      lastRoot.copy(root.position); accumulator = Math.min(accumulator + dt, 3 / 60)
      while (accumulator >= 1 / 60) {
        accumulator -= 1 / 60
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          if (i < 24) { p.copy(targets[i]); previous[i].copy(p); continue }
          a.copy(p); b.copy(p).sub(previous[i]).multiplyScalar(0.92)
          p.add(b).addScaledVector(c.copy(targets[i]).sub(p), 0.045)
          p.y -= 2 / 3600; p.x += 0.3 / 3600
          previous[i].copy(a)
        }
        for (let iteration = 0; iteration < 4; iteration++) {
          for (let edge = 0; edge < edges.length; edge++) {
            const [i, j] = edges[edge]
            const p = particles[i], q = particles[j], rest = restLengths[edge]
            a.copy(q).sub(p); const length = a.length()
            if (length < 1e-8) continue
            a.multiplyScalar((length - rest) / length)
            if (i >= 24) p.addScaledVector(a, j < 24 ? 1 : 0.5)
            if (j >= 24) q.addScaledVector(a, i < 24 ? -1 : -0.5)
          }
          for (let i = 24; i < particles.length; i++) {
            const p = particles[i]
            a.copy(p).sub(targets[i]); if (a.length() > 0.1) p.copy(targets[i]).add(a.setLength(0.1))
            // Leg capsules prevent the loose hem from passing through the thighs/calves.
            for (const leg of legs) {
              a.copy(leg.hip); b.copy(leg.ankle).sub(a)
              const t = THREE.MathUtils.clamp(c.copy(p).sub(a).dot(b) / Math.max(b.lengthSq(), 1e-8), 0, 1)
              a.addScaledVector(b, t); c.copy(p).sub(a)
              const radius = 0.085 * root.scale.x
              if (c.lengthSq() < radius * radius) p.copy(a).add(c.lengthSq() > 1e-8 ? c.setLength(radius) : c.set(radius, 0, 0))
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
      positions.needsUpdate = true; geometry.computeVertexNormals()
      const normals = geometry.getAttribute('normal')
      for (let row = 0; row < 6; row++) {
        const first = row * 25, last = first + 24
        a.fromBufferAttribute(normals, first); b.fromBufferAttribute(normals, last); a.add(b).normalize()
        normals.setXYZ(first, a.x, a.y, a.z); normals.setXYZ(last, a.x, a.y, a.z)
      }
      normals.needsUpdate = true
    },
    dispose() { geometry.dispose() },
  }
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
  const secondary = secondaryMotion(root, outfit[1])
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
    reset() { secondary.reset(); mixer.stopAllAction(); current = null; actionName = ''; gestureUntil = landingUntil = 0; lastGrounded = true; wasGreeting = false; choose('Idle_Loop') },
    update(rawDt: number, motion: CitizenMotion) {
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
      if (current && ['Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop'].includes(actionName)) current.setEffectiveTimeScale(THREE.MathUtils.clamp(motion.speed / (actionName === 'Walk_Loop' ? 1.5 : actionName === 'Jog_Fwd_Loop' ? 4 : 7), 0.5, 1.6))
      mixer.update(dt)
      secondary.update(dt, motion)
    },
    get action() { return actionName },
    dispose() { secondary.dispose(); mixer.stopAllAction(); mixer.uncacheRoot(content); ownedMaterials.forEach(m => m.dispose()); skeletons.forEach(s => s.dispose()); outfit.forEach(m => m.geometry.dispose()) },
  }
}
