import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getTerrain } from './terrainData'
import { flyTo, isFlying, killFlight, rig } from './camera'
import { useApp } from '../store'

const keys = new Set<string>()
const NAV_KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', '=', '+', '-', '_', 'r', 'f'])

function typing(e: Event) {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}

/** Keyboard + double-click navigation, bounds and ground clearance for the orbit camera. */
export function Navigation() {
  const mode = useApp((s) => s.mode)
  const { gl, scene, camera } = useThree()
  const ray = useMemo(() => new THREE.Raycaster(), [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      const m = useApp.getState().mode
      if (m === 'tour' || m === 'intro') return
      // in plan mode the arrow keys move the map too; space/arrows stay with the tour elsewhere
      if (NAV_KEYS.has(k)) { keys.add(k); killFlight(); if (k.startsWith('arrow')) e.preventDefault() }
    }
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase())
    const blur = () => keys.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
  }, [])

  // stop scripted flights as soon as the user grabs the camera
  useEffect(() => {
    const ctl = rig.controls
    if (!ctl) return
    const onStart = () => { if (useApp.getState().mode !== 'tour') killFlight() }
    ctl.addEventListener('start', onStart)
    return () => ctl.removeEventListener('start', onStart)
  }, [mode])

  // double-click on the ground: glide there (closer), keeping the current viewing angle
  useEffect(() => {
    const el = gl.domElement
    const dbl = (e: MouseEvent) => {
      const m = useApp.getState().mode
      if (m === 'tour' || m === 'intro' || !rig.controls) return
      const r = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const terrain = scene.getObjectByName('terrain')
      const hit = terrain && ray.intersectObject(terrain, false)[0]
      if (!hit) return
      const ctl = rig.controls
      const offset = camera.position.clone().sub(ctl.target)
      const dist = offset.length()
      const nd = THREE.MathUtils.clamp(dist * 0.55, 90, dist)
      offset.setLength(nd)
      const to = hit.point.clone()
      void flyTo(to.clone().add(offset).toArray(), to.toArray(), 1.4)
    }
    el.addEventListener('dblclick', dbl)
    return () => el.removeEventListener('dblclick', dbl)
  }, [gl, scene, camera, ray])

  const fwd = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  const move = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, rawDt) => {
    const ctl = rig.controls, t = getTerrain()
    if (!ctl || !t) return
    const dt = Math.min(rawDt, 0.1)
    const cam = camera
    const offset = cam.position.clone().sub(ctl.target)
    const dist = offset.length()

    if (keys.size) {
      // ground-plane axes relative to where the camera looks
      fwd.set(-offset.x, 0, -offset.z)
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1).applyQuaternion(cam.quaternion).setY(0)
      fwd.normalize()
      right.crossVectors(fwd, THREE.Object3D.DEFAULT_UP).normalize()
      move.set(0, 0, 0)
      if (keys.has('w') || keys.has('arrowup')) move.add(fwd)
      if (keys.has('s') || keys.has('arrowdown')) move.sub(fwd)
      if (keys.has('d') || keys.has('arrowright')) move.add(right)
      if (keys.has('a') || keys.has('arrowleft')) move.sub(right)
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(Math.max(40, dist * 0.9) * dt)
        cam.position.add(move); ctl.target.add(move)
      }
      const rot = (keys.has('q') ? 1 : 0) - (keys.has('e') ? 1 : 0)
      if (rot) {
        offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, rot * 1.1 * dt)
        cam.position.copy(ctl.target).add(offset)
      }
      const zoom = (keys.has('=') || keys.has('+') || keys.has('r') ? -1 : 0) + (keys.has('-') || keys.has('_') || keys.has('f') ? 1 : 0)
      if (zoom) {
        const nd = THREE.MathUtils.clamp(dist * Math.exp(zoom * 1.4 * dt), ctl.minDistance, ctl.maxDistance)
        cam.position.copy(ctl.target).add(offset.setLength(nd))
      }
      ctl.update()
    }

    if (isFlying()) return
    // keep the pivot inside the model and on the ground
    const hx = t.meta.widthM * 0.46, hz = t.meta.depthM * 0.46
    const tx = THREE.MathUtils.clamp(ctl.target.x, -hx, hx), tz = THREE.MathUtils.clamp(ctl.target.z, -hz, hz)
    if (tx !== ctl.target.x || tz !== ctl.target.z) {
      const d = new THREE.Vector3(tx - ctl.target.x, 0, tz - ctl.target.z)
      ctl.target.add(d); cam.position.add(d)
    }
    const gy = t.heightAt(ctl.target.x, ctl.target.z)
    const dy = (gy - ctl.target.y) * Math.min(1, dt * 3)
    if (Math.abs(dy) > 0.01) { ctl.target.y += dy; cam.position.y += dy }
    // never go underground
    const minY = t.heightAt(cam.position.x, cam.position.z) + 12
    if (cam.position.y < minY) cam.position.y = minY
  })
  return null
}
