import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Terrain } from '../scene/terrainData'
import { GRID } from '../content/grid'
import { LANDMARKS } from '../content/landmarks'
import { solidMonumentAt } from '../scene/footprints'
import { CHARACTERS } from '../content/characters'
import { useApp, walkInputBlocked } from '../store'
import {
  createCartGeometry, createCrowdAttributes, createDetailedHorseHarness, createHeldPropGeometry,
  createHorseGeometry, createPersonGeometry, ERA_PALETTES, HAIR, patchCrowdMaterial, POSE, SKIN_TONES,
} from './npcGeometry'
import { gridFrame, stallSpots } from './spots'
import { walk } from './WalkControls'
import { WorldProbe } from './physics'
import {
  createRiggedCitizen, loadCitizenAssets,
  type AgeGroup, type CitizenRole, type FabricKind, type GarmentCut,
} from './riggedCitizen'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { cartPose } from './cartRoute'
import { MarketSheep } from './MarketSheep'

type Variant = 'greek' | 'roman' | 'byzantine'
type PropKind = 'amphora' | 'basket' | 'staff' | 'scroll'
const variantFor = (year: number): Variant => (year < -133 ? 'greek' : year < 330 ? 'roman' : 'byzantine')

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
  prop?: PropKind
  propSlot?: number
  u: number; v: number; dir: number; speed: number; min: number; max: number
  /** fixed spot (idle/merchant/priest/guard) in local metres, and facing */
  x?: number; z?: number; face?: number
  bx?: number; bz?: number
  side: number; phase: number; pose: number; look: number
}

/** live NPC positions for barks (x, z, yaw, voice) */
export const NPC_STATE: { x: Float32Array; z: Float32Array; count: number; female: Uint8Array } = {
  x: new Float32Array(0), z: new Float32Array(0), count: 0, female: new Uint8Array(0),
}

function roleBodyMetrics(role: CitizenRole, age: AgeGroup, female: boolean, rand: () => number) {
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

export function Crowd({ terrain }: { terrain: Terrain }) {
  const mode = useApp((s) => s.mode)
  const [horse, setHorse] = useState<{ root: THREE.Group; mixer: THREE.AnimationMixer; syncHarness: () => void } | null>(null)
  useEffect(() => {
    if (mode !== 'walk') return
    let active = true
    let dispose: (() => void) | undefined
    new GLTFLoader().load('/models/animals/cart-horse.glb', model => {
      const rigGroup = new THREE.Group()
      const meshRoot = model.scene
      const mixer = new THREE.AnimationMixer(meshRoot)
      const harness = createDetailedHorseHarness()
      dispose = () => {
        mixer.stopAllAction()
        mixer.uncacheRoot(meshRoot)
        harness.dispose()
        meshRoot.traverse(o => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose()
            for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose()
          }
          if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose()
        })
      }
      if (!active) { dispose(); return }
      meshRoot.scale.setScalar(0.003)
      meshRoot.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true })
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
    }, undefined, error => console.warn('Detailed cart horse unavailable', error))
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
  const probe = useMemo(() => new WorldProbe(), [])
  const groundCache = useRef(new Map<number, { x: number; z: number; y: number }>())
  const era = useApp((s) => s.era)
  const showGrid = useApp((s) => s.showGrid)
  const year = useApp((s) => s.year)
  const character = useApp((s) => s.character)
  const variant: Variant = mode === 'walk' || mode === 'plan' ? variantFor(year) : 'roman'
  const visible = era === 'ancient' && (mode === 'walk' || (mode === 'explore' && showGrid) || mode === 'tour')

  useEffect(() => {
    const timer = window.setTimeout(() => { probe.refresh(scene); groundCache.current.clear() }, 400)
    return () => window.clearTimeout(timer)
  }, [scene, probe, year, showGrid, mode])

  const surfaceY = (x: number, z: number, id: number) => {
    const terrainY = terrain.heightAt(x, z)
    const cached = groundCache.current.get(id)
    if (!cached || Math.hypot(x - cached.x, z - cached.z) > 0.35) {
      const y = Math.max(terrainY, probe.ground(x, z, terrainY + 2.5))
      groundCache.current.set(id, { x, z, y })
      return y + 0.015
    }
    return Math.max(terrainY, cached.y) + 0.015
  }

  const sim = useMemo(() => {
    const F = gridFrame(terrain)
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
      if (role === 'porter') return r < 0.38 ? 'young' : r < 0.9 ? 'adult' : 'older'
      if (role === 'merchant' || role === 'priest') return r < 0.12 ? 'young' : r < 0.62 ? 'adult' : 'older'
      return r < 0.22 ? 'young' : r < 0.76 ? 'adult' : 'older'
    }
    const pushNpc = (entry: Omit<Npc, 'age' | 'cut' | 'fabric' | 'stature' | 'build'>, forceGender?: 0 | 1) => {
      const isFem = forceGender ?? (entry.role === 'soldier' ? 0 : entry.role === 'porter' ? (rand() < 0.15 ? 1 : 0) : rand() < 0.46 ? 1 : 0)
      const age = pickAge(entry.role)
      const { stature, build } = roleBodyMetrics(entry.role, age, !!isFem, rand)
      const cut: GarmentCut = entry.role === 'porter' || entry.role === 'merchant' || entry.role === 'soldier' ? 'work' : 'full'
      const fabric: FabricKind = entry.role === 'porter' ? 'linen'
        : entry.role === 'merchant' ? (rand() < 0.6 ? 'linen' : 'wool')
        : variant === 'roman' ? (rand() < 0.55 ? 'linen' : 'wool') : (rand() < 0.35 ? 'linen' : 'wool')
      femaleFlags.push(isFem)
      npcs.push({ ...entry, age, cut, fabric, stature, build })
    }

    const pop = variant === 'roman' ? 1 : 0.68
    const nWalk = Math.round(230 * pop), nCross = Math.round(68 * pop)
    for (let i = 0; i < nWalk; i++) {
      const lane = [-10.0, -6, -2.2, 2.2, 6, 10.0][Math.floor(rand() * 6)]
      let uu = 0
      for (let k = 0; k < 8; k++) { uu = rand() < 0.48 ? 14 + rand() * 270 : 20 + rand() * (F.L - 40); if (!solidMonumentAt(...F.P(uu, lane), spawnYr, 1)) break }
      // Distribute roles along the main Plateia: porters hauling amphorae/baskets, patrolling soldiers, pilgrims, merchants, and residents
      const roll = rand()
      let role: CitizenRole = 'resident'
      let prop: PropKind | undefined
      let pose: number = POSE.walk
      let speed = 1.0 + rand() * 0.45
      if (roll < 0.17) {
        role = 'porter'
        prop = rand() < 0.58 ? 'amphora' : 'basket'
        pose = prop === 'amphora' ? POSE.carry : POSE.walk
        speed = 0.88 + rand() * 0.28
      } else if (roll < 0.25) {
        role = 'soldier'
        prop = 'staff'
        speed = 1.05 + rand() * 0.22
      } else if (roll < (variant === 'byzantine' ? 0.44 : 0.33)) {
        role = 'pilgrim'
        prop = 'staff'
        speed = 0.85 + rand() * 0.30
      } else if (roll < 0.48) {
        role = 'merchant'
        if (rand() < 0.45) prop = 'scroll'
      }
      pushNpc({ kind: 'walker', role, prop, u: uu, v: lane + (rand() - 0.5) * 0.6, dir: rand() < 0.5 ? 1 : -1, speed, min: 12, max: F.L - 12, side: 0, phase: rand() * 6.28, pose, look: 0 })
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

    // Stationed gate & sanctuary soldiers on watch (flanking arches so their silhouette reads clearly against the stone!)
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
    if (stands('agora')) { const [x, z] = at('agora'); groupAt(x, z, variant === 'roman' ? 9 : 6, 0.45) }
    if (stands('tritons')) { const [x, z] = at('tritons'); groupAt(x, z, 3, 0.15) }
    if (stands('theatre')) { const [x, z] = at('theatre'); groupAt(x - 40, z, 3, 0.15) }

    // Merchants behind the portico stalls (with nearby porters unloading baskets/amphorae)
    const stalls = stallSpots(F.L)
    stalls.forEach((st, idx) => {
      const [x, z] = F.P(st.u, st.side * 10.6)
      pushNpc({
        kind: 'merchant', role: 'merchant', prop: idx % 3 === 0 ? 'scroll' : undefined,
        u: 0, v: 0, dir: 1, speed: 0, min: 0, max: 0, x, z,
        face: F.yawV + (st.side > 0 ? Math.PI : 0), side: 0, phase: rand() * 6.28, pose: POSE.talk, look: 0,
      })
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
    pray('apollo', 4, 14); pray('ploutonion', 4, 9); pray('martyrium', 5, 22); pray('cathedral', 4, 16); pray('philip-church', 4, 14)

    // Era-specific pilgrim processions: St Philip's Church <-> Martyrium in AD 500; Sacred Spring <-> Ploutonion in 150 BC / AD 200
    if (variant === 'byzantine' && stands('martyrium')) {
      const [ax, az] = at('philip-church'), [bx, bz] = at('martyrium')
      for (let i = 0; i < 26; i++) {
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
      for (let i = 0; i < 12; i++) {
        pushNpc({
          kind: 'pilgrim', role: 'pilgrim', prop: 'staff',
          u: rand(), v: (rand() - 0.5) * 2.5, dir: rand() < 0.5 ? 1 : -1,
          speed: 0.75 + rand() * 0.25, min: 0, max: 1, x: ax, z: az, bx, bz,
          face: Math.atan2(bx - ax, bz - az), side: Math.hypot(bx - ax, bz - az),
          phase: rand() * 6.28, pose: POSE.walk, look: 0,
        })
      }
    }

    // Meshes & attributes
    const pal = ERA_PALETTES[variant]
    const pGeo = createPersonGeometry(variant)
    const pAttr = createCrowdAttributes(npcs.length + 1)
    pGeo.setAttribute('iAnim', pAttr.anim)
    pGeo.setAttribute('iTint0', pAttr.tint0)
    pGeo.setAttribute('iTint1', pAttr.tint1)
    pGeo.setAttribute('iTint2', pAttr.tint2)
    pGeo.setAttribute('iStyle', pAttr.style)
    pGeo.setAttribute('iPose', pAttr.pose)
    const pMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.88 })
    patchCrowdMaterial(pMat, 'person')
    const people = new THREE.InstancedMesh(pGeo, pMat, npcs.length + 1) // last instance = the player's avatar
    const c = new THREE.Color(), hc = new THREE.Color()
    const female = new Uint8Array(femaleFlags)

    // Distinct role-tuned mineral dyes & fabrics
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
      c.set(clothHex); pAttr.tint0.setXYZ(i, c.r, c.g, c.b)
      c.set(SKIN_TONES[Math.floor(rand() * SKIN_TONES.length)]); pAttr.tint1.setXYZ(i, c.r, c.g, c.b)
      c.set(accentHex); pAttr.tint2.setXYZ(i, c.r, c.g, c.b)
      pAttr.anim.setXYZW(i, n.phase, 0, n.pose, 0)
      pAttr.pose.setXY(i, n.pose, 1)

      // Hair color & style (veiled matrons/monks, buns, curly/short hair, silver-grey elders & beards)
      if (n.age === 'older') hc.set(rand() < 0.5 ? '#9e978d' : '#b8b1a6')
      else hc.set(pal.hair[Math.floor(rand() * pal.hair.length)])
      const veiled = (isFem && (variant === 'byzantine' || n.role === 'priest' || rand() < 0.35)) || (n.role === 'priest' && variant === 'byzantine')
      const hairCode = veiled ? HAIR.veiled : isFem ? HAIR.bun : (n.age === 'older' && rand() < 0.28 ? HAIR.bald : rand() < 0.45 ? HAIR.curly : HAIR.short)
      const bearded = !isFem && n.age !== 'young' && (variant !== 'roman' || n.role !== 'soldier' ? rand() < 0.58 : rand() < 0.25)
      pAttr.style.setXYZW(i, hc.r, hc.g, hc.b, hairCode + (bearded ? 5 : 0))
    })

    const ch = CHARACTERS.find((x) => x.id === character) ?? CHARACTERS[2]
    const avatarRole: CitizenRole =
      ch.id === 'theano' || ch.id === 'philippos' ? 'priest'
      : ch.id === 'eudokia' ? 'pilgrim'
      : ch.id === 'nikias' || ch.id === 'aurelia' ? 'merchant' : 'resident'
    c.set(ch.colors.body); pAttr.tint0.setXYZ(npcs.length, c.r, c.g, c.b)
    c.set(SKIN_TONES[2]); pAttr.tint1.setXYZ(npcs.length, c.r, c.g, c.b)
    c.set(ch.colors.accent); pAttr.tint2.setXYZ(npcs.length, c.r, c.g, c.b)
    pAttr.style.setXYZW(npcs.length, 0.16, 0.11, 0.08, ch.gender === 'f' ? HAIR.bun : HAIR.short)

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
    const poolSize = window.matchMedia('(pointer: coarse)').matches ? 2 : 6
    const closePeople = Array.from({ length: citizenAssets ? poolSize : 0 }, (_, slotIndex) => {
      const gender = slotIndex % 2 ? 'f' as const : 'm' as const
      const citizen = createRiggedCitizen(variant, { cloth: new THREE.Color(pal.cloth[0]), skin: new THREE.Color(SKIN_TONES[2]), accent: new THREE.Color(pal.accent[0]) }, gender)
      citizen.root.visible = false
      return { citizen, id: -1, gender }
    })

    // Shared instanced held props (amphora, reed pack basket, walking staff / spear, scroll)
    const propKinds: PropKind[] = ['amphora', 'basket', 'staff', 'scroll']
    const propCarriers: Record<PropKind, number[]> = { amphora: [], basket: [], staff: [], scroll: [] }
    npcs.forEach((n, idx) => {
      if (n.prop) {
        n.propSlot = propCarriers[n.prop].length
        propCarriers[n.prop].push(idx)
      }
    })
    const propTints: Record<PropKind, string> = { amphora: '#b86843', basket: '#a68552', staff: '#6d5034', scroll: '#e6dcc5' }
    const propMeshes = propKinds.map((kind) => {
      const carriers = propCarriers[kind]
      const count = Math.max(1, carriers.length)
      const geo = createHeldPropGeometry(kind)
      const attr = createCrowdAttributes(count)
      geo.setAttribute('iAnim', attr.anim)
      geo.setAttribute('iTint0', attr.tint0)
      geo.setAttribute('iTint1', attr.tint1)
      geo.setAttribute('iTint2', attr.tint2)
      geo.setAttribute('iPose', attr.pose)
      c.set(propTints[kind])
      for (let i = 0; i < count; i++) {
        attr.tint0.setXYZ(i, c.r, c.g, c.b)
        attr.tint1.setXYZ(i, c.r, c.g, c.b)
        attr.tint2.setXYZ(i, c.r, c.g, c.b)
      }
      const mesh = new THREE.InstancedMesh(geo, pMat, count)
      mesh.count = carriers.length
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      return { kind, carriers, mesh, attr }
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
    carts.forEach((cr, i) => {
      c.set(coats[i % coats.length]); hAttr.tint0.setXYZ(i, c.r, c.g, c.b)
      c.set('#2a1d15'); hAttr.tint1.setXYZ(i, c.r, c.g, c.b)
      c.set('#5c3322'); hAttr.tint2.setXYZ(i, c.r, c.g, c.b)
      hAttr.anim.setXYZW(i, cr.phase, 0.5, 0, 0); cAttr.anim.setXYZW(i, cr.phase, 0.5, 0, 0)
      c.set('#8a6a4a'); cAttr.tint0.setXYZ(i, c.r, c.g, c.b)
      c.set('#b89b72'); cAttr.tint1.setXYZ(i, c.r, c.g, c.b)
      cAttr.tint2.setXYZ(i, 0.36, 0.24, 0.18)
    })
    const horses = new THREE.InstancedMesh(hGeo, hMat, nCarts)
    const cartMesh = new THREE.InstancedMesh(cGeo, cMat, nCarts)
    for (const m of [people, horses, cartMesh]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage) }
    const depthMats = ([['person', people], ['horse', horses], ['cart', cartMesh]] as const).map(([kind, mesh]) => {
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
      patchCrowdMaterial(depth, kind)
      mesh.customDepthMaterial = depth
      return depth
    })
    for (const pm of propMeshes) pm.mesh.customDepthMaterial = depthMats[0]
    NPC_STATE.x = new Float32Array(npcs.length); NPC_STATE.z = new Float32Array(npcs.length); NPC_STATE.count = npcs.length; NPC_STATE.female = female
    return { F, npcs, carts, people, horses, cartMesh, propMeshes, pAttr, hAttr, cAttr, avatar, closePeople, mats: [pMat, hMat, cMat, ...depthMats] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrain, variant, character, citizenAssets, mode === 'walk' ? year : 0])

  useEffect(() => () => {
    sim.people.geometry.dispose(); sim.people.dispose()
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

  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const qPitch = useMemo(() => new THREE.Quaternion(), [])
  const xAxis = useMemo(() => new THREE.Vector3(1, 0, 0), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const hidden = useMemo(() => new THREE.Vector3(0, -9999, 0), [])
  const tmpCloth = useMemo(() => new THREE.Color(), [])
  const tmpSkin = useMemo(() => new THREE.Color(), [])
  const tmpAccent = useMemo(() => new THREE.Color(), [])
  const clock = useRef(0)

  useFrame((_, rawDt) => {
    if (!visible) return
    if (mode === 'walk' && walkInputBlocked(useApp.getState())) return
    const dt = Math.min(rawDt, 0.1); clock.current += dt
    const simYear = mode === 'walk' ? year : null
    const { F, npcs, carts, people, horses, cartMesh, propMeshes, pAttr, mats } = sim
    for (const m of mats) (m.userData.uTime as { value: number }).value = clock.current
    const walking = mode === 'walk'
    const px = walk.x, pz = walk.z
    // Keep expensive skeletal animation limited to the player and a small nearby pool.
    const candidates: number[] = []
    if (walking && sim.closePeople.length > 0) {
      const scored: Array<{ i: number; d: number }> = []
      for (let i = 0; i < npcs.length; i++) {
        const dx = NPC_STATE.x[i] - px, dz = NPC_STATE.z[i] - pz
        const d2 = dx * dx + dz * dz
        if (d2 < 22 * 22) scored.push({ i, d: d2 })
      }
      scored.sort((a, b) => a.d - b.d)
      for (let k = 0; k < Math.min(sim.closePeople.length, scored.length); k++) candidates.push(scored[k].i)
    }
    for (const slot of sim.closePeople) {
      if (!candidates.includes(slot.id)) { slot.id = -1; slot.citizen.root.visible = false }
    }
    for (const id of candidates) if (!sim.closePeople.some(slot => slot.id === id)) {
      const slot = sim.closePeople.find(slot => slot.id === -1 && slot.gender === (NPC_STATE.female[id] ? 'f' : 'm'))
      if (slot) {
        const npc = npcs[id]
        slot.id = id
        slot.citizen.reset()
        slot.citizen.configure({ role: npc.role, cut: npc.cut, fabric: npc.fabric, age: npc.age })
        slot.citizen.setPalette({
          cloth: tmpCloth.fromBufferAttribute(pAttr.tint0, id),
          skin: tmpSkin.fromBufferAttribute(pAttr.tint1, id),
          accent: tmpAccent.fromBufferAttribute(pAttr.tint2, id),
        })
      }
    }

    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i]
      let x: number, z: number, yaw: number, gait = 0
      if (n.kind === 'walker' || n.kind === 'cross') {
        if (n.kind === 'cross') { n.v += n.dir * n.speed * dt; if (n.v > n.max || n.v < n.min) n.dir *= -1 }
        else { n.u += n.dir * n.speed * dt; if (n.u > n.max || n.u < n.min) n.dir *= -1 }
        const ahead = n.dir * 0.8
        const [ax, az] = n.kind === 'cross' ? F.P(n.u, n.v + ahead + n.side) : F.P(n.u + ahead, n.v + n.side)
        if (solidMonumentAt(ax, az, simYear)) n.dir *= -1
        ;[x, z] = F.P(n.u, n.v + n.side)
        if (walking) {
          const d = Math.hypot(x - px, z - pz)
          const want = d < 1.6 ? (((x - px) * F.v[0] + (z - pz) * F.v[1]) >= 0 ? 1.4 : -1.4) : 0
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
      let look = 0
      if (walking) {
        const dx = px - x, dz = pz - z, d = Math.hypot(dx, dz)
        if (d < 5) { const angle = Math.atan2(dx, dz) - yaw; look = THREE.MathUtils.clamp(Math.atan2(Math.sin(angle), Math.cos(angle)), -1, 1) }
      }
      n.look += (look - n.look) * Math.min(1, dt * 4)
      const replying = walking && performance.now() < walk.waveUntil && Math.hypot(px - x, pz - z) < 5
      const activePose = replying ? POSE.wave : n.pose
      const clampedLook = THREE.MathUtils.clamp(n.look, -1, 1)
      pAttr.anim.setXYZW(i, n.phase, gait, activePose, clampedLook)
      pAttr.pose.setXY(i, activePose, 1)
      NPC_STATE.x[i] = x; NPC_STATE.z[i] = z
      pos.set(x, surfaceY(x, z, i), z)
      q.setFromAxisAngle(up, yaw)
      one.set(n.build, n.stature, n.build)
      const close = sim.closePeople.find(slot => slot.id === i)
      if (close) {
        close.citizen.root.visible = true
        close.citizen.root.position.copy(pos); close.citizen.root.quaternion.copy(q); close.citizen.root.scale.copy(one)
        close.citizen.update(dt, { speed: gait ? n.speed : 0, grounded: true, wave: replying, look: n.look, groundAt: footGround })
        m4.compose(hidden, q, one)
      } else {
        m4.compose(pos, q, one)
      }
      people.setMatrixAt(i, m4)
      if (n.prop && n.propSlot !== undefined) {
        const pm = propMeshes[n.prop === 'amphora' ? 0 : n.prop === 'basket' ? 1 : n.prop === 'staff' ? 2 : 3]
        pm.mesh.setMatrixAt(n.propSlot, m4)
        pm.attr.anim.setXYZW(n.propSlot, n.phase, gait, activePose, clampedLook)
        pm.attr.pose.setXY(n.propSlot, activePose, 1)
      }
    }

    // the player's own figure (third person)
    one.set(1, 1, 1)
    const av = npcs.length
    if (sim.avatar) sim.avatar.root.visible = walking && walk.view === 'third'
    if (sim.avatar?.root.visible) {
      pos.set(walk.x, walk.feet, walk.z); q.setFromAxisAngle(up, walk.yaw + Math.PI)
      sim.avatar.root.position.copy(pos); sim.avatar.root.quaternion.copy(q)
      sim.avatar.update(dt, { speed: walk.speed, grounded: walk.grounded, wave: performance.now() < walk.waveUntil, look: 0, groundAt: footGround })
      m4.compose(hidden, q, one)
      pAttr.anim.setXYZW(av, 0, walk.speed < 0.3 ? 0 : walk.speed > 4 ? 1 : 0.5, performance.now() < walk.waveUntil ? POSE.wave : POSE.walk, 0)
    } else if (walking && walk.view === 'third') {
      pos.set(walk.x, walk.feet, walk.z); q.setFromAxisAngle(up, walk.yaw + Math.PI)
      m4.compose(pos, q, one)
      pAttr.anim.setXYZW(av, 0, walk.speed < 0.3 ? 0 : 0.5, 0, 0)
    } else m4.compose(hidden, q.identity(), one)
    people.setMatrixAt(av, m4)

    let nearestCart = -1
    let nearestDistance = 32 ** 2
    if (horse && walking) {
      horse.root.visible = false
      for (let i = 0; i < carts.length; i++) {
        const pose = cartPose(carts[i].distance, F.L)
        const [x, z] = F.P(pose.u, pose.v)
        const distance = (x - px) ** 2 + (z - pz) ** 2
        if (distance < nearestDistance) { nearestCart = i; nearestDistance = distance }
      }
    }
    for (let i = 0; i < carts.length; i++) {
      const cr = carts[i]
      cr.distance += cr.speed * dt
      const lead = cartPose(cr.distance, F.L)
      const [x, z] = F.P(lead.u, lead.v)
      const horseY = surfaceY(x, z, npcs.length + 1 + i * 2)
      const axle = cartPose(cr.distance - 2.6, F.L)
      const [cx, cz] = F.P(axle.u, axle.v)
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
        m4.compose(hidden, q, one)
      } else m4.compose(pos, q, one)
      horses.setMatrixAt(i, m4)
      // cart trails 2.6 m behind the horse; pitch matches the street grade so shafts meet the tug loops
      q.setFromAxisAngle(up, Math.atan2(x - cx, z - cz))
      q.multiply(qPitch)
      pos.set(cx, cartY, cz); m4.compose(pos, q, one); cartMesh.setMatrixAt(i, m4)
    }

    people.instanceMatrix.needsUpdate = true
    horses.instanceMatrix.needsUpdate = true
    cartMesh.instanceMatrix.needsUpdate = true
    pAttr.anim.needsUpdate = true
    pAttr.pose.needsUpdate = true
    for (const pm of propMeshes) if (pm.carriers.length > 0) {
      pm.mesh.instanceMatrix.needsUpdate = true
      pm.attr.anim.needsUpdate = true
      pm.attr.pose.needsUpdate = true
    }
  })

  return (
    <group visible={visible}>
      <primitive object={sim.people} />
      {sim.propMeshes.map((pm) => pm.carriers.length > 0 && <primitive key={pm.kind} object={pm.mesh} />)}
      {sim.avatar && <primitive object={sim.avatar.root} />}
      {sim.closePeople.map((slot, i) => <primitive key={i} object={slot.citizen.root} />)}
      <primitive object={sim.horses} />
      {horse && <primitive object={horse.root} />}
      <primitive object={sim.cartMesh} />
      {mode === 'walk' && <MarketSheep terrain={terrain} year={year} />}
    </group>
  )
}
