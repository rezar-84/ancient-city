import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useApp } from '../store'
import { getTerrain } from '../scene/terrainData'
import { rig } from '../scene/camera'
import { MONUMENT_FOOTPRINTS } from '../scene/footprints'
import { GRID_AXES, HOUSE_RECTS } from '../scene/CityGrid'
import { CHARACTERS } from '../content/characters'

const EYE = 1.65, WALK = 2.6, RUN = 6.5, RADIUS = 0.45

/** shared walk state (read by the HUD) */
export const walk = {
  yaw: 0, pitch: 0, x: 0, z: 0, moving: false,
  /** virtual joystick (mobile), -1..1 */
  joy: { x: 0, y: 0 },
  locked: false,
}

const keys = new Set<string>()

/** spatial hash of house rects for cheap collision tests */
function buildHash() {
  const cell = 24, map = new Map<string, number[]>()
  HOUSE_RECTS.forEach((r, i) => {
    const ext = Math.max(r.hu, r.hv)
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

/** First-person movement for walk mode: pointer-lock mouse look (desktop) or touch look +
 *  joystick (mobile), WASD/arrows, Shift to run, terrain following and collisions. */
export function WalkControls() {
  const mode = useApp((s) => s.mode)
  const character = useApp((s) => s.character)
  const showGrid = useApp((s) => s.showGrid)
  const { camera, gl } = useThree()
  const blocked = useRef<(x: number, z: number) => boolean>(() => false)
  const bob = useRef(0)
  const active = mode === 'walk'

  // rebuild the collision hash whenever the city layer appears
  useEffect(() => {
    if (!active) return
    const id = window.setTimeout(() => {
      const houses = buildHash()
      blocked.current = (x, z) => houses(x, z) || MONUMENT_FOOTPRINTS.some((f) => f.contains(x, z, RADIUS))
      // never start (or get stuck) inside a building: spiral out to the nearest free spot
      if (blocked.current(walk.x, walk.z)) {
        search: for (let r = 2; r <= 60; r += 2) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
          const x = walk.x + Math.cos(a) * r, z = walk.z + Math.sin(a) * r
          if (!blocked.current(x, z)) { walk.x = x; walk.z = z; break search }
        }
      }
    }, 300)
    return () => window.clearTimeout(id)
  }, [active, showGrid])

  // enter / leave: spawn, camera settings, orbit controls off
  useEffect(() => {
    if (!active) return
    const cam = camera as THREE.PerspectiveCamera
    const t = getTerrain(), c = CHARACTERS.find((x) => x.id === character) ?? CHARACTERS[2]
    if (!t) return
    const [x, z] = t.toLocal(c.spawn.lat, c.spawn.lon)
    walk.x = x; walk.z = z
    // heading: 0 = north (-z), clockwise; camera yaw: rotation about +y, 0 looks -z
    walk.yaw = -THREE.MathUtils.degToRad(c.spawn.heading); walk.pitch = 0
    const prev = { fov: cam.fov, near: cam.near }
    cam.fov = 68; cam.near = 0.1; cam.updateProjectionMatrix()
    if (rig.controls) rig.controls.enabled = false
    return () => {
      cam.fov = prev.fov; cam.near = prev.near; cam.updateProjectionMatrix()
      cam.rotation.order = 'XYZ'
      if (rig.controls) rig.controls.enabled = true
      if (document.pointerLockElement) void document.exitPointerLock()
      keys.clear(); walk.joy.x = walk.joy.y = 0
    }
  }, [active, character, camera])

  // input
  useEffect(() => {
    if (!active) return
    const el = gl.domElement
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      keys.add(e.key.toLowerCase())
      if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault()
    }
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase())
    const blur = () => keys.clear()
    const click = () => { if (!document.pointerLockElement && window.matchMedia('(pointer: fine)').matches) void el.requestPointerLock() }
    const lockChange = () => { walk.locked = document.pointerLockElement === el }
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return
      walk.yaw -= e.movementX * 0.0022
      walk.pitch = THREE.MathUtils.clamp(walk.pitch - e.movementY * 0.0022, -1.2, 1.2)
    }
    // touch look: drag anywhere outside the joystick
    let touchId: number | null = null, lx = 0, ly = 0
    const ts = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if ((t.target as HTMLElement).closest('[data-joystick]')) continue
        if (touchId === null) { touchId = t.identifier; lx = t.clientX; ly = t.clientY }
      }
    }
    const tm = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) if (t.identifier === touchId) {
        walk.yaw -= (t.clientX - lx) * 0.005
        walk.pitch = THREE.MathUtils.clamp(walk.pitch - (t.clientY - ly) * 0.004, -1.1, 1.1)
        lx = t.clientX; ly = t.clientY
      }
    }
    const te = (e: TouchEvent) => { for (const t of Array.from(e.changedTouches)) if (t.identifier === touchId) touchId = null }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur)
    el.addEventListener('click', click); document.addEventListener('pointerlockchange', lockChange); document.addEventListener('mousemove', move)
    el.addEventListener('touchstart', ts, { passive: true }); el.addEventListener('touchmove', tm, { passive: true }); el.addEventListener('touchend', te)
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur)
      el.removeEventListener('click', click); document.removeEventListener('pointerlockchange', lockChange); document.removeEventListener('mousemove', move)
      el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', te)
    }
  }, [active, gl])

  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])
  useFrame((_, rawDt) => {
    if (!active) return
    const t = getTerrain()
    if (!t) return
    const dt = Math.min(rawDt, 0.08)
    let f = 0, r = 0
    if (keys.has('w') || keys.has('arrowup')) f += 1
    if (keys.has('s') || keys.has('arrowdown')) f -= 1
    if (keys.has('d')) r += 1
    if (keys.has('a')) r -= 1
    if (keys.has('arrowleft')) walk.yaw += 1.8 * dt
    if (keys.has('arrowright')) walk.yaw -= 1.8 * dt
    f += -walk.joy.y; r += walk.joy.x
    const len = Math.hypot(f, r)
    walk.moving = len > 0.05
    if (walk.moving) {
      const speed = (keys.has('shift') || len > 1.3 ? RUN : WALK) * Math.min(1, len)
      const sx = Math.sin(walk.yaw), cz = Math.cos(walk.yaw)
      // forward = (-sin yaw, -cos yaw); right = (cos yaw, -sin yaw)
      const dx = ((-sx * f) + (cz * r)) / Math.max(1, len) * speed * dt
      const dz = ((-cz * f) + (-sx * r)) / Math.max(1, len) * speed * dt
      const hb = t.meta.widthM * 0.48, hd = t.meta.depthM * 0.48
      const nx = THREE.MathUtils.clamp(walk.x + dx, -hb, hb), nz = THREE.MathUtils.clamp(walk.z + dz, -hd, hd)
      // too steep? (> ~40° over one step)
      const h0 = t.heightAt(walk.x, walk.z)
      const steep = (x: number, z: number) => Math.abs(t.heightAt(x, z) - h0) > Math.max(0.6, Math.hypot(x - walk.x, z - walk.z) * 0.85)
      if (!blocked.current(nx, walk.z) && !steep(nx, walk.z)) walk.x = nx
      if (!blocked.current(walk.x, nz) && !steep(walk.x, nz)) walk.z = nz
      bob.current += dt * (speed > WALK ? 13 : 8.5)
    }
    const ground = t.heightAt(walk.x, walk.z)
    const targetY = ground + EYE + (walk.moving ? Math.sin(bob.current) * 0.035 : 0)
    camera.position.x = walk.x; camera.position.z = walk.z
    camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 12)
    euler.set(walk.pitch, walk.yaw, 0)
    camera.quaternion.setFromEuler(euler)
  })
  return null
}
