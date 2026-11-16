import * as THREE from 'three'

/** Oriented footprints of the detailed monument models, registered by City and used to keep
 * generic city houses off them. */
export interface Footprint { id: string; built: number; until?: number; contains: (x: number, z: number, pad?: number) => boolean }
export const MONUMENT_FOOTPRINTS: Footprint[] = []

export function registerFootprint(localBox: THREE.Box3, x: number, z: number, yaw: number, id = '', built = -1e4, until?: number) {
  const prev = MONUMENT_FOOTPRINTS.findIndex((f) => id && f.id === id)
  if (prev >= 0) MONUMENT_FOOTPRINTS.splice(prev, 1)
  const c = Math.cos(-yaw), s = Math.sin(-yaw)
  MONUMENT_FOOTPRINTS.push({
    id, built, until,
    contains: (px, pz, pad = 0) => {
      const dx = px - x, dz = pz - z
      // rotate into the model's local frame (inverse of rotation.y = yaw)
      const lx = dx * c + dz * s, lz = -dx * s + dz * c
      return lx >= localBox.min.x - pad && lx <= localBox.max.x + pad && lz >= localBox.min.z - pad && lz <= localBox.max.z + pad
    },
  })
}

/** gates are walked through; every other standing monument is solid for the crowd */
const PASSABLE = new Set(['frontinus-gate', 'byzantine-gate-n', 'south-gate', 'frontinus-street'])
/** year = null: every monument (explore and tour show them all) */
export function solidMonumentAt(x: number, z: number, year: number | null, pad = 0.6) {
  for (const f of MONUMENT_FOOTPRINTS) {
    if (PASSABLE.has(f.id) || (year !== null && (year < f.built || (f.until !== undefined && year > f.until)))) continue
    if (f.contains(x, z, pad)) return true
  }
  return false
}
