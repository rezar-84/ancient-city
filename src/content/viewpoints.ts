import type { L10n } from './types'

/** One-click camera views. at = [lat, lon] of the look-at point. */
export interface Viewpoint { id: string; label: L10n; at: [number, number]; bearing: number; elev: number; dist: number; lift?: number }

export const VIEWPOINTS: Viewpoint[] = [
  { id: 'overview', label: { en: 'City overview', tr: 'Kentin geneli' }, at: [37.9282, 29.1258], bearing: 235, elev: 32, dist: 1350 },
  { id: 'pamukkale', label: { en: 'Pamukkale terraces', tr: 'Pamukkale travertenleri' }, at: [37.9232, 29.1218], bearing: 258, elev: 9, dist: 1050, lift: 40 },
  { id: 'pamukkale-top', label: { en: 'Terraces from above', tr: 'Travertenler yukarıdan' }, at: [37.9226, 29.1222], bearing: 300, elev: 48, dist: 650 },
  { id: 'plateia', label: { en: 'Down the main street', tr: 'Ana cadde boyunca' }, at: [37.9285, 29.1255], bearing: 330, elev: 10, dist: 520, lift: 10 },
  { id: 'sunset', label: { en: 'Sunset over the valley', tr: 'Vadide gün batımı' }, at: [37.9245, 29.1150], bearing: 75, elev: 14, dist: 1300, lift: 60 },
]
