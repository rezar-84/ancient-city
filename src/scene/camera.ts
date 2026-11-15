import gsap from 'gsap'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

/** Module-level handles so UI code can drive the camera. */
export const rig: { camera: THREE.PerspectiveCamera | null; controls: OrbitControlsImpl | null } = {
  camera: null,
  controls: null,
}

// time-based flights even if frames stall (no lag smoothing)
gsap.ticker.lagSmoothing(0)

let tl: gsap.core.Timeline | null = null

export function killFlight() { tl?.kill(); tl = null }

/** Smoothly fly camera to `pos` looking at `target`. Arcs upward on long flights. */
export function flyTo(pos: THREE.Vector3Tuple, target: THREE.Vector3Tuple, duration = 2.4): Promise<void> {
  const cam = rig.camera, ctl = rig.controls
  if (!cam || !ctl) return Promise.resolve()
  killFlight()
  const from = cam.position.clone(), fromT = ctl.target.clone()
  const to = new THREE.Vector3(...pos), toT = new THREE.Vector3(...target)
  const dist = from.distanceTo(to)
  const lift = Math.min(dist * 0.35, 600)
  const p = { t: 0 }
  return new Promise((resolve) => {
    tl = gsap.timeline({ onComplete: () => resolve() })
    tl.to(p, {
      t: 1, duration, ease: 'power2.inOut',
      onUpdate: () => {
        const t = p.t
        cam.position.lerpVectors(from, to, t)
        cam.position.y += Math.sin(Math.PI * t) * lift
        ctl.target.lerpVectors(fromT, toT, t)
        ctl.update()
      },
    })
  })
}

/** Camera position looking at target from a compass bearing (deg, 0 = from south), elevation (deg) and distance (m). */
export function orbitPose(target: THREE.Vector3Tuple, bearingDeg: number, elevDeg: number, dist: number): THREE.Vector3Tuple {
  const b = THREE.MathUtils.degToRad(bearingDeg), e = THREE.MathUtils.degToRad(elevDeg)
  return [
    target[0] + Math.sin(b) * Math.cos(e) * dist,
    target[1] + Math.sin(e) * dist,
    target[2] + Math.cos(b) * Math.cos(e) * dist,
  ]
}

if (import.meta.env.DEV) (window as unknown as { __rig: typeof rig }).__rig = rig
