import * as THREE from 'three';
import { Building, arch } from '../materials';
export interface FrontinusGateOptions { archWidth?: number; archHeight?: number; depth?: number; towerDiameter?: number; towerHeight?: number }
/** Three 3.5×7m openings, ~14m central gateway, 3m depth, two Ø8×11m towers. Passage runs along Z. */
export function createFrontinusGate(o: FrontinusGateOptions = {}): THREE.Group {
  const { archWidth: w = 3.5, archHeight: h = 7, depth: d = 3, towerDiameter: td = 8, towerHeight: th = 11 } = o;
  const b = new Building('Frontinus Gate'), pier = 0.875, pitch = w + pier, total = 3 * w + 4 * pier;
  // Keep the main foundation top at y = -0.02 and step three broad threshold courses down to -0.58
  // across ±5.4 m along Z so cross-sloping approaches never present a >0.22 m step on any arch.
  b.box('limestone', total + td * 2, 3.1, Math.max(d, td), 0, -1.57);
  for (let step = 0; step < 3; step++) {
    const spanZ = Math.max(d, td) + 0.9 * (step + 1);
    const topY = -0.02 - step * 0.18;
    b.box('travertine', total + 2.4, 2.2, spanZ, 0, topY - 1.1);
  }
  // Paved carriageway slabs through the three passages with subtle wheel-rut channels in the central & side bays
  for (const x of [-pitch, 0, pitch]) {
    b.box('travertine', w + 0.3, 0.16, d + 1.6, x, -0.08, 0);
    for (const rut of [-0.71, 0.71]) b.box('limestone', 0.22, 0.05, d + 1.4, x + rut, -0.015, 0);
    b.add('travertine', arch(w, h, d, pier / 2), { x, y: 0, z: 0 });
    // Keystone voussoir block on both facades
    for (const fz of [-1, 1]) b.box('marble', 0.46, 0.68, 0.18, x, h + 0.22, fz * (d / 2 + 0.06));
    // Stone pivot shoes and swung-open bronze-studded timber gate leaves tucked flat against the inner piers
    for (const leaf of [-1, 1]) {
      const hingeX = x + leaf * (w / 2 - 0.08);
      b.box('limestone', 0.22, 0.12, 0.26, hingeX, 0.06, -d / 2 + 0.22);
      b.box('ground', 0.09, Math.min(4.4, h - 2.0), 1.32, hingeX - leaf * 0.05, Math.min(4.4, h - 2.0) / 2 + 0.06, -d / 2 + 0.88);
      for (const strapY of [0.75, 2.1, 3.45]) {
        if (strapY < h - 1.9) b.box('bronze', 0.11, 0.08, 1.28, hingeX - leaf * 0.05, strapY, -d / 2 + 0.88);
      }
    }
  }
  for (const side of [-1, 1]) b.box('travertine', pier / 2, h + pier / 2, d, side * (total / 2 - pier / 4));
  // Flavian attic entablature and bilingual Domitian / Sextus Julius Frontinus dedication frieze
  b.box('travertine', total, pier / 2, d, 0, h + pier * 0.75);
  b.box('marble', total + 0.3, 0.28, d + 0.28, 0, h + pier + 0.14);
  b.box('travertine', total - 0.2, 0.72, d + 0.12, 0, h + pier + 0.64);
  for (const fz of [-1, 1]) b.box('marble', total * 0.62, 0.46, 0.08, 0, h + pier + 0.64, fz * (d / 2 + 0.09));
  b.box('marble', total + 0.5, 0.32, d + 0.48, 0, h + pier + 1.16);
  for (const side of [-1, 1]) {
    const x = side * (total / 2 + td / 2 - 0.3);
    b.add('limestone', new THREE.CylinderGeometry(td / 2, td / 2, th + 3, 16), { x, y: (th - 3) / 2, z: 0 });
    b.add('travertine', new THREE.CylinderGeometry(td / 2 + 0.22, td / 2 + 0.22, 0.5, 16), { x, y: th - 0.25, z: 0 });
    // string course, battered plinth, and narrow watch slits on the flanking round towers
    b.add('travertine', new THREE.CylinderGeometry(td / 2 + 0.12, td / 2 + 0.12, 0.35, 16, 1, true), { x, y: h + 0.4, z: 0 });
    b.add('travertine', new THREE.CylinderGeometry(td / 2 + 0.1, td / 2 + 0.35, 1.2, 16, 1, true), { x, y: 0.6, z: 0 });
    for (const ang of [-0.35, 0, 0.35]) {
      const sx = x + Math.sin(ang) * (td / 2 + 0.02), sz = -Math.cos(ang) * (td / 2 + 0.02);
      b.box('dark', 0.18, 0.95, 0.08, sx, h - 1.2, sz, -ang);
      b.box('travertine', 0.38, 0.14, 0.14, sx, h - 0.66, sz, -ang);
    }
  }
  return b.finish();
}
export interface ByzantineGateOptions { width?: number; height?: number; depth?: number; archWidth?: number; archHeight?: number; towerWidth?: number; towerHeight?: number }
/** Single 4×6m arch in a 20×8m wall, flanked by 6×11m square towers; passage along Z. */
export function createByzantineGate(o: ByzantineGateOptions = {}): THREE.Group {
  const { width: w = 20, height: h = 8, depth: d = 3, archWidth: aw = 4, archHeight: ah = 6, towerWidth: tw = 6, towerHeight: th = 11 } = o;
  const b = new Building('Byzantine Gate');
  b.box('limestone', w + tw, 3.1, Math.max(d, tw), 0, -1.57);
  for (let step = 0; step < 3; step++) {
    const spanZ = Math.max(d, tw) + 0.9 * (step + 1);
    const topY = -0.02 - step * 0.18;
    b.box('travertine', aw + 3.2, 2.2, spanZ, 0, topY - 1.1);
  }
  b.box('travertine', aw + 0.4, 0.16, d + 1.6, 0, -0.08, 0);
  b.add('limestone', arch(aw, ah, d));
  // Recycled Roman marble spolia imposts, lintel band, and carved cross roundel over the keystone
  for (const side of [-1, 1]) b.box('marble', 0.95, 0.24, d + 0.16, side * (aw / 2 + 0.4), ah - aw / 2);
  for (const fz of [-1, 1]) b.box('marble', aw + 1.8, 0.32, 0.12, 0, ah + 0.55, fz * (d / 2 + 0.05));
  // Open iron-strapped timber gate doors folded back inside the passage
  for (const leaf of [-1, 1]) {
    const hx = leaf * (aw / 2 - 0.1);
    b.box('ground', 0.1, Math.min(4.0, ah - 1.8), 1.4, hx - leaf * 0.05, Math.min(4.0, ah - 1.8) / 2 + 0.05, -d / 2 + 0.85);
    for (const sy of [0.8, 2.0, 3.2]) {
      if (sy < ah - 1.7) b.box('bronze', 0.12, 0.09, 1.36, hx - leaf * 0.05, sy, -d / 2 + 0.85);
    }
  }
  const sideWidth = (w - aw - 1.6) / 2;
  for (const side of [-1, 1]) {
    b.box('limestone', sideWidth, h, d, side * (aw / 2 + 0.8 + sideWidth / 2));
    b.box('limestone', tw, th + 3, tw, side * w / 2, (th - 3) / 2);
    b.box('travertine', tw + 0.4, 0.5, tw + 0.4, side * w / 2, th);
    // Reused marble string course and arrow slits on the square Theodosian towers
    b.box('marble', tw + 0.14, 0.22, tw + 0.14, side * w / 2, h * 0.62);
    for (const fz of [-1, 1]) b.box('dark', 0.18, 1.05, 0.08, side * w / 2, h * 0.78, fz * (tw / 2 + 0.02));
  }
  if (h > ah + 0.8) b.box('limestone', aw + 1.6, h - ah - 0.8, d, 0, (h + ah + 0.8) / 2);
  return b.finish();
}
