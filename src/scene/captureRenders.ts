/** Dev helper: window.__captureRenders() jumps the camera to every landmark view, renders and saves a JPEG
 * to public/renders/<id>.jpg (and <id>-2.jpg from a second angle) via the dev server. */
import * as THREE from 'three'
import { LANDMARKS } from '../content/landmarks'
import { getTerrain } from './terrainData'
import { orbitPose, rig } from './camera'
import { useApp } from '../store'

type GL = THREE.WebGLRenderer
export function installCapture(gl: GL, scene: THREE.Scene) {
  if (!import.meta.env.DEV) return
  ;(window as unknown as { __captureRenders: () => Promise<string[]> }).__captureRenders = async () => {
    const t = getTerrain(), cam = rig.camera, ctl = rig.controls
    if (!t || !cam || !ctl) return []
    const done: string[] = []
    useApp.getState().select(null)
    const W = 1280, H = 800
    const prevSize = gl.getSize(new THREE.Vector2()), prevDpr = gl.getPixelRatio(), prevAspect = cam.aspect
    gl.setPixelRatio(1); gl.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix()
    for (const l of LANDMARKS) {
      if (!l.builder) continue
      const [x, z] = t.toLocal(l.lat, l.lon)
      const target: [number, number, number] = [x, t.heightAt(x, z) + 6, z]
      const v = l.view ?? { bearing: 200, elev: 30, dist: 200 }
      for (const [suffix, b, e, d] of [['', v.bearing, v.elev, v.dist * 0.85], ['-2', v.bearing + 110, v.elev + 12, v.dist * 1.1]] as const) {
        cam.position.set(...orbitPose(target, b, e, d)); ctl.target.set(...target); ctl.update()
        cam.lookAt(...target)
        gl.render(scene, cam); gl.render(scene, cam)
        const url = gl.domElement.toDataURL('image/jpeg', 0.86)
        await fetch(`/__save-render?id=${l.id}${suffix}`, { method: 'POST', body: url })
        done.push(l.id + suffix)
      }
    }
    gl.setPixelRatio(prevDpr); gl.setSize(prevSize.x, prevSize.y, false); cam.aspect = prevAspect; cam.updateProjectionMatrix()
    return done
  }
}
