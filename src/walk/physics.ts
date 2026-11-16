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
  private cells = new Map<string, Entry[]>()
  private ray = new THREE.Raycaster()
  private hits: THREE.Intersection[] = []
  private v = new THREE.Vector3()
  private d = new THREE.Vector3()

  constructor() { (this.ray as unknown as { firstHitOnly: boolean }).firstHitOnly = true }

  refresh(scene: THREE.Scene) {
    this.entries = []
    const roots = [scene.getObjectByName('city-root'), scene.getObjectByName('ruins-solid'), scene.getObjectByName('walk-streets')].filter(Boolean) as THREE.Object3D[]
    for (const root of roots) {
      root.updateWorldMatrix(true, true)
      root.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || !m.geometry || m.userData.noCollide) return
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
    this.cells.clear()
  }

  /** Reuse broad-phase candidates across crowd members in the same 32 m cell.
   * The cell half-diagonal keeps queries near its edges conservative. */
  private nearby(x: number, z: number) {
    const gx = Math.floor(x / 32), gz = Math.floor(z / 32), key = `${gx},${gz}`
    const cached = this.cells.get(key)
    if (cached) return cached
    const cx = gx * 32 + 16, cz = gz * 32 + 16
    const entries = this.entries.filter(e =>
      Math.hypot(e.sphere.center.x - cx, e.sphere.center.z - cz) < e.sphere.radius + 60 + Math.SQRT2 * 16)
    if (this.cells.size >= 128) this.cells.delete(this.cells.keys().next().value!)
    this.cells.set(key, entries)
    return entries
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

  /** Head clearance for jumping beneath balconies and porticoes. */
  ceiling(x: number, z: number, headY: number, rise: number) {
    this.v.set(x, headY, z); this.d.set(0, 1, 0)
    const hit = this.cast(this.v, this.d, rise, x, z)
    return hit ? hit.point.y : Infinity
  }

  /** Clip a third-person camera boom before it passes through solid geometry. */
  cameraDistance(origin: THREE.Vector3, offset: THREE.Vector3) {
    const distance = offset.length()
    if (distance < 0.001) return 0
    this.d.copy(offset).normalize()
    const hit = this.cast(origin, this.d, distance, origin.x, origin.z)
    return hit ? Math.max(0, hit.distance - 0.2) : distance
  }

  /** horizontal obstacle within `dist` along (dx, dz) at height y; returns the world normal or null */
  wall(x: number, y: number, z: number, dx: number, dz: number, dist: number, out: THREE.Vector3) {
    const len = Math.hypot(dx, dz)
    if (len < 1e-6) return null
    this.v.set(x, y, z); this.d.set(dx / len, 0, dz / len)
    const h = this.cast(this.v, this.d, dist, x, z)
    if (!h || !h.face) return null
    out.copy(h.face.normal)
    if (h.instanceId !== undefined && h.object instanceof THREE.InstancedMesh) {
      const instance = new THREE.Matrix4()
      h.object.getMatrixAt(h.instanceId, instance)
      out.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(instance))
    }
    out.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(h.object.matrixWorld))
    out.y = 0
    if (out.lengthSq() < 1e-4) out.set(-this.d.x, 0, -this.d.z)
    return out.normalize()
  }
}
