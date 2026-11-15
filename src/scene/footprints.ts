import * as THREE from 'three'

/** Oriented footprints of the detailed monument models, registered by City and used to keep
 * generic city houses off them. */
export interface Footprint { contains: (x: number, z: number, pad?: number) => boolean }
export const MONUMENT_FOOTPRINTS: Footprint[] = []

export function registerFootprint(localBox: THREE.Box3, x: number, z: number, yaw: number) {
  const c = Math.cos(-yaw), s = Math.sin(-yaw)
  MONUMENT_FOOTPRINTS.push({
    contains: (px, pz, pad = 0) => {
      const dx = px - x, dz = pz - z
      // rotate into the model's local frame (inverse of rotation.y = yaw)
      const lx = dx * c + dz * s, lz = -dx * s + dz * c
      return lx >= localBox.min.x - pad && lx <= localBox.max.x + pad && lz >= localBox.min.z - pad && lz <= localBox.max.z + pad
    },
  })
}
