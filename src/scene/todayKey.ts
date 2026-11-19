/** Referrer-restricted browser key for Google Photorealistic 3D Tiles (kept out of the lazy tiles chunk so
 *  the UI can know whether the Today view exists without loading 3d-tiles-renderer). */
export const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined
export const hasTodayTiles = !!KEY

export type TodayAttribution = { logo: string | null; text: string }
let getter: (() => TodayAttribution) | null = null
/** Registered by the lazy TodayTiles chunk once it loads. */
export function registerTodayAttribution(fn: () => TodayAttribution) { getter = fn }
export function readTodayAttribution(): TodayAttribution { return getter ? getter() : { logo: null, text: '' } }
