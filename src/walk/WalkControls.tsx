import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useApp, walkInputBlocked } from '../store'
import { getTerrain, loadTerrain } from '../scene/terrainData'
import { killFlight, rig } from '../scene/camera'
import { GRID_AXES, HOUSE_RECTS, STREET_SEGS } from '../scene/CityGrid'
import { CHARACTERS } from '../content/characters'
import { GRID } from '../content/grid'
import { WorldProbe } from './physics'
import { sceneUniforms } from '../scene/Terrain'
import { waterHere } from '../scene/Water'
import { addRipple } from '../scene/water'

const EYE = 1.62, RADIUS = 0.35, STEP = 0.45
const SPEED = { walk: 2.0, run: 4.6, sprint: 7.5 }
const GRAVITY = 18, JUMP_V = 5.4, COYOTE = 0.12, BUFFER = 0.15
/** water: wade above 0.3 m (slower), swim once the floor is deeper than 1.1 m; swimmers float chest-deep */
const WADE = 0.3, SWIM = 1.1, FLOAT = 1.25, SWIM_SPEED = { walk: 1.3, run: 1.8, sprint: 2.2 }

export type Surface = 'stone' | 'gravel' | 'grass' | 'water'

/** shared walk state (read by the HUD, crowd, avatar and sound) */
export const walk = {
  yaw: 0, pitch: 0, x: 0, z: 0, feet: 0,
  vx: 0, vz: 0, vy: 0, grounded: true,
  moving: false, speed: 0, gait: 'walk' as 'walk' | 'run' | 'sprint',
  /** user speed multiplier (HUD slider) */
  speedMul: 1,
  view: 'first' as 'first' | 'third',
  /** virtual joystick (mobile), -1..1, and on-screen jump button */
  joy: { x: 0, y: 0 }, jumpPressed: false,
  locked: false,
  waveUntil: 0,
  surface: 'stone' as Surface,
  /** water state at the walker: none, wading or swimming; waterY = surface height when in water */
  water: 'none' as 'none' | 'wade' | 'swim',
  waterY: 0,
  /** camera below the water surface (HUD tint, muffled sound) */
  underwater: false,
  onSplash: new Set<(k: number) => void>(),
  onStroke: new Set<() => void>(),
  /** listeners: footstep (surface, intensity) and landing (fall speed) */
  onStep: new Set<(s: Surface, k: number) => void>(),
  onJump: new Set<() => void>(),
  onLand: new Set<(v: number) => void>(),
}

/** move the walker instantly (fast travel) */
export function teleport(x: number, z: number, yaw: number) {
  pendingTeleport = { x, z, yaw }
}
let pendingTeleport: { x: number; z: number; yaw: number } | null = null

const keys = new Set<string>()

/** spatial hash of house rects: houses are walls (no roof climbing) */
function buildHouseHash() {
  const cell = 24, map = new Map<string, number[]>()
  HOUSE_RECTS.forEach((r, i) => {
    const ext = Math.hypot(r.hu, r.hv) + RADIUS
    for (let gx = Math.floor((r.x - ext) / cell); gx <= Math.floor((r.x + ext) / cell); gx++)
      for (let gz = Math.floor((r.z - ext) / cell); gz <= Math.floor((r.z + ext) / cell); gz++) {
        const k = gx + ',' + gz; const a = map.get(k) ?? []; a.push(i); map.set(k, a)
      }
  })
  return (x: number, z: number) => {
    const ids = map.get(Math.floor(x / cell) + ',' + Math.floor(z / cell))
    if (!ids) return false
    const [ux, uz] = GRID_AXES.u, [vx, vz] = GRID_AXES.v
    for (const i of ids) {
      const r = HOUSE_RECTS[i], dx = x - r.x, dz = z - r.z
      if (Math.abs(dx * ux + dz * uz) < r.hu + RADIUS && Math.abs(dx * vx + dz * vz) < r.hv + RADIUS) return true
    }
    return false
  }
}

export function onStreet(x: number, z: number) {
  for (const s of STREET_SEGS) {
    const ax = s.a[0], az = s.a[1], bx = s.b[0] - ax, bz = s.b[1] - az
    const L2 = bx * bx + bz * bz
    const t = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / L2))
    if (Math.hypot(x - (ax + bx * t), z - (az + bz * t)) < s.w / 2 + 0.3) return true
  }
  return false
}

/** First-person (and optional third-person) walking with simple game physics. */
export function WalkControls() {
  const mode = useApp((s) => s.mode)
  const character = useApp((s) => s.character)
  const showGrid = useApp((s) => s.showGrid)
  const year = useApp((s) => s.year)
  const { camera, gl, scene } = useThree()
  const probe = useMemo(() => new WorldProbe(), [])
  const houses = useRef<(x: number, z: number) => boolean>(() => false)
  const st = useRef({ bob: 0, coyote: 0, buffer: 0, dip: 0, lastTapW: 0, sprintLatch: false, stepPhase: 0, camDist: 0 })
  const active = mode === 'walk'
  const probeReady = useRef(false)
  const [terrainReady, setTerrainReady] = useState(() => !!getTerrain())
  useEffect(() => {
    let mounted = true
    void loadTerrain().then(() => { if (mounted) setTerrainReady(true) }).catch(() => { /* scene loader owns the terrain error */ })
    return () => { mounted = false }
  }, [])

  // (re)build collision data when the city changes (city layer, era)
  useEffect(() => {
    if (!active || !terrainReady) return
    probeReady.current = false
    const id = window.setTimeout(() => {
      houses.current = buildHouseHash()
      probe.refresh(scene)
      probeReady.current = true
      // never start inside something: spiral out to the nearest free spot
      const t = getTerrain()
      if (t && blockedAt(walk.x, walk.z, walk.feet)) {
        search: for (let r = 2; r <= 60; r += 2) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
          const x = walk.x + Math.cos(a) * r, z = walk.z + Math.sin(a) * r
          if (!blockedAt(x, z, t.heightAt(x, z))) { walk.x = x; walk.z = z; break search }
        }
      }
    }, 350)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, showGrid, year, terrainReady])

  /** a spot is blocked if inside a house or if a monument surface towers above the feet */
  function blockedAt(x: number, z: number, feet: number) {
    if (houses.current(x, z)) return true
    const top = probe.ground(x, z, feet + 2.4)
    return top > feet + STEP
  }

  // enter / leave
  useEffect(() => {
    if (!active || !terrainReady) return
    const cam = camera as THREE.PerspectiveCamera
    const t = getTerrain(), c = CHARACTERS.find((x) => x.id === character) ?? CHARACTERS[2]
    if (!t) return
    killFlight()
    const resume = useApp.getState().walkSession
    const [x, z] = resume ? [walk.x, walk.z] : t.toLocal(c.spawn.lat, c.spawn.lon)
    Object.assign(walk, { x, z, vx: 0, vz: 0, vy: 0, grounded: true, yaw: resume ? walk.yaw : -THREE.MathUtils.degToRad(c.spawn.heading), pitch: resume ? walk.pitch : 0 })
    walk.feet = resume ? Math.max(walk.feet, t.heightAt(x, z)) : t.heightAt(x, z)
    useApp.getState().setWalkSession(true)
    useApp.getState().setWalkPaused(false)
    camera.position.set(x, walk.feet + EYE, z)
    const prev = { fov: cam.fov, near: cam.near }
    cam.fov = 70; cam.near = 0.08; cam.updateProjectionMatrix()
    if (rig.controls) rig.controls.enabled = false
    sceneUniforms.uWalk.value = 1
    return () => {
      sceneUniforms.uWalk.value = 0
      cam.fov = prev.fov; cam.near = prev.near; cam.updateProjectionMatrix()
      if (rig.controls) rig.controls.enabled = true
      if (document.pointerLockElement) void document.exitPointerLock()
      pendingTeleport = null; keys.clear(); walk.joy.x = walk.joy.y = 0; walk.moving = false; walk.speed = 0; walk.jumpPressed = false
    }
  }, [active, character, camera, terrainReady])

  // input
  useEffect(() => {
    if (!active) return
    const el = gl.domElement
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (walkInputBlocked(useApp.getState())) return
      const k = e.key.toLowerCase()
      if (k === 'g' && !e.repeat) window.dispatchEvent(new Event('walk:greet'))
      if (k === 'w' && !e.repeat) {
        const now = performance.now()
        if (now - st.current.lastTapW < 280) st.current.sprintLatch = true
        st.current.lastTapW = now
      }
      if (k === ' ' && !e.repeat) st.current.buffer = BUFFER
      if (k === 'v' && !e.repeat) walk.view = walk.view === 'first' ? 'third' : 'first'
      keys.add(k)
      if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault()
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      keys.delete(k)
      if (k === 'w') st.current.sprintLatch = false
    }
    const blur = () => { keys.clear(); walk.joy.x = walk.joy.y = 0; useApp.getState().setWalkPaused(true) }
    const click = () => { if (walkInputBlocked(useApp.getState())) return; if (!document.pointerLockElement && window.matchMedia('(pointer: fine)').matches) void el.requestPointerLock() }
    const lockChange = () => {
      const wasLocked = walk.locked
      walk.locked = document.pointerLockElement === el
      if (wasLocked && !walk.locked && !walkInputBlocked(useApp.getState())) blur()
    }
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement !== el || walkInputBlocked(useApp.getState())) return
      walk.yaw -= e.movementX * 0.0022
      walk.pitch = THREE.MathUtils.clamp(walk.pitch - e.movementY * 0.0022, -1.25, 1.25)
    }
    let touchId: number | null = null, lx = 0, ly = 0
    const ts = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if ((t.target as HTMLElement).closest('[data-joystick],[data-walkui]')) continue
        if (touchId === null) { touchId = t.identifier; lx = t.clientX; ly = t.clientY }
      }
    }
    const tm = (e: TouchEvent) => {
      if (walkInputBlocked(useApp.getState())) return
      for (const t of Array.from(e.changedTouches)) if (t.identifier === touchId) {
        walk.yaw -= (t.clientX - lx) * 0.005
        walk.pitch = THREE.MathUtils.clamp(walk.pitch - (t.clientY - ly) * 0.004, -1.1, 1.1)
        lx = t.clientX; ly = t.clientY
      }
    }
    const te = (e: TouchEvent) => { for (const t of Array.from(e.changedTouches)) if (t.identifier === touchId) touchId = null }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur)
    el.addEventListener('click', click); document.addEventListener('pointerlockchange', lockChange); document.addEventListener('mousemove', move)
    el.addEventListener('touchstart', ts, { passive: true }); el.addEventListener('touchmove', tm, { passive: true }); el.addEventListener('touchend', te); el.addEventListener('touchcancel', te)
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur)
      el.removeEventListener('click', click); document.removeEventListener('pointerlockchange', lockChange); document.removeEventListener('mousemove', move)
      el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', te); el.removeEventListener('touchcancel', te)
    }
  }, [active, gl])

  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])
  const n = useMemo(() => new THREE.Vector3(), [])
  const back = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, rawDt) => {
    if (!active || !probeReady.current) return
    const t = getTerrain()
    if (!t) return
    if (walkInputBlocked(useApp.getState())) {
      keys.clear(); walk.joy.x = walk.joy.y = 0; walk.jumpPressed = false
      walk.vx = walk.vz = walk.speed = 0; walk.moving = false
      st.current.buffer = 0; st.current.sprintLatch = false
      return
    }
    const dt = Math.min(rawDt, 0.05)
    const S = st.current

    if (pendingTeleport) {
      const p = pendingTeleport; pendingTeleport = null
      let px = p.x, pz = p.z
      if (blockedAt(px, pz, t.heightAt(px, pz))) {
        search: for (let r = 2; r <= 50; r += 1.5) for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
          const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r
          if (!blockedAt(x, z, t.heightAt(x, z))) { px = x; pz = z; break search }
        }
      }
      Object.assign(walk, { x: px, z: pz, yaw: p.yaw, pitch: 0, vx: 0, vz: 0, vy: 0, grounded: true })
      walk.feet = Math.max(t.heightAt(px, pz), probe.ground(px, pz, t.heightAt(px, pz) + STEP))
      camera.position.set(px, walk.feet + EYE, pz)
    }

    // ---- input → desired horizontal velocity
    let f = 0, r = 0
    if (keys.has('w') || keys.has('arrowup')) f += 1
    if (keys.has('s') || keys.has('arrowdown')) f -= 1
    if (keys.has('d')) r += 1
    if (keys.has('a')) r -= 1
    if (keys.has('arrowleft')) walk.yaw += 1.8 * dt
    if (keys.has('arrowright')) walk.yaw -= 1.8 * dt
    f += -walk.joy.y; r += walk.joy.x
    const len = Math.min(1.25, Math.hypot(f, r))
    const joyEdge = Math.hypot(walk.joy.x, walk.joy.y) > 0.95
    walk.gait = S.sprintLatch || joyEdge ? 'sprint' : keys.has('shift') ? 'run' : 'walk'
    const here = waterHere(walk.x, walk.z)
    const sub = here ? here.surface - walk.feet : 0
    const swimming = walk.water === 'swim'
    const base = swimming ? SWIM_SPEED[walk.gait] : SPEED[walk.gait] * (sub > WADE ? THREE.MathUtils.lerp(0.75, 0.45, Math.min(1, (sub - WADE) / 0.7)) : 1)
    const target = len > 0.05 ? base * walk.speedMul * Math.min(1, len) : 0
    const sx = Math.sin(walk.yaw), cz = Math.cos(walk.yaw)
    let wx = 0, wz = 0
    if (len > 0.05) {
      wx = ((-sx * f) + (cz * r)) / Math.hypot(f, r) * target
      wz = ((-cz * f) + (-sx * r)) / Math.hypot(f, r) * target
    }
    const accel = swimming ? 3 : walk.grounded ? 12 : 2.5
    walk.vx += (wx - walk.vx) * Math.min(1, accel * dt)
    walk.vz += (wz - walk.vz) * Math.min(1, accel * dt)

    // ---- jump (buffer + coyote time)
    if (walk.jumpPressed) { S.buffer = BUFFER; walk.jumpPressed = false }
    S.buffer = Math.max(0, S.buffer - dt)
    S.coyote = walk.grounded ? COYOTE : Math.max(0, S.coyote - dt)
    if (swimming && S.buffer > 0) { walk.vy = 3.2; S.buffer = 0 } // kick up: climb out over the edge
    else if (S.buffer > 0 && S.coyote > 0) { walk.vy = JUMP_V; walk.grounded = false; S.buffer = 0; S.coyote = 0; walk.onJump.forEach(cb => cb()) }

    // ---- horizontal move with wall sliding (knee + chest rays) and step-up
    const beforeX = walk.x, beforeZ = walk.z
    let mx = walk.vx * dt, mz = walk.vz * dt
    const md = Math.hypot(mx, mz)
    if (md > 1e-5) {
      for (const hy of [0.55, 1.35]) {
        const nn = probe.wall(walk.x, walk.feet + hy, walk.z, mx, mz, RADIUS + md, n)
        if (nn) {
          const into = mx * nn.x + mz * nn.z
          if (into < 0) { mx -= nn.x * into; mz -= nn.z * into }
        }
      }
      const hb = t.meta.widthM * 0.48, hd = t.meta.depthM * 0.48
      const tryMove = (x: number, z: number) => {
        if (Math.abs(x) > hb || Math.abs(z) > hd || houses.current(x, z)) return false
        const w = waterHere(x, z)
        const terrainY = w ? w.surface - w.depth : t.heightAt(x, z)
        // a swimmer can haul out over a coping up to 1.5 m above the feet
        if (swimming && terrainY - walk.feet < 1.5 && probe.ground(x, z, walk.feet + 2.4) < walk.feet + 1.5) return true
        if (walk.grounded && terrainY - walk.feet > STEP + 0.2 && terrainY - walk.feet > Math.hypot(x - walk.x, z - walk.z) * 1.2) return false // cliff
        const top = probe.ground(x, z, walk.feet + 2.4)
        return top <= walk.feet + (walk.grounded ? STEP : Math.max(STEP, walk.vy > 0 ? 0.9 : 0.25))
      }
      if (tryMove(walk.x + mx, walk.z + mz)) { walk.x += mx; walk.z += mz }
      else if (tryMove(walk.x + mx, walk.z)) walk.x += mx
      else if (tryMove(walk.x, walk.z + mz)) walk.z += mz
      else { walk.vx *= 0.2; walk.vz *= 0.2 }
    }

    // ---- vertical: support = terrain or a monument surface within step reach
    const w = waterHere(walk.x, walk.z)
    const terrainY = w ? w.surface - w.depth : t.heightAt(walk.x, walk.z)
    const solidY = probe.ground(walk.x, walk.z, walk.feet + STEP + 0.05)
    let support = Math.max(terrainY, solidY)
    if (walk.vy > 0) {
      const ceiling = probe.ceiling(walk.x, walk.z, walk.feet + 1.68, walk.vy * dt + 0.05)
      if (ceiling < Infinity) walk.vy = 0
    }
    // ---- water: swimmers float chest-deep (spring towards the float line); deep water lets you swim
    const prevWater = walk.water
    if (w && w.depth > SWIM && w.surface - walk.feet > SWIM - 0.05) walk.water = 'swim'
    else if (w && w.surface - walk.feet > 0.05) walk.water = 'wade'
    else walk.water = 'none'
    walk.waterY = w ? w.surface : 0
    if (walk.water === 'swim') {
      const floatY = w!.surface - FLOAT
      if (walk.vy <= 0 || walk.feet > floatY + 0.6) walk.vy += ((floatY - walk.feet) * 9 - walk.vy * 3.5) * dt
      else walk.vy -= GRAVITY * 0.5 * dt
      support = Math.min(support, floatY - 0.2)
    } else walk.vy -= GRAVITY * dt
    if (prevWater === 'none' && walk.water !== 'none' && w) {
      const k = Math.min(1, 0.3 + Math.max(0, -walk.vy) * 0.12)
      walk.onSplash.forEach((cb) => cb(k)); addRipple(walk.x, walk.z, k)
    }
    let feet = walk.feet + walk.vy * dt
    const wasAir = !walk.grounded
    if (walk.water === 'swim') {
      walk.grounded = false
      if (feet < support) feet = support
    } else if (feet <= support) {
      if (wasAir && walk.vy < -3) { S.dip = Math.min(0.22, -walk.vy * 0.03); walk.onLand.forEach((cb) => cb(-walk.vy)) }
      feet = support
      walk.vy = 0; walk.grounded = true
    } else if (walk.grounded && feet - support < 0.35 && walk.vy <= 0) {
      // walking down steps / slopes: stick to the ground
      feet = support; walk.vy = 0
    } else walk.grounded = false
    walk.feet = feet

    // ---- surface + footsteps
    walk.surface = walk.water !== 'none' ? 'water' : solidY >= terrainY - 0.05 && solidY > -Infinity ? 'stone' : onStreet(walk.x, walk.z) ? 'stone' : inCity(walk.x, walk.z, t) ? 'gravel' : 'grass'
    const hs = Math.hypot(walk.x - beforeX, walk.z - beforeZ) / Math.max(dt, 0.0001)
    walk.speed = hs; walk.moving = hs > 0.3
    if (walk.water === 'swim') {
      // a breaststroke every ~1.1 s while moving; slow treading bob when still
      const prev = S.stepPhase
      S.stepPhase += dt * (walk.moving ? 0.9 : 0.45)
      if (Math.floor(S.stepPhase) !== Math.floor(prev)) {
        if (walk.moving) walk.onStroke.forEach((cb) => cb())
        addRipple(walk.x, walk.z, walk.moving ? 0.6 : 0.25)
      }
      S.bob += dt * 2.2
    } else if (walk.grounded && walk.moving) {
      const cadence = 1.55 + hs * 0.32 // steps per second
      const prev = S.stepPhase
      S.stepPhase += dt * cadence
      if (Math.floor(S.stepPhase) !== Math.floor(prev)) {
        walk.onStep.forEach((cb) => cb(walk.surface, Math.min(1, 0.45 + hs / 8)))
        if (walk.water === 'wade') addRipple(walk.x, walk.z, 0.45)
      }
      S.bob += dt * cadence * Math.PI
    }

    // ---- camera
    S.dip *= Math.exp(-dt * 7)
    const bobAmp = walk.water === 'swim' ? 0.035 : walk.grounded && walk.moving ? Math.min(0.06, 0.018 + hs * 0.006) : 0
    const eyeY = walk.feet + EYE - S.dip + Math.sin(S.bob * 2) * bobAmp
    euler.set(walk.pitch, walk.yaw, 0)
    camera.quaternion.setFromEuler(euler)
    S.camDist += ((walk.view === 'third' ? 3.4 : 0) - S.camDist) * Math.min(1, dt * 6)
    back.set(0, 0, 1).applyQuaternion(camera.quaternion).multiplyScalar(S.camDist)
    if (S.camDist > 0.1) {
      n.set(walk.x, eyeY, walk.z)
      back.y += 0.35
      let maxBoom = probe.cameraDistance(n, back)
      // Also prevent the 3rd-person camera boom from passing inside CityGrid house volumes
      const totalLen = back.length()
      if (totalLen > 0.01) {
        for (let stepD = 0.4; stepD < maxBoom; stepD += 0.35) {
          const frac = stepD / totalLen
          if (houses.current(walk.x + back.x * frac, walk.z + back.z * frac)) {
            maxBoom = Math.max(0.2, stepD - 0.25)
            break
          }
        }
      }
      back.setLength(maxBoom)
    }
    camera.position.set(walk.x + back.x, eyeY + back.y, walk.z + back.z)
    // keep the third-person camera above ground
    const camGround = t.heightAt(camera.position.x, camera.position.z) + 0.3
    if (camera.position.y < camGround) camera.position.y = camGround
    walk.underwater = walk.water !== 'none' && camera.position.y < walk.waterY - 0.02
  })
  return null
}

let regionCache: { poly: Array<[number, number]> } | null = null
function inCity(x: number, z: number, t: ReturnType<typeof getTerrain>) {
  if (!t) return false
  if (!regionCache) regionCache = { poly: GRID.region.map(([la, lo]) => t.toLocal(la, lo)) }
  const poly = regionCache.poly
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

if (import.meta.env.DEV) (window as unknown as { __walk: typeof walk }).__walk = walk
