/** Dev helper: window.__captureRenders() jumps the camera to every landmark view, renders and saves a JPEG
 * to public/renders/<id>.jpg (and <id>-2.jpg from a second angle) via the dev server. */
import * as THREE from 'three'
import { LANDMARKS } from '../content/landmarks'
import { getTerrain } from './terrainData'
import { orbitPose, rig } from './camera'
import { useApp } from '../store'

export const capturePipeline: { render: (() => void) | null; busy: boolean } = { render: null, busy: false }

type GL = THREE.WebGLRenderer
export function installCapture(gl: GL, scene: THREE.Scene) {
  if (!import.meta.env.DEV) return
  ;(window as unknown as { __benchmark: () => Promise<unknown> }).__benchmark = async () => {
    const frames: number[] = []
    let previous = performance.now()
    const start = previous
    await new Promise<void>(resolve => {
      const sample = (now: number) => {
        frames.push(now - previous); previous = now
        if (now - start < 20000) requestAnimationFrame(sample)
        else resolve()
      }
      requestAnimationFrame(sample)
    })
    frames.sort((a, b) => a - b)
    return {
      medianMs: frames[Math.floor(frames.length * 0.5)],
      p95Ms: frames[Math.floor(frames.length * 0.95)],
      frames: frames.length, dpr: gl.getPixelRatio(),
      render: { ...gl.info.render }, memory: { ...gl.info.memory },
      note: 'Render counters represent the latest pass; frame timings include the complete pipeline.',
    }
  }
  ;(window as unknown as { __captureRenders: () => Promise<string[]> }).__captureRenders = async () => {
    const t = getTerrain(), cam = rig.camera, ctl = rig.controls
    if (!t || !cam || !ctl || capturePipeline.busy) return []
    capturePipeline.busy = true
    const position = cam.position.clone(), target = ctl.target.clone(), autoRotate = ctl.autoRotate
    const selected = useApp.getState().selected
    ctl.autoRotate = false
    const done: string[] = []
    useApp.getState().select(null)
    const W = 1280, H = 800
    const prevSize = gl.getSize(new THREE.Vector2()), prevDpr = gl.getPixelRatio(), prevAspect = cam.aspect
    try {
    gl.setPixelRatio(1); gl.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix()
    for (const l of LANDMARKS) {
      if (!l.builder) continue
      const [x, z] = t.toLocal(l.lat, l.lon)
      const target: [number, number, number] = [x, t.heightAt(x, z) + 6, z]
      const v = l.view ?? { bearing: 200, elev: 30, dist: 200 }
      for (const [suffix, b, e, d] of [['', v.bearing, v.elev, v.dist * 0.85], ['-2', v.bearing + 110, v.elev + 12, v.dist * 1.1]] as const) {
        cam.position.set(...orbitPose(target, b, e, d)); ctl.target.set(...target); ctl.update()
        cam.lookAt(...target)
        // Allow frame callbacks to update shadows and resize the postprocessing buffers.
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
        if (capturePipeline.render) capturePipeline.render()
        else gl.render(scene, cam)
        const url = gl.domElement.toDataURL('image/jpeg', 0.86)
        const response = await fetch(`/__save-render?id=${l.id}${suffix}`, { method: 'POST', body: url })
        if (!response.ok) throw new Error(`Capture failed: ${response.status}`)
        done.push(l.id + suffix)
      }
    }
    return done
    } finally {
    gl.setPixelRatio(prevDpr); gl.setSize(prevSize.x, prevSize.y, false); cam.aspect = prevAspect; cam.updateProjectionMatrix()
    cam.position.copy(position); ctl.target.copy(target); ctl.autoRotate = autoRotate; ctl.update()
    useApp.getState().select(selected)
    capturePipeline.busy = false
    }
  }
}
