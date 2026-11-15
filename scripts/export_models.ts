/** Export procedural monuments to GLB (WebXR / Scene Viewer) and USDZ (iOS Quick Look) for the AR viewer.
 * Run: npx tsx scripts/export_models.ts */
import { writeFileSync } from 'node:fs'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js'
import { BUILDERS } from '../src/scene/generators/index.ts'

// minimal FileReader polyfill for GLTFExporter in Node
;(globalThis as any).FileReader = class {
  result: ArrayBuffer | string | null = null
  onloadend: (() => void) | null = null
  readAsArrayBuffer(b: Blob) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend?.() }) }
  readAsDataURL(b: Blob) { b.arrayBuffer().then((r) => { this.result = 'data:application/octet-stream;base64,' + Buffer.from(r).toString('base64'); this.onloadend?.() }) }
}

/** Bake InstancedMesh into plain meshes (USDZ + some AR viewers don't support instancing) and add a base plinth. */
function bake(src: THREE.Group, scale: number) {
  const out = new THREE.Group()
  src.updateMatrixWorld(true)
  src.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mat = (m.material as THREE.MeshStandardMaterial).clone()
    mat.vertexColors = false
    if ((m as THREE.InstancedMesh).isInstancedMesh && (m as THREE.InstancedMesh).count > 200) return // seat blocks: rows already modelled
    if ((m as THREE.InstancedMesh).isInstancedMesh) {
      const im = m as THREE.InstancedMesh, tmp = new THREE.Matrix4()
      const parts: THREE.BufferGeometry[] = []
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, tmp)
        parts.push(im.geometry.clone().applyMatrix4(tmp.premultiply(im.matrixWorld)))
        tmp.identity()
      }
      for (const g of parts) { g.deleteAttribute('color'); out.add(new THREE.Mesh(g, mat)) }
    } else {
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld)
      g.deleteAttribute('color')
      out.add(new THREE.Mesh(g, mat))
    }
  })
  // cut away the buried foundation for a clean tabletop model
  out.scale.setScalar(scale)
  return out
}

async function main() {
  const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js')
  const jobs = [{ id: 'theatre', builder: 'theatre', scale: 0.01 }]
  for (const j of jobs) {
    const baked = bake(BUILDERS[j.builder](), j.scale)
    // merge per material colour to keep the file small
    const byColor = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>()
    baked.children.forEach((c) => {
      const m = c as THREE.Mesh, key = (m.material as THREE.MeshStandardMaterial).color.getHexString()
      const e = byColor.get(key) ?? { mat: m.material as THREE.Material, geos: [] }
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k)
      e.geos.push(g); byColor.set(key, e)
    })
    const scene = new THREE.Scene()
    const root = new THREE.Group(); root.scale.setScalar(j.scale)
    byColor.forEach(({ mat, geos }) => root.add(new THREE.Mesh(mergeGeometries(geos), mat)))
    scene.add(root)
    const glb = await new GLTFExporter().parseAsync(scene, { binary: true }) as ArrayBuffer
    writeFileSync(`public/models/${j.id}.glb`, Buffer.from(glb))
    const usdz = await new USDZExporter().parseAsync(scene)
    writeFileSync(`public/models/${j.id}.usdz`, Buffer.from(usdz))
    console.log(j.id, (glb.byteLength / 1e6).toFixed(2), 'MB glb', (usdz.byteLength / 1e6).toFixed(2), 'MB usdz')
  }
}
main()
