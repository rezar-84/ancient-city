import * as THREE from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'

// BVH-accelerated raycasts for every mesh (also speeds up pin picking)
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast


interface Entry { mesh: THREE.Mesh; sphere: THREE.Sphere }

function shown(o: THREE.Object3D | null): boolean {
  for (let p = o; p; p = p.parent) if (!p.visible) return false
  return true
}

/**
 * Queries against the solid monument geometry (everything under "city-root", plus the raised ruin
 * masses). Ground probes give the walkable surface under a point (podiums, steps, theatre seats);
 * wall probes give the hit normal of anything in the way so the walker can slide along it.
 */
export class WorldProbe {
  private entries: Entry[] = []
  private near: Entry[] = []
  private ray = new THREE.Raycaster()
  private hits: THREE.Intersection[] = []
  private v = new THREE.Vector3()
  private d = new THREE.Vector3()
  private lastNear = new THREE.Vector2(1e9, 1e9)

  constructor() { (this.ray as unknown as { firstHitOnly: boolean }).firstHitOnly = true }

  refresh(scene: THREE.Scene) {
    this.entries = []
    const roots = [scene.getObjectByName('city-root'), scene.getObjectByName('ruins-solid')].filter(Boolean) as THREE.Object3D[]
    for (const root of roots) {
      root.updateWorldMatrix(true, true)
      root.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || !m.geometry) return
        const g = m.geometry
        if (!g.boundingSphere) g.computeBoundingSphere()
        if (!(m as THREE.InstancedMesh).isInstancedMesh && !g.boundsTree && g.attributes.position.count > 60) g.computeBoundsTree()
        let sphere: THREE.Sphere
        if ((m as THREE.InstancedMesh).isInstancedMesh) {
          const im = m as THREE.InstancedMesh
          if (!im.boundingSphere) im.computeBoundingSphere()
          sphere = im.boundingSphere!.clone().applyMatrix4(m.matrixWorld)
        } else sphere = g.boundingSphere!.clone().applyMatrix4(m.matrixWorld)
        this.entries.push({ mesh: m, sphere })
      })
    }
    this.lastNear.set(1e9, 1e9)
  }

  /** keep a short list of meshes within ~60 m (rebuilt when the walker moves 10 m) */
  private nearby(x: number, z: number) {
    if (Math.hypot(x - this.lastNear.x, z - this.lastNear.y) > 10) {
      this.near = this.entries.filter((e) => Math.hypot(e.sphere.center.x - x, e.sphere.center.z - z) < e.sphere.radius + 60)
      this.lastNear.set(x, z)
    }
    return this.near
  }

  private cast(origin: THREE.Vector3, dir: THREE.Vector3, far: number, x: number, z: number) {
    this.ray.set(origin, dir); this.ray.far = far
    let best: THREE.Intersection | null = null
    for (const e of this.nearby(x, z)) {
      if (!shown(e.mesh)) continue
      this.hits.length = 0
      e.mesh.raycast(this.ray, this.hits)
      for (const h of this.hits) if (!best || h.distance < best.distance) best = h
    }
    return best
  }

  /** highest solid surface under (x, z) that is at or below `fromY`; -Infinity if none */
  ground(x: number, z: number, fromY: number) {
    this.v.set(x, fromY, z); this.d.set(0, -1, 0)
    const h = this.cast(this.v, this.d, 40, x, z)
    return h ? h.point.y : -Infinity
  }

  /** horizontal obstacle within `dist` along (dx, dz) at height y; returns the world normal or null */
  wall(x: number, y: number, z: number, dx: number, dz: number, dist: number, out: THREE.Vector3) {
    const len = Math.hypot(dx, dz)
    if (len < 1e-6) return null
    this.v.set(x, y, z); this.d.set(dx / len, 0, dz / len)
    const h = this.cast(this.v, this.d, dist, x, z)
    if (!h || !h.face) return null
    out.copy(h.face.normal).transformDirection(h.object.matrixWorld)
    out.y = 0
    if (out.lengthSq() < 1e-4) out.set(-this.d.x, 0, -this.d.z)
    return out.normalize()
  }
}
