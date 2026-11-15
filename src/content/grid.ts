import { PLAN } from './plan'

type LL = [number, number]

/**
 * Schematic Hippodamian street grid of Roman Hierapolis, used by the "Whole city" layer.
 * Known: the plateia (main street) is ~13.5 m wide with porticoes on both sides; the side streets
 * (stenopoi) are ~3 m wide; the grid is regular and parallel/perpendicular to the plateia
 * (Hellenistic layout, kept in Roman times); excavation numbering (e.g. Insula 104 between
 * stenopoi 18 and 19, plateiai D and E) implies cross streets roughly every 35 m.
 * Assumed (approximate): insulae c. 32.5 x 100 m, secondary plateiai c. 5 m wide.
 * Houses inside the insulae are generic courtyard houses — an interpretation, not excavated plans.
 */
export const GRID = {
  axisFrom: [37.93175, 29.12199] as LL, // Frontinus Gate
  axisTo: [37.92237, 29.12886] as LL, // South Byzantine Gate
  pitchU: 35.5, // stenopos spacing along the plateia (m)
  pitchV: 105, // spacing of the parallel plateiai (m)
  stenoposW: 3,
  plateiaW: 5,
  mainHalf: 12, // half-width of the main street incl. porticoes
  blocksEast: 5,
  blocksWest: 4,
  paving: '#bfae90',
  built: -150,
  until: 700,
  /** city extent: the late-Roman/Byzantine circuit, closed along the travertine edge */
  region: PLAN.walls.flat() as LL[],
  note: {
    en: 'Street grid and houses are a schematic reconstruction: insulae c. 35 × 105 m aligned to the plateia, filled with generic courtyard houses.',
    tr: 'Sokak dokusu ve evler şematik bir canlandırmadır: plateiaya hizalı yaklaşık 35 × 105 m insulalar, genel avlulu evlerle doldurulmuştur.',
  },
}
