import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Terrain } from '../scene/terrainData'
import { GRID } from '../content/grid'
import { LANDMARKS } from '../content/landmarks'
import { MONUMENT_FOOTPRINTS, solidMonumentAt } from '../scene/footprints'
import { CHARACTERS } from '../content/characters'
import { useApp, walkInputBlocked } from '../store'
import {
  createCartGeometry, createCrowdAttributes, createDetailedHorseHarness, createHeldPropGeometry,
  createHorseGeometry, createPersonGeometry, ERA_PALETTES, HAIR, patchCrowdMaterial, POSE, SKIN_TONES,
} from './npcGeometry'
import { gridFrame, stallSpots } from './spots'
import { walk } from './WalkControls'
import { sharedWorldProbe } from './physics'
import {
  CITIZEN_DETAIL, createMeshoptGLTFLoader, createRiggedCitizen, loadCitizenAssets,
  type AgeGroup, type CitizenDetail, type CitizenRole, type FabricKind, type GarmentCut,
} from './riggedCitizen'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { cartPose, type CartPose } from './cartRoute'
import { MarketSheep } from './MarketSheep'

type Variant = 'greek' | 'roman' | 'byzantine'
type PropKind = 'amphora' | 'basket' | 'staff' | 'scroll'
const variantFor = (year: number): Variant => (year < -133 ? 'greek' : year < 330 ? 'roman' : 'byzantine')
/** Everything the spawn memo reads from the year: the era variant plus which landmarks/footprints stand.
 * Scrubbing the year inside one such epoch keeps the same crowd instead of rebuilding every rig. */
function spawnEpoch(year: number) {
  let key = variantFor(year)
  for (const l of LANDMARKS) if (year >= l.built && (l.until === undefined || year <= l.until)) key += `|${l.id}`
  key += '#'
  for (const f of MONUMENT_FOOTPRINTS) if (year >= f.built && (f.until === undefined || year <= f.until)) key += `|${f.id}`
  return key
}
/** Rigs beyond this camera distance animate with the skinned hem only (no foot IK / cloth). */
const RIG_FULL_DETAIL_R2 = 25 * 25
/** Foot IK raycasts against the world only near the walker; further out the terrain plus the cached root support is used. */
const FOOT_PROBE_R2 = 15 * 15
/** Flag a whole-buffer prefix for upload instead of the full attribute. */
function flagPrefix(attr: THREE.BufferAttribute, count: number) {
  attr.clearUpdateRanges()
  attr.addUpdateRange(0, count * attr.itemSize)
  attr.needsUpdate = true
}

let horseAssetPromise: Promise<GLTF> | null = null
function loadHorseAsset() {
  if (!horseAssetPromise) {
    horseAssetPromise = createMeshoptGLTFLoader().loadAsync('/models/animals/cart-horse.glb')
      .catch(error => { horseAssetPromise = null; throw error })
  }
  return horseAssetPromise
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/** NPC kinds & historical roles across Hellenistic 150 BC, Roman AD 200, and Byzantine AD 500. */
interface Npc {
  kind: 'walker' | 'cross' | 'idle' | 'merchant' | 'priest' | 'pilgrim' | 'guard'
  role: CitizenRole
  age: AgeGroup
  cut: GarmentCut
  fabric: FabricKind
  stature: number
  build: number
  propIdx: number // -1 none, 0 amphora, 1 basket, 2 staff, 3 scroll
  u: number; v: number; dir: number; speed: number; min: number; max: number
  /** fixed spot (idle/merchant/priest/guard) in local metres, and facing */
  x?: number; z?: number; face?: number
  bx?: number; bz?: number
  side: number; phase: number; pose: number; look: number
}

/** live NPC positions for barks (x, z, yaw, voice); guard = 1 for stationed soldiers (they bark in Latin under Rome) */
export const NPC_STATE: { x: Float32Array; z: Float32Array; count: number; female: Uint8Array; guard: Uint8Array } = {
  x: new Float32Array(0), z: new Float32Array(0), count: 0, female: new Uint8Array(0), guard: new Uint8Array(0),
}

function roleBodyMetrics(role: CitizenRole, age: AgeGroup, female: boolean, rand: () => number) {
  if (age === 'child') {
    return { stature: 0.66 + rand() * 0.08, build: 0.73 + rand() * 0.07 } // ~1.16–1.30 m
  }
  if (age === 'adolescent') {
    return { stature: 0.83 + rand() * 0.07, build: 0.80 + rand() * 0.08 } // ~1.45–1.58 m
  }
  const genderScale = female ? 0.955 : 1.0
  let stature = (0.95 + rand() * 0.11) * genderScale
  let build = 0.93 + rand() * 0.15
  if (role === 'soldier') {
    stature = 1.01 + rand() * 0.05 // ~1.77–1.85 m
    build = 1.06 + rand() * 0.08
  } else if (role === 'porter') {
    stature = 0.93 + rand() * 0.06 // ~1.63–1.73 m
    build = 0.86 + rand() * 0.08   // wiry, sinewy
  } else if (role === 'merchant') {
    stature = (age === 'older' ? 0.94 : 0.97) + rand() * 0.07
    build = (age === 'older' ? 1.05 : 0.98) + rand() * 0.12
  } else if (role === 'resident') {
    stature = (age === 'young' ? 0.91 : age === 'older' ? 0.95 : 0.98) + rand() * 0.09 * genderScale
    build = (age === 'young' ? 0.88 : 0.94) + rand() * 0.16
  } else if (role === 'pilgrim') {
    stature = (0.93 + rand() * 0.10) * genderScale
    build = 0.90 + rand() * 0.13
  } else if (role === 'priest') {
    stature = (0.97 + rand() * 0.08) * genderScale
    build = 0.94 + rand() * 0.12
  }
  return { stature, build }
}

const NEAR_CAP = 128
const NEAR_R2 = 55 * 55
const WALK_MAX_R2 = 380 * 380
const PROP_MAX_R2 = 115 * 115
const CART_MAX_R2 = 360 * 360
const PROP_INDEX: Record<PropKind, number> = { amphora: 0, basket: 1, staff: 2, scroll: 3 }

export function Crowd({ terrain }: { terrain: Terrain }) {
  const mode = useApp((s) => s.mode)
  const [horse, setHorse] = useState<{ root: THREE.Group; mixer: THREE.AnimationMixer; syncHarness: () => void } | null>(null)
  useEffect(() => {
    if (mode !== 'walk') return
    let active = true
    let dispose: (() => void) | undefined
    void loadHorseAsset().then(model => {
      const rigGroup = new THREE.Group()
      const meshRoot = cloneSkeleton(model.scene)
      const mixer = new THREE.AnimationMixer(meshRoot)
      const harness = createDetailedHorseHarness()
      const clonedMaterials: THREE.Material[] = []
      meshRoot.traverse(o => {
        if (o instanceof THREE.Mesh) {
          if (Array.isArray(o.material)) {
            o.material = o.material.map(m => { const cm = m.clone(); clonedMaterials.push(cm); return cm })
          } else {
            const cm = o.material.clone()
            clonedMaterials.push(cm)
            o.material = cm
          }
          o.castShadow = o.receiveShadow = true
        }
      })
      dispose = () => {
        mixer.stopAllAction()
        mixer.uncacheRoot(meshRoot)
        harness.dispose()
        clonedMaterials.forEach(m => m.dispose())
        meshRoot.traverse(o => { if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose() })
      }
      if (!active) { dispose(); return }
      meshRoot.scale.setScalar(0.003)
      rigGroup.add(meshRoot, harness.body, harness.head)
      const torsoBone = meshRoot.getObjectByName('Torso')
      const headBone = meshRoot.getObjectByName('Head')
      mixer.clipAction(model.animations[0]).play()
      mixer.update(0)
      rigGroup.updateMatrixWorld(true)
      const invRig = new THREE.Matrix4()
      const tmpPos = new THREE.Vector3()
      const restTorso = torsoBone ? torsoBone.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0.043, 1.115, -0.091)
      const syncHarness = () => {
        rigGroup.updateWorldMatrix(true, false)
        invRig.copy(rigGroup.matrixWorld).invert()
        meshRoot.updateMatrixWorld(true)
        if (torsoBone) {
          torsoBone.getWorldPosition(tmpPos).applyMatrix4(invRig)
          harness.body.position.set(0, tmpPos.y - restTorso.y, (tmpPos.z - restTorso.z) * 0.5)
        }
        if (headBone) {
          headBone.getWorldPosition(tmpPos).applyMatrix4(invRig)
          harness.head.position.copy(tmpPos)
        } else {
          harness.head.position.set(0.019, 1.785, 0.976)
        }
      }
      syncHarness()
      rigGroup.visible = false
      setHorse({ root: rigGroup, mixer, syncHarness })
    }).catch(error => console.warn('Detailed cart horse unavailable', error))
    return () => { active = false; dispose?.(); setHorse(null) }
  }, [mode])

  const [citizenAssets, setCitizenAssets] = useState(false)
  useEffect(() => {
    if (mode !== 'walk' || citizenAssets) return
    let cancelled = false
    void loadCitizenAssets().then(() => { if (!cancelled) setCitizenAssets(true) })
      .catch(error => console.warn('Detailed citizens unavailable; keeping the instanced crowd.', error))
    return () => { cancelled = true }
  }, [mode, citizenAssets])

  const scene = useThree(s => s.scene)
  const probe = sharedWorldProbe
  const groundCache = useRef(new Float64Array(0))
  const probeBudget = useRef(0)
  const era = useApp((s) => s.era)
  const showGrid = useApp((s) => s.showGrid)
  const year = useApp((s) => s.year)
  const character = useApp((s) => s.character)
  const variant: Variant = mode === 'walk' || mode === 'plan' ? variantFor(year) : 'roman'
  const crowdEpoch = mode === 'walk' ? spawnEpoch(year) : ''
  const visible = era === 'ancient' && (mode === 'walk' || (mode === 'explore' && showGrid) || mode === 'tour')

  useEffect(() => {
    const epoch = `${scene.uuid}:${year}:${showGrid}`
    const timer = window.setTimeout(() => {
      probe.refreshIfNeeded(scene, epoch)
      groundCache.current.fill(NaN)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [scene, probe, year, showGrid, mode])

  const surfaceY = (x: number, z: number, id: number) => {
    const terrainY = terrain.heightAt(x, z)
    const cache = groundCache.current
    const base = id * 3
    if (base + 2 >= cache.length) return terrainY + 0.015
    const cx = cache[base], cz = cache[base + 1], cy = cache[base + 2]
    const dx = x - cx, dz = z - cz
    if (Number.isNaN(cy) || dx * dx + dz * dz > 0.35 * 0.35) {
      if (probeBudget.current <= 0) return (Number.isNaN(cy) ? terrainY : Math.max(terrainY, cy)) + 0.015
      probeBudget.current--
      const y = Math.max(terrainY, probe.ground(x, z, terrainY + 2.5))
      cache[base] = x; cache[base + 1] = z; cache[base + 2] = y
      return y + 0.015
    }
    return Math.max(terrainY, cy) + 0.015
  }

  const sim = useMemo(() => {
    const F = gridFrame(terrain)
    const [originX, originZ] = F.P(0, 0)
    const ux = F.u[0], uz = F.u[1], vx = F.v[0], vz = F.v[1]
    const rand = rng(85 + variant.length)
    const npcs: Npc[] = []
    const femaleFlags: number[] = []
    const yr = mode === 'walk' || mode === 'plan' ? year : 200
    const spawnYr = mode === 'walk' || mode === 'plan' ? year : null
    const stands = (id: string) => { const l = LANDMARKS.find((x) => x.id === id); return !!l && yr >= l.built && (l.until === undefined || yr <= l.until) }
    const at = (id: string) => { const l = LANDMARKS.find((x) => x.id === id)!; return terrain.toLocal(l.lat, l.lon) }
    const pickAge = (role: CitizenRole): AgeGroup => {
      const r = rand()
      if (role === 'soldier') return r < 0.25 ? 'young' : 'adult'
      if (role === 'porter') return r < 0.14 ? 'adolescent' : r < 0.42 ? 'young' : r < 0.9 ? 'adult' : 'older'
      if (role === 'merchant' || role === 'priest') return r < 0.12 ? 'young' : r < 0.62 ? 'adult' : 'older'
      // Residents and pilgrims include children and adolescents alongside adults and elders
      return r < 0.09 ? 'child' : r < 0.18 ? 'adolescent' : r < 0.34 ? 'young' : r < 0.78 ? 'adult' : 'older'
    }
    const pushNpc = (entry: Omit<Npc, 'age' | 'cut' | 'fabric' | 'stature' | 'build' | 'propIdx'> & { prop?: PropKind }, forceGender?: 0 | 1) => {
      const isFem = forceGender ?? (entry.role === 'soldier' ? 0 : entry.role === 'porter' ? (rand() < 0.15 ? 1 : 0) : rand() < 0.46 ? 1 : 0)
      const age = pickAge(entry.role)
      const { stature, build } = roleBodyMetrics(entry.role, age, !!isFem, rand)
      const cut: GarmentCut = age === 'child' || entry.role === 'porter' || entry.role === 'merchant' || entry.role === 'soldier' ? 'work' : 'full'
      const fabric: FabricKind = entry.role === 'porter' || age === 'child' ? 'linen'
        : entry.role === 'merchant' ? (rand() < 0.6 ? 'linen' : 'wool')
        : variant === 'roman' ? (rand() < 0.55 ? 'linen' : 'wool') : (rand() < 0.35 ? 'linen' : 'wool')
      const propIdx = age === 'child' ? -1 : entry.prop ? PROP_INDEX[entry.prop] : -1
      femaleFlags.push(isFem)
      npcs.push({ ...entry, age, cut, fabric, stature, build, propIdx })
    }

    // Curated, lower-clutter crowd: fewer generic wanderers so every nearby citizen can stay full rigged quality
    const pop = variant === 'roman' ? 1 : 0.72
    const nWalk = Math.round(44 * pop), nCross = Math.round(14 * pop)
    for (let i = 0; i < nWalk; i++) {
      const lane = [-10.0, -6, -2.2, 2.2, 6, 10.0][Math.floor(rand() * 6)]
      let uu = 0
      for (let k = 0; k < 8; k++) { uu = rand() < 0.52 ? 14 + rand() * 270 : 20 + rand() * (F.L - 40); if (!solidMonumentAt(...F.P(uu, lane), spawnYr, 1)) break }
      const roll = rand()
      let role: CitizenRole = 'resident'
      let prop: PropKind | undefined
      let pose: number = POSE.walk
      let speed = 1.0 + rand() * 0.42
      if (roll < 0.22) {
        role = 'porter'
        prop = rand() < 0.62 ? 'amphora' : 'basket'
        pose = prop === 'amphora' ? POSE.carry : POSE.walk
        speed = 0.88 + rand() * 0.26
      } else if (roll < 0.30) {
        role = 'soldier'
        prop = 'staff'
        speed = 1.02 + rand() * 0.20
      } else if (roll < (variant === 'byzantine' ? 0.50 : 0.38)) {
        role = 'pilgrim'
        prop = 'staff'
        speed = 0.85 + rand() * 0.28
      } else if (roll < 0.54) {
        role = 'merchant'
        if (rand() < 0.45) prop = 'scroll'
      }
      const dir = rand() < 0.5 ? 1 : -1
      const vPos = lane + (rand() - 0.5) * 0.5
      pushNpc({ kind: 'walker', role, prop, u: uu, v: vPos, dir, speed, min: 12, max: F.L - 12, side: 0, phase: rand() * 6.28, pose, look: 0 })
      // Family strolling scenario: pair ~1 in 6 adult residents with a child walking right beside them
      if (role === 'resident' && i % 6 === 0) {
        const childBuild = 0.75 + rand() * 0.05
        const childStature = 0.67 + rand() * 0.06
        femaleFlags.push(rand() < 0.5 ? 1 : 0)
        npcs.push({
          kind: 'walker', role: 'resident', age: 'child', cut: 'work', fabric: 'linen',
          stature: childStature, build: childBuild, propIdx: -1,
          u: uu - dir * 0.45, v: vPos + (vPos > 0 ? -0.95 : 0.95), dir, speed,
          min: 12, max: F.L - 12, side: 0, phase: rand() * 6.28, pose: POSE.walk, look: 0,
        })
      }
    }

    for (let i = 0; i < nCross; i++) {
      const k = 3 + Math.floor(rand() * (F.L / GRID.pitchU - 6)), side = rand() < 0.5 ? 1 : -1
      const isPorter = rand() < 0.22
      const prop: PropKind | undefined = isPorter ? (rand() < 0.5 ? 'basket' : 'amphora') : undefined
      pushNpc({
        kind: 'cross', role: isPorter ? 'porter' : 'resident', prop,
        u: k * GRID.pitchU + (rand() - 0.5) * 1.2, v: side * (14 + rand() * 180),
        dir: rand() < 0.5 ? 1 : -1, speed: 0.9 + rand() * 0.4,
        min: side > 0 ? 14 : -200, max: side > 0 ? 200 : -14, side: 0, phase: rand() * 6.28,
        pose: prop === 'amphora' ? POSE.carry : POSE.walk, look: 0,
      })
    }

    // Stationed gate & sanctuary soldiers on watch
    const addGateGuards = (gateId: string, offsets: Array<[number, number]>) => {
      const l = LANDMARKS.find(x => x.id === gateId)
      if (!l || !stands(gateId)) return
      const [gx, gz] = terrain.toLocal(l.lat, l.lon)
      const gyaw = THREE.MathUtils.degToRad(l.rotation ?? 0)
      for (const [lx, lz] of offsets) {
        const x = gx + lx * Math.cos(gyaw) + lz * Math.sin(gyaw)
        const z = gz - lx * Math.sin(gyaw) + lz * Math.cos(gyaw)
        const face = gyaw + (lz < 0 ? Math.PI : 0)
        pushNpc({ kind: 'guard', role: 'soldier', prop: 'staff', u: 0, v: 0, dir: 1, speed: 0, min: 0, max: 0, x, z, face, side: 0, phase: rand() * 6.28, pose: POSE.idle, look: 0 }, 0)
      }
    }
    if (variant === 'roman') {
      addGateGuards('frontinus-gate', [[-2.35, -2.4], [2.35, -2.4], [-6.45, 2.4], [6.45, 2.4]])
    } else if (variant === 'byzantine') {
      addGateGuards('byzantine-gate-n', [[-2.6, -2.4], [2.6, -2.4]])
      addGateGuards('south-gate', [[-2.6, 2.4], [2.6, 2.4]])
    } else {
      const [px, pz] = at('ploutonion')
      for (const s of [-1, 1]) {
        pushNpc({ kind: 'guard', role: 'soldier', prop: 'staff', u: 0, v: 0, dir: 1, speed: 0, min: 0, max: 0, x: px + s * 6.5, z: pz + 11, face: 0, side: 0, phase: rand() * 6.28, pose: POSE.idle, look: 0 }, 0)
      }
    }

    // Chatting resident & merchant groups: agora edge, nymphaeum, theatre approach
    const groupAt = (cx: number, cz: number, n: number, merchantBias = 0.25) => {
      for (let g = 0; g < n; g++) {
        let gx = 0, gz = 0, ok = false
        for (let k = 0; k < 12 && !ok; k++) { gx = cx + (rand() - 0.5) * 60; gz = cz + (rand() - 0.5) * 60; ok = !solidMonumentAt(gx, gz, spawnYr, 2) }
        if (!ok) continue
        const size = 2 + Math.floor(rand() * 3)
        for (let m = 0; m < size; m++) {
          const a = (m / size) * Math.PI * 2 + rand() * 0.4, r = 0.9 + rand() * 0.3
          const x = gx + Math.cos(a) * r, z = gz + Math.sin(a) * r
          const isMerch = rand() < merchantBias
          pushNpc({
            kind: 'idle', role: isMerch ? 'merchant' : 'resident',
            prop: isMerch && rand() < 0.5 ? 'scroll' : undefined,
            u: 0, v: 0, dir: 1, speed: 0, min: 0, max: 0, x, z,
            face: Math.atan2(gx - x, gz - z), side: 0, phase: rand() * 6.28,
            pose: rand() < 0.5 ? POSE.talk : POSE.idle, look: 0,
          })
        }
      }
    }
    if (stands('agora')) { const [x, z] = at('agora'); groupAt(x, z, variant === 'roman' ? 4 : 3, 0.45) }
    if (stands('tritons')) { const [x, z] = at('tritons'); groupAt(x, z, 2, 0.15) }
    if (stands('theatre')) { const [x, z] = at('theatre'); groupAt(x - 40, z, 2, 0.15) }

    // Merchants behind the portico stalls + bargaining customers facing them across the counter
    const stalls = stallSpots(F.L)
    stalls.forEach((st, idx) => {
      if (idx % 2 === 1 && st.u > 220) return // keep stalls lively near Frontinus Gate & Plateia without overpopulating far south
      const [x, z] = F.P(st.u, st.side * 10.6)
      const merchFace = F.yawV + (st.side > 0 ? Math.PI : 0)
      pushNpc({
        kind: 'merchant', role: 'merchant', prop: idx % 3 === 0 ? 'scroll' : undefined,
        u: 0, v: 0, dir: 1, speed: 0, min: 0, max: 0, x, z,
        face: merchFace, side: 0, phase: rand() * 6.28, pose: POSE.talk, look: 0,
      })
      // Pair every other stall with a customer bargaining / inspecting wares across the counter
      if (idx % 2 === 0) {
        const [cx, cz] = F.P(st.u + 0.15, st.side * 8.6)
        pushNpc({
          kind: 'idle', role: 'resident',
          u: 0, v: 0, dir: 1, speed: 0, min: 0, max: 0, x: cx, z: cz,
          face: merchFace + Math.PI, side: 0, phase: rand() * 6.28, pose: POSE.talk, look: 0,
        })
      }
    })

    // Priests / monks praying at the sanctuaries that stand in this year
    const pray = (id: string, n: number, r = 7) => {
      if (!stands(id)) return
      const [cx, cz] = at(id)
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r
        pushNpc({ kind: 'priest', role: 'priest', u: 0, v: 0, dir: 1, speed: 0, min: 0, max: 0, x, z, face: Math.atan2(cx - x, cz - z), side: 0, phase: rand() * 6.28, pose: POSE.pray, look: 0 })
      }
    }
    pray('apollo', 3, 14); pray('ploutonion', 3, 9); pray('martyrium', 4, 22); pray('cathedral', 3, 16); pray('philip-church', 3, 14)

    // Era-specific pilgrim processions
    if (variant === 'byzantine' && stands('martyrium')) {
      const [ax, az] = at('philip-church'), [bx, bz] = at('martyrium')
      for (let i = 0; i < 12; i++) {
        pushNpc({
          kind: 'pilgrim', role: 'pilgrim', prop: 'staff',
          u: rand(), v: (rand() - 0.5) * 3, dir: rand() < 0.5 ? 1 : -1,
          speed: 0.72 + rand() * 0.28, min: 0, max: 1, x: ax, z: az, bx, bz,
          face: Math.atan2(bx - ax, bz - az), side: Math.hypot(bx - ax, bz - az),
          phase: rand() * 6.28, pose: POSE.walk, look: 0,
        })
      }
    } else if (stands('ploutonion')) {
      const [ax, az] = at('antique-pool'), [bx, bz] = at('ploutonion')
      for (let i = 0; i < 8; i++) {
        pushNpc({
          kind: 'pilgrim', role: 'pilgrim', prop: 'staff',
          u: rand(), v: (rand() - 0.5) * 2.5, dir: rand() < 0.5 ? 1 : -1,
          speed: 0.75 + rand() * 0.25, min: 0, max: 1, x: ax, z: az, bx, bz,
          face: Math.atan2(bx - ax, bz - az), side: Math.hypot(bx - ax, bz - az),
          phase: rand() * 6.28, pose: POSE.walk, look: 0,
        })
      }
    }

    // Shared material & near/far LOD instanced meshes
    const pal = ERA_PALETTES[variant]
    const pMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.88 })
    patchCrowdMaterial(pMat, 'person')

    const nearCap = Math.min(NEAR_CAP, npcs.length + 1)
    const nearGeo = createPersonGeometry(variant, 'near')
    const nearAttr = createCrowdAttributes(nearCap)
    nearGeo.setAttribute('iAnim', nearAttr.anim)
    nearGeo.setAttribute('iTint0', nearAttr.tint0)
    nearGeo.setAttribute('iTint1', nearAttr.tint1)
    nearGeo.setAttribute('iTint2', nearAttr.tint2)
    nearGeo.setAttribute('iStyle', nearAttr.style)
    nearGeo.setAttribute('iPose', nearAttr.pose)
    const nearPeople = new THREE.InstancedMesh(nearGeo, pMat, nearCap)
    nearPeople.count = 0

    const farCap = Math.max(1, npcs.length)
    const farGeo = createPersonGeometry(variant, 'far')
    const farAttr = createCrowdAttributes(farCap)
    farGeo.setAttribute('iAnim', farAttr.anim)
    farGeo.setAttribute('iTint0', farAttr.tint0)
    farGeo.setAttribute('iTint1', farAttr.tint1)
    farGeo.setAttribute('iTint2', farAttr.tint2)
    farGeo.setAttribute('iStyle', farAttr.style)
    farGeo.setAttribute('iPose', farAttr.pose)
    const farPeople = new THREE.InstancedMesh(farGeo, pMat, farCap)
    farPeople.count = 0

    const c = new THREE.Color(), hc = new THREE.Color()
    const female = new Uint8Array(femaleFlags)
    const totalSlots = npcs.length + 1
    const npcTint0 = new Float32Array(totalSlots * 3)
    const npcTint1 = new Float32Array(totalSlots * 3)
    const npcTint2 = new Float32Array(totalSlots * 3)
    const npcStyle = new Float32Array(totalSlots * 4)

    const soldierCloths: Record<Variant, string> = { greek: '#a44936', roman: '#963b2d', byzantine: '#7b352f' }
    const soldierAccents: Record<Variant, string> = { greek: '#b78d4a', roman: '#a88342', byzantine: '#9e8858' }
    const porterCloths: Record<Variant, string> = { greek: '#cbbda2', roman: '#c6b79b', byzantine: '#b8a88b' }
    const pilgrimCloths: Record<Variant, string> = { greek: '#bfb39a', roman: '#a99a80', byzantine: '#636d7c' }

    npcs.forEach((n, i) => {
      const isFem = female[i] === 1
      const clothHex =
        n.role === 'priest' ? (variant === 'byzantine' ? '#2e2620' : '#efe8dc')
        : n.role === 'soldier' ? soldierCloths[variant]
        : n.role === 'porter' ? porterCloths[variant]
        : n.role === 'pilgrim' ? pilgrimCloths[variant]
        : pal.cloth[Math.floor(rand() * pal.cloth.length)]
      const accentHex =
        n.role === 'soldier' ? soldierAccents[variant]
        : n.role === 'porter' ? '#6c4d35'
        : n.role === 'priest' && variant === 'byzantine' ? '#5e4936'
        : pal.accent[Math.floor(rand() * pal.accent.length)]
      c.set(clothHex); npcTint0[i * 3] = c.r; npcTint0[i * 3 + 1] = c.g; npcTint0[i * 3 + 2] = c.b
      c.set(SKIN_TONES[Math.floor(rand() * SKIN_TONES.length)]); npcTint1[i * 3] = c.r; npcTint1[i * 3 + 1] = c.g; npcTint1[i * 3 + 2] = c.b
      c.set(accentHex); npcTint2[i * 3] = c.r; npcTint2[i * 3 + 1] = c.g; npcTint2[i * 3 + 2] = c.b

      if (n.age === 'older') hc.set(rand() < 0.5 ? '#9e978d' : '#b8b1a6')
      else hc.set(pal.hair[Math.floor(rand() * pal.hair.length)])
      const isYouth = n.age === 'child' || n.age === 'adolescent'
      const veiled = !isYouth && ((isFem && (variant === 'byzantine' || n.role === 'priest' || rand() < 0.35)) || (n.role === 'priest' && variant === 'byzantine'))
      const hairCode = veiled ? HAIR.veiled : isFem ? HAIR.bun : (n.age === 'older' && rand() < 0.28 ? HAIR.bald : rand() < 0.45 ? HAIR.curly : HAIR.short)
      const bearded = !isFem && !isYouth && n.age !== 'young' && (variant !== 'roman' || n.role !== 'soldier' ? rand() < 0.58 : rand() < 0.25)
      npcStyle[i * 4] = hc.r; npcStyle[i * 4 + 1] = hc.g; npcStyle[i * 4 + 2] = hc.b; npcStyle[i * 4 + 3] = hairCode + (bearded ? 5 : 0)
    })

    const ch = CHARACTERS.find((x) => x.id === character) ?? CHARACTERS[2]
    const avatarRole: CitizenRole =
      ch.id === 'theano' || ch.id === 'philippos' ? 'priest'
      : ch.id === 'eudokia' ? 'pilgrim'
      : ch.id === 'nikias' || ch.id === 'aurelia' ? 'merchant' : 'resident'
    const av = npcs.length
    c.set(ch.colors.body); npcTint0[av * 3] = c.r; npcTint0[av * 3 + 1] = c.g; npcTint0[av * 3 + 2] = c.b
    c.set(SKIN_TONES[2]); npcTint1[av * 3] = c.r; npcTint1[av * 3 + 1] = c.g; npcTint1[av * 3 + 2] = c.b
    c.set(ch.colors.accent); npcTint2[av * 3] = c.r; npcTint2[av * 3 + 1] = c.g; npcTint2[av * 3 + 2] = c.b
    npcStyle[av * 4] = 0.16; npcStyle[av * 4 + 1] = 0.11; npcStyle[av * 4 + 2] = 0.08; npcStyle[av * 4 + 3] = ch.gender === 'f' ? HAIR.bun : HAIR.short

    const avatar = citizenAssets ? createRiggedCitizen(variant, { cloth: new THREE.Color(ch.colors.body), skin: new THREE.Color(SKIN_TONES[2]), accent: new THREE.Color(ch.colors.accent) }, ch.gender) : null
    if (avatar) {
      avatar.root.visible = false
      avatar.configure({
        role: avatarRole,
        cut: ['nikias', 'aurelia'].includes(ch.id) ? 'work' : 'full',
        fabric: ch.id === 'aurelia' || ch.id === 'theano' ? 'linen' : 'wool',
        age: 'adult',
      })
    }
    const poolSize = window.matchMedia('(pointer: coarse)').matches ? 8 : 18
    const closePeople = Array.from({ length: citizenAssets ? poolSize : 0 }, (_, slotIndex) => {
      const gender = slotIndex % 2 ? 'f' as const : 'm' as const
      const citizen = createRiggedCitizen(variant, { cloth: new THREE.Color(pal.cloth[0]), skin: new THREE.Color(SKIN_TONES[2]), accent: new THREE.Color(pal.accent[0]) }, gender)
      citizen.root.visible = false
      return { citizen, id: -1, gender }
    })

    // Shared instanced held props (dynamically compacted to nearby carriers each frame)
    const propKinds: PropKind[] = ['amphora', 'basket', 'staff', 'scroll']
    const propCarrierTotals = [0, 0, 0, 0]
    for (const n of npcs) if (n.propIdx >= 0) propCarrierTotals[n.propIdx]++
    const propTints: Record<PropKind, string> = { amphora: '#b86843', basket: '#a68552', staff: '#6d5034', scroll: '#e6dcc5' }
    const propMeshes = propKinds.map((kind, idx) => {
      const cap = Math.max(1, propCarrierTotals[idx])
      const geo = createHeldPropGeometry(kind)
      const attr = createCrowdAttributes(cap)
      geo.setAttribute('iAnim', attr.anim)
      geo.setAttribute('iTint0', attr.tint0)
      geo.setAttribute('iTint1', attr.tint1)
      geo.setAttribute('iTint2', attr.tint2)
      geo.setAttribute('iPose', attr.pose)
      c.set(propTints[kind])
      for (let i = 0; i < cap; i++) {
        attr.tint0.setXYZ(i, c.r, c.g, c.b)
        attr.tint1.setXYZ(i, c.r, c.g, c.b)
        attr.tint2.setXYZ(i, c.r, c.g, c.b)
      }
      const mesh = new THREE.InstancedMesh(geo, pMat, cap)
      mesh.count = 0
      mesh.castShadow = false
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      return { kind, hasCarriers: propCarrierTotals[idx] > 0, mesh, attr, cap }
    })

    const nCarts = variant === 'roman' ? 16 : 9
    const carts = Array.from({ length: nCarts }, (_, i) => ({ distance: 10 + rand() * (F.L - 80) + (i % 2 ? 0 : F.L - 60 + Math.PI * 2.4), speed: 1.2 + rand() * 0.3, phase: rand() * 6.28 }))
    const hGeo = createHorseGeometry(), hAttr = createCrowdAttributes(nCarts)
    hGeo.setAttribute('iAnim', hAttr.anim); hGeo.setAttribute('iTint0', hAttr.tint0); hGeo.setAttribute('iTint1', hAttr.tint1); hGeo.setAttribute('iTint2', hAttr.tint2)
    const cGeo = createCartGeometry(), cAttr = createCrowdAttributes(nCarts)
    cGeo.setAttribute('iAnim', cAttr.anim); cGeo.setAttribute('iTint0', cAttr.tint0); cGeo.setAttribute('iTint1', cAttr.tint1); cGeo.setAttribute('iTint2', cAttr.tint2)
    const hMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }); patchCrowdMaterial(hMat, 'horse')
    const cMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }); patchCrowdMaterial(cMat, 'cart')
    const coats = ['#6b4a32', '#3b2a1e', '#8a6a4a', '#d8c6a8', '#5a4a40']
    const horseTints = new Float32Array(nCarts * 3)
    carts.forEach((_, i) => {
      c.set(coats[i % coats.length]); horseTints[i * 3] = c.r; horseTints[i * 3 + 1] = c.g; horseTints[i * 3 + 2] = c.b
      c.set('#2a1d15'); hAttr.tint1.setXYZ(i, c.r, c.g, c.b)
      c.set('#5c3322'); hAttr.tint2.setXYZ(i, c.r, c.g, c.b)
      c.set('#8a6a4a'); cAttr.tint0.setXYZ(i, c.r, c.g, c.b)
      c.set('#b89b72'); cAttr.tint1.setXYZ(i, c.r, c.g, c.b)
      cAttr.tint2.setXYZ(i, 0.36, 0.24, 0.18)
    })
    const horses = new THREE.InstancedMesh(hGeo, hMat, nCarts)
    const cartMesh = new THREE.InstancedMesh(cGeo, cMat, nCarts)
    for (const m of [nearPeople, horses, cartMesh]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage) }
    farPeople.castShadow = false; farPeople.receiveShadow = true; farPeople.frustumCulled = false; farPeople.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    const depthMats = ([['person', nearPeople], ['horse', horses], ['cart', cartMesh]] as const).map(([kind, mesh]) => {
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
      patchCrowdMaterial(depth, kind)
      mesh.customDepthMaterial = depth
      return depth
    })

    const cacheEntities = npcs.length + 1 + nCarts * 2
    groundCache.current = new Float64Array(cacheEntities * 3).fill(NaN)
    NPC_STATE.x = new Float32Array(npcs.length); NPC_STATE.z = new Float32Array(npcs.length); NPC_STATE.count = npcs.length; NPC_STATE.female = female
    NPC_STATE.guard = Uint8Array.from(npcs, (n) => (n.kind === 'guard' ? 1 : 0))

    return {
      F, originX, originZ, ux, uz, vx, vz,
      npcs, carts, nearPeople, farPeople, horses, cartMesh, propMeshes,
      nearAttr, farAttr, hAttr, cAttr,
      npcTint0, npcTint1, npcTint2, npcStyle, horseTints,
      avatar, closePeople, mats: [pMat, hMat, cMat, ...depthMats],
      bestIds: new Int32Array(Math.max(poolSize, 18)), bestD2: new Float64Array(Math.max(poolSize, 18)),
      // Which source NPC/cart last wrote each instance slot: static tints are rewritten and uploaded only when it changes.
      nearSrc: new Int32Array(nearCap).fill(-1), farSrc: new Int32Array(farCap).fill(-1), horseSrc: new Int32Array(nCarts).fill(-1),
    }
    // year only matters through crowdEpoch (variant + standing landmarks/footprints)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrain, variant, character, citizenAssets, crowdEpoch])

  useEffect(() => () => {
    sim.nearPeople.geometry.dispose(); sim.nearPeople.dispose()
    sim.farPeople.geometry.dispose(); sim.farPeople.dispose()
    sim.horses.geometry.dispose(); sim.horses.dispose()
    sim.cartMesh.geometry.dispose(); sim.cartMesh.dispose()
    sim.propMeshes.forEach(pm => { pm.mesh.geometry.dispose(); pm.mesh.dispose() })
    sim.mats.forEach((m) => m.dispose())
    sim.avatar?.dispose(); sim.closePeople.forEach(slot => slot.citizen.dispose())
  }, [sim])

  const footGround = (x: number, z: number) => {
    const y = terrain.heightAt(x, z)
    return Math.max(y, probe.ground(x, z, y + 2.5))
  }
  // Cheap foot support for rigs beyond FOOT_PROBE_R2: terrain, or the cached support under the rig's root.
  const farFoot = useRef(0)
  const footGroundFar = (x: number, z: number) => Math.max(terrain.heightAt(x, z), farFoot.current)

  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const qPitch = useMemo(() => new THREE.Quaternion(), [])
  const xAxis = useMemo(() => new THREE.Vector3(1, 0, 0), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const tmpCloth = useMemo(() => new THREE.Color(), [])
  const tmpSkin = useMemo(() => new THREE.Color(), [])
  const tmpAccent = useMemo(() => new THREE.Color(), [])
  const propCounts = useMemo(() => new Int32Array(4), [])
  const frustum = useMemo(() => new THREE.Frustum(), [])
  const projScreen = useMemo(() => new THREE.Matrix4(), [])
  const rigSphere = useMemo(() => new THREE.Sphere(), [])
  const leadPose = useMemo<CartPose>(() => ({ u: 0, v: 0, heading: 0 }), [])
  const axlePose = useMemo<CartPose>(() => ({ u: 0, v: 0, heading: 0 }), [])
  const clock = useRef(0)
  const dirty = useRef({ near: false, far: false })

  /** Writes one LOD instance; tint/style only when the slot changes owner (they are static per NPC). */
  const writePersonSlot = useMemo(() => {
    const { npcTint0, npcTint1, npcTint2, npcStyle, nearPeople, nearSrc, farSrc } = sim
    return (
      mesh: THREE.InstancedMesh, attr: ReturnType<typeof createCrowdAttributes>,
      slot: number, srcIdx: number, phase: number, gait: number, activePose: number, clampedLook: number,
    ) => {
      mesh.setMatrixAt(slot, m4)
      const near = mesh === nearPeople
      const owners = near ? nearSrc : farSrc
      if (owners[slot] !== srcIdx) {
        owners[slot] = srcIdx
        const t3 = srcIdx * 3, s4 = srcIdx * 4
        attr.tint0.setXYZ(slot, npcTint0[t3], npcTint0[t3 + 1], npcTint0[t3 + 2])
        attr.tint1.setXYZ(slot, npcTint1[t3], npcTint1[t3 + 1], npcTint1[t3 + 2])
        attr.tint2.setXYZ(slot, npcTint2[t3], npcTint2[t3 + 1], npcTint2[t3 + 2])
        attr.style.setXYZW(slot, npcStyle[s4], npcStyle[s4 + 1], npcStyle[s4 + 2], npcStyle[s4 + 3])
        if (near) dirty.current.near = true; else dirty.current.far = true
      }
      attr.anim.setXYZW(slot, phase, gait, activePose, clampedLook)
      attr.pose.setXY(slot, activePose, 1)
    }
  }, [sim, m4])

  useFrame(({ camera }, rawDt) => {
    if (!visible) return
    if (mode === 'walk' && walkInputBlocked(useApp.getState())) return
    const dt = Math.min(rawDt, 0.1); clock.current += dt
    probeBudget.current = 64
    const simYear = mode === 'walk' ? year : null
    const {
      F, originX, originZ, ux, uz, vx, vz,
      npcs, carts, nearPeople, farPeople, horses, cartMesh, propMeshes,
      nearAttr, farAttr, hAttr, cAttr,
      npcTint0, npcTint1, npcTint2, horseTints,
      mats, bestIds, bestD2, horseSrc,
    } = sim
    for (const m of mats) (m.userData.uTime as { value: number }).value = clock.current
    const walking = mode === 'walk'
    const px = walk.x, pz = walk.z
    const refX = walking ? px : camera.position.x
    const refZ = walking ? pz : camera.position.z
    const nowMs = performance.now()
    const wavingNow = walking && nowMs < walk.waveUntil

    // Zero-alloc top-K nearest selection for the close skeletal citizen pool (wide 52 m radius eliminates up-close shape popping)
    let candCount = 0
    const poolLen = sim.closePeople.length
    if (walking && poolLen > 0) {
      bestD2.fill(Infinity)
      for (let i = 0; i < npcs.length; i++) {
        const dx = NPC_STATE.x[i] - px, dz = NPC_STATE.z[i] - pz
        const d2 = dx * dx + dz * dz
        if (d2 >= 52 * 52) continue
        if (candCount < poolLen || d2 < bestD2[poolLen - 1]) {
          let posIdx = Math.min(candCount, poolLen - 1)
          while (posIdx > 0 && d2 < bestD2[posIdx - 1]) {
            bestD2[posIdx] = bestD2[posIdx - 1]
            bestIds[posIdx] = bestIds[posIdx - 1]
            posIdx--
          }
          bestD2[posIdx] = d2
          bestIds[posIdx] = i
          if (candCount < poolLen) candCount++
        }
      }
    }
    for (let s = 0; s < poolLen; s++) {
      const slot = sim.closePeople[s]
      let keep = false
      for (let k = 0; k < candCount; k++) if (bestIds[k] === slot.id) { keep = true; break }
      if (!keep) { slot.id = -1; slot.citizen.root.visible = false }
    }
    for (let k = 0; k < candCount; k++) {
      const id = bestIds[k]
      let already = false
      for (let s = 0; s < poolLen; s++) if (sim.closePeople[s].id === id) { already = true; break }
      if (already) continue
      const wantGender = NPC_STATE.female[id] ? 'f' : 'm'
      for (let s = 0; s < poolLen; s++) {
        const slot = sim.closePeople[s]
        if (slot.id === -1 && slot.gender === wantGender) {
          const npc = npcs[id]
          slot.id = id
          slot.citizen.reset()
          slot.citizen.configure({ role: npc.role, cut: npc.cut, fabric: npc.fabric, age: npc.age })
          slot.citizen.setPalette({
            cloth: tmpCloth.setRGB(npcTint0[id * 3], npcTint0[id * 3 + 1], npcTint0[id * 3 + 2]),
            skin: tmpSkin.setRGB(npcTint1[id * 3], npcTint1[id * 3 + 1], npcTint1[id * 3 + 2]),
            accent: tmpAccent.setRGB(npcTint2[id * 3], npcTint2[id * 3 + 1], npcTint2[id * 3 + 2]),
          })
          break
        }
      }
    }

    let nearCount = 0, farCount = 0
    propCounts.fill(0)

    // Frustum from the last rendered camera; generous per-rig spheres absorb the one-frame lag.
    projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(projScreen)
    const camX = camera.position.x, camY = camera.position.y, camZ = camera.position.z

    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i]
      let x: number, z: number, yaw: number, gait = 0
      if (n.kind === 'walker' || n.kind === 'cross') {
        if (n.kind === 'cross') { n.v += n.dir * n.speed * dt; if (n.v > n.max || n.v < n.min) n.dir *= -1 }
        else { n.u += n.dir * n.speed * dt; if (n.u > n.max || n.u < n.min) n.dir *= -1 }
        const ahead = n.dir * 0.8
        const au = n.kind === 'cross' ? n.u : n.u + ahead
        const av = n.kind === 'cross' ? n.v + ahead + n.side : n.v + n.side
        const ax = originX + ux * au + vx * av, az = originZ + uz * au + vz * av
        if (solidMonumentAt(ax, az, simYear)) n.dir *= -1
        const pv = n.v + n.side
        x = originX + ux * n.u + vx * pv
        z = originZ + uz * n.u + vz * pv
        if (walking) {
          const dxp = x - px, dzp = z - pz
          const d2p = dxp * dxp + dzp * dzp
          const want = d2p < 1.6 * 1.6 ? ((dxp * vx + dzp * vz) >= 0 ? 1.4 : -1.4) : 0
          n.side += (want - n.side) * Math.min(1, dt * 3)
        }
        yaw = (n.kind === 'cross' ? F.yawV : F.yawU) + (n.dir > 0 ? 0 : Math.PI)
        gait = 0.5
      } else if (n.kind === 'pilgrim') {
        n.u += n.dir * (n.speed / Math.max(1, n.side)) * dt
        if (n.u > 1 || n.u < 0) n.dir *= -1
        x = n.x! + (n.bx! - n.x!) * n.u + Math.cos(n.face!) * n.v
        z = n.z! + (n.bz! - n.z!) * n.u - Math.sin(n.face!) * n.v
        yaw = n.face! + (n.dir > 0 ? 0 : Math.PI); gait = 0.45
      } else {
        x = n.x!; z = n.z!; yaw = n.face!
      }
      NPC_STATE.x[i] = x; NPC_STATE.z[i] = z

      const rdx = x - refX, rdz = z - refZ
      const dist2 = rdx * rdx + rdz * rdz
      if (walking && dist2 > WALK_MAX_R2) continue

      let look = 0
      let replying = false
      if (walking && dist2 < 25) {
        const dx = px - x, dz = pz - z
        const angle = Math.atan2(dx, dz) - yaw
        look = THREE.MathUtils.clamp(Math.atan2(Math.sin(angle), Math.cos(angle)), -1, 1)
        replying = wavingNow
      }
      n.look += (look - n.look) * Math.min(1, dt * 4)
      const activePose = replying ? POSE.wave : n.pose
      const clampedLook = THREE.MathUtils.clamp(n.look, -1, 1)

      pos.set(x, surfaceY(x, z, i), z)
      q.setFromAxisAngle(up, yaw)
      one.set(n.build, n.stature, n.build)

      let handledByClose = false
      for (let s = 0; s < poolLen; s++) {
        const slot = sim.closePeople[s]
        if (slot.id === i) {
          slot.citizen.root.visible = true
          slot.citizen.root.position.copy(pos); slot.citizen.root.quaternion.copy(q); slot.citizen.root.scale.copy(one)
          const isMerchantStall = n.role === 'merchant' && n.kind === 'merchant'
          const isTalking = (n.kind === 'idle' || n.kind === 'merchant') && n.pose === POSE.talk
          const isPraying = n.kind === 'priest'
          const isGuard = n.kind === 'guard'
          const merchantReach = isMerchantStall ? Math.max(0, Math.sin(clock.current * 0.9 + n.phase)) * 0.72 : 0
          const prayBow = isPraying ? (Math.sin(clock.current * 0.55 + n.phase) * 0.5 + 0.5) * 0.34 : 0
          const talkPulse = isTalking && Math.sin(clock.current * 0.65 + n.phase * 1.7) > 0.78
          const guardLook = isGuard ? Math.sin(clock.current * 0.45 + n.phase) * 0.55 : n.look
          rigSphere.center.set(pos.x, pos.y + 0.95 * n.stature, pos.z)
          rigSphere.radius = 1.75 * Math.max(n.stature, n.build)
          const cdx = pos.x - camX, cdy = rigSphere.center.y - camY, cdz = pos.z - camZ
          const detail: CitizenDetail = !frustum.intersectsSphere(rigSphere) ? CITIZEN_DETAIL.offscreen
            : cdx * cdx + cdy * cdy + cdz * cdz > RIG_FULL_DETAIL_R2 ? CITIZEN_DETAIL.animated : CITIZEN_DETAIL.full
          const probeFeet = dist2 <= FOOT_PROBE_R2
          if (!probeFeet) farFoot.current = pos.y - 0.015
          slot.citizen.update(dt, {
            speed: gait ? n.speed : 0,
            grounded: true,
            wave: replying || talkPulse,
            look: guardLook,
            bend: isMerchantStall ? merchantReach * 0.24 : prayBow,
            reach: merchantReach,
            groundAt: probeFeet ? footGround : footGroundFar,
          }, detail)
          handledByClose = true
          break
        }
      }
      if (handledByClose) continue
      // Keep the immediate walk view exclusively high-detail rigged citizens; only distant figures use instanced LOD
      if (walking && poolLen > 0 && dist2 < 42 * 42) continue

      m4.compose(pos, q, one)
      if (dist2 <= NEAR_R2 && nearCount < nearPeople.instanceMatrix.count) {
        writePersonSlot(nearPeople, nearAttr, nearCount++, i, n.phase, gait, activePose, clampedLook)
      } else if (farCount < farPeople.instanceMatrix.count) {
        writePersonSlot(farPeople, farAttr, farCount++, i, n.phase, gait, activePose, clampedLook)
      }

      if (n.propIdx >= 0 && (!walking || dist2 <= PROP_MAX_R2)) {
        const pm = propMeshes[n.propIdx]
        const ps = propCounts[n.propIdx]
        if (ps < pm.cap) {
          pm.mesh.setMatrixAt(ps, m4)
          pm.attr.anim.setXYZW(ps, n.phase, gait, activePose, clampedLook)
          pm.attr.pose.setXY(ps, activePose, 1)
          propCounts[n.propIdx] = ps + 1
        }
      }
    }

    // the player's own figure (third person)
    one.set(1, 1, 1)
    const av = npcs.length
    if (sim.avatar) sim.avatar.root.visible = walking && walk.view === 'third'
    if (sim.avatar?.root.visible) {
      pos.set(walk.x, walk.feet, walk.z); q.setFromAxisAngle(up, walk.yaw + Math.PI)
      sim.avatar.root.position.copy(pos); sim.avatar.root.quaternion.copy(q)
      sim.avatar.update(dt, { speed: walk.speed, grounded: walk.grounded, wave: wavingNow, look: 0, groundAt: footGround })
    } else if (walking && walk.view === 'third' && nearCount < nearPeople.instanceMatrix.count) {
      pos.set(walk.x, walk.feet, walk.z); q.setFromAxisAngle(up, walk.yaw + Math.PI)
      m4.compose(pos, q, one)
      writePersonSlot(nearPeople, nearAttr, nearCount++, av, 0, walk.speed < 0.3 ? 0 : walk.speed > 4 ? 1 : 0.5, wavingNow ? POSE.wave : POSE.walk, 0)
    }

    nearPeople.count = nearCount
    farPeople.count = farCount
    // Upload only the live prefix; static tint/style buffers only when a slot changed owner.
    const lods = [[nearPeople, nearAttr, nearCount, 'near'], [farPeople, farAttr, farCount, 'far']] as const
    for (const [mesh, attr, count, key] of lods) {
      if (count === 0) continue
      flagPrefix(mesh.instanceMatrix, count); flagPrefix(attr.anim, count); flagPrefix(attr.pose, count)
      if (dirty.current[key]) {
        flagPrefix(attr.tint0, count); flagPrefix(attr.tint1, count); flagPrefix(attr.tint2, count); flagPrefix(attr.style, count)
        dirty.current[key] = false
      }
    }
    for (let pIdx = 0; pIdx < 4; pIdx++) {
      const pm = propMeshes[pIdx]
      const cnt = propCounts[pIdx]
      pm.mesh.count = cnt
      if (cnt > 0) {
        flagPrefix(pm.mesh.instanceMatrix, cnt)
        flagPrefix(pm.attr.anim, cnt)
        flagPrefix(pm.attr.pose, cnt)
      }
    }

    let nearestCart = -1
    let nearestDistance = 32 ** 2
    if (horse && walking) {
      horse.root.visible = false
      for (let i = 0; i < carts.length; i++) {
        const pose = cartPose(carts[i].distance, F.L, leadPose)
        const x = originX + ux * pose.u + vx * pose.v
        const z = originZ + uz * pose.u + vz * pose.v
        const distance = (x - px) ** 2 + (z - pz) ** 2
        if (distance < nearestDistance) { nearestCart = i; nearestDistance = distance }
      }
    }
    let horseCount = 0, cartCount = 0, horseTintDirty = false
    for (let i = 0; i < carts.length; i++) {
      const cr = carts[i]
      cr.distance += cr.speed * dt
      const lead = cartPose(cr.distance, F.L, leadPose)
      const x = originX + ux * lead.u + vx * lead.v
      const z = originZ + uz * lead.u + vz * lead.v
      const cdx = x - refX, cdz = z - refZ
      if (walking && cdx * cdx + cdz * cdz > CART_MAX_R2) continue
      const horseY = surfaceY(x, z, npcs.length + 1 + i * 2)
      const axle = cartPose(cr.distance - 2.6, F.L, axlePose)
      const cx = originX + ux * axle.u + vx * axle.v
      const cz = originZ + uz * axle.u + vz * axle.v
      const cartY = surfaceY(cx, cz, npcs.length + 2 + i * 2)
      const slopePitch = THREE.MathUtils.clamp(Math.atan2(horseY - cartY, 2.6), -0.25, 0.25)
      pos.set(x, horseY, z)
      q.setFromAxisAngle(up, F.yawU + lead.heading)
      qPitch.setFromAxisAngle(xAxis, -slopePitch)
      q.multiply(qPitch)
      if (horse && i === nearestCart) {
        horse.root.visible = true
        horse.root.position.copy(pos)
        horse.root.quaternion.copy(q)
        horse.mixer.update(dt * cr.speed / 1.4)
        horse.syncHarness()
      } else {
        m4.compose(pos, q, one)
        horses.setMatrixAt(horseCount, m4)
        if (horseSrc[horseCount] !== i) {
          horseSrc[horseCount] = i; horseTintDirty = true
          hAttr.tint0.setXYZ(horseCount, horseTints[i * 3], horseTints[i * 3 + 1], horseTints[i * 3 + 2])
        }
        hAttr.anim.setXYZW(horseCount, cr.phase, 0.5, 0, 0)
        horseCount++
      }
      q.setFromAxisAngle(up, Math.atan2(x - cx, z - cz))
      q.multiply(qPitch)
      pos.set(cx, cartY, cz); m4.compose(pos, q, one)
      cartMesh.setMatrixAt(cartCount, m4)
      cAttr.anim.setXYZW(cartCount, cr.phase, 0.5, 0, 0)
      cartCount++
    }
    horses.count = horseCount
    cartMesh.count = cartCount
    if (horseCount > 0) {
      flagPrefix(horses.instanceMatrix, horseCount)
      flagPrefix(hAttr.anim, horseCount)
      if (horseTintDirty) flagPrefix(hAttr.tint0, horseCount)
    }
    if (cartCount > 0) {
      flagPrefix(cartMesh.instanceMatrix, cartCount)
      flagPrefix(cAttr.anim, cartCount)
    }
  })

  return (
    <group visible={visible}>
      <primitive object={sim.nearPeople} />
      <primitive object={sim.farPeople} />
      {sim.propMeshes.map((pm) => pm.hasCarriers && <primitive key={pm.kind} object={pm.mesh} />)}
      {sim.avatar && <primitive object={sim.avatar.root} />}
      {sim.closePeople.map((slot, i) => <primitive key={i} object={slot.citizen.root} />)}
      <primitive object={sim.horses} />
      {horse && <primitive object={horse.root} />}
      <primitive object={sim.cartMesh} />
      {mode === 'walk' && <MarketSheep terrain={terrain} year={year} />}
    </group>
  )
}
