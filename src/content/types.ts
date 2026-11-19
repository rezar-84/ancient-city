export type L10n = { en: string; tr: string }
export type Category = 'gate' | 'civic' | 'sacred' | 'leisure' | 'funerary' | 'nature' | 'christian' | 'defence'

export interface Source { title: string; url: string }
export interface Img { src: string; credit: string; caption?: L10n; kind?: 'photo' | 'archive'; title?: string; url?: string }

export interface Landmark {
  id: string
  name: L10n
  /** name used in the 'Today' view when the monument has a modern use (e.g. museum) */
  nameToday?: L10n
  /** WGS84 position of the monument centre */
  lat: number
  lon: number
  category: Category
  /** construction year (negative = BC) and end of use, for the timeline */
  built: number
  until?: number
  /** human-readable period label */
  period: L10n
  summary: L10n
  facts: { en: string[]; tr: string[] }
  didYouKnow?: L10n
  /** contested or uncertain points, shown with a flag */
  disputed?: L10n
  /** current photos */
  images: Img[]
  /** reconstruction renders captured from the 3D scene (public/renders) */
  renders?: string[]
  /** AI-generated period paintings (public/art), shown after the renders and labelled as illustrations */
  paintings?: string[]
  sources: Source[]
  /** procedural builder from src/scene/generators (BUILDERS key) */
  builder?: string
  builderOpts?: Record<string, unknown>
  /** rotation of the building around Y, degrees (0 = front faces south/+Z) */
  rotation?: number
  /** camera framing when focused: bearing (deg from south), elevation (deg), distance (m) */
  view?: { bearing: number; elev: number; dist: number }
  /** height of the pin above ground (m) */
  pinHeight?: number
  /** glTF model for detail / AR view */
  model?: { glb: string; usdz?: string; credit: string }
  audio?: { en?: string; tr?: string }
}

export interface TimelineEvent { year: number; label: L10n; detail?: L10n; source?: string }

/** Era-aware display name. */
export function lname(l: Pick<Landmark, 'name' | 'nameToday'>, lang: 'en' | 'tr', era: 'ancient' | 'today' = 'ancient') {
  return (era === 'today' && l.nameToday ? l.nameToday : l.name)[lang]
}
