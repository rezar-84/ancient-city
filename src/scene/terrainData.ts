/** Loads the baked terrain (public/terrain) and exposes metric helpers.
 * Local frame: 1 unit = 1 m, origin = bbox centre, +X east, -Z north, Y = elevation - minH. */
export interface TerrainMeta {
  bbox: { s: number; n: number; w: number; e: number }
  lat0: number; lon0: number; grid: number
  widthM: number; depthM: number; minH: number; maxH: number
  mPerDegLon: number; mPerDegLat: number; credits: string
}
export interface Terrain {
  meta: TerrainMeta
  heights: Float32Array
  /** Exact height on the rendered terrain triangles at local x,z. */
  heightAt: (x: number, z: number) => number
  toLocal: (lat: number, lon: number) => [number, number]
  toLatLon: (x: number, z: number) => [number, number]
}

/** PlaneGeometry splits a grid cell along the h10–h01 diagonal. */
export function terrainCellHeight(h00: number, h10: number, h01: number, h11: number, u: number, v: number) {
  return u + v <= 1
    ? h00 + (h10 - h00) * u + (h01 - h00) * v
    : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v)
}

let promise: Promise<Terrain> | null = null
let cached: Terrain | null = null

export function getTerrain(): Terrain | null { return cached }

export function loadTerrain(): Promise<Terrain> {
  if (promise) return promise
  promise = (async () => {
    const [meta, buf] = await Promise.all([
      fetch('/terrain/meta.json').then((r) => r.json() as Promise<TerrainMeta>),
      fetch('/terrain/height.bin').then((r) => r.arrayBuffer()),
    ])
    const heights = new Float32Array(buf)
    const g = meta.grid
    const heightAt = (x: number, z: number) => {
      const u = (x / meta.widthM + 0.5) * (g - 1)
      const v = (z / meta.depthM + 0.5) * (g - 1)
      const i = Math.min(Math.max(Math.floor(u), 0), g - 2)
      const j = Math.min(Math.max(Math.floor(v), 0), g - 2)
      const fu = Math.min(Math.max(u - i, 0), 1), fv = Math.min(Math.max(v - j, 0), 1)
      const h00 = heights[j * g + i], h10 = heights[j * g + i + 1]
      const h01 = heights[(j + 1) * g + i], h11 = heights[(j + 1) * g + i + 1]
      const h = terrainCellHeight(h00, h10, h01, h11, fu, fv)
      return h - meta.minH
    }
    const toLocal = (lat: number, lon: number): [number, number] => [
      (lon - meta.lon0) * meta.mPerDegLon,
      -(lat - meta.lat0) * meta.mPerDegLat,
    ]
    const toLatLon = (x: number, z: number): [number, number] => [
      meta.lat0 - z / meta.mPerDegLat,
      meta.lon0 + x / meta.mPerDegLon,
    ]
    cached = { meta, heights, heightAt, toLocal, toLatLon }
    return cached
  })()
  return promise
}
