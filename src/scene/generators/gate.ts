import * as THREE from 'three';
import { Building, arch } from '../materials';
export interface FrontinusGateOptions { archWidth?: number; archHeight?: number; depth?: number; towerDiameter?: number; towerHeight?: number }
/** Three 3.5×7m openings, ~14m central gateway, 3m depth, two Ø8×11m towers. Passage runs along Z. */
export function createFrontinusGate(o: FrontinusGateOptions = {}): THREE.Group {
  const { archWidth: w = 3.5, archHeight: h = 7, depth: d = 3, towerDiameter: td = 8, towerHeight: th = 11 } = o;
  const b = new Building('Frontinus Gate'), pier = 0.875, pitch = w + pier, total = 3 * w + 4 * pier;
  b.foundation(total + td * 2, Math.max(d, td));
  for (const x of [-pitch, 0, pitch]) b.add('travertine', arch(w, h, d, pier / 2), { x, y: 0, z: 0 });
  for (const side of [-1, 1]) b.box('travertine', pier / 2, h + pier / 2, d, side * (total / 2 - pier / 4));
  b.box('travertine', total, pier / 2, d, 0, h + pier * 0.75);
  b.box('marble', total, 0.5, d + 0.4, 0, h + pier + 0.25);
  for (const side of [-1, 1]) {
    const x = side * (total / 2 + td / 2 - 0.3);
    b.add('limestone', new THREE.CylinderGeometry(td / 2, td / 2, th + 3, 16), { x, y: (th - 3) / 2, z: 0 });
    b.add('travertine', new THREE.CylinderGeometry(td / 2 + 0.2, td / 2 + 0.2, 0.5, 16), { x, y: th - 0.25, z: 0 });
    // string course and battered plinth: break up the plain drum
    b.add('travertine', new THREE.CylinderGeometry(td / 2 + 0.12, td / 2 + 0.12, 0.35, 16, 1, true), { x, y: h + 0.4, z: 0 });
    b.add('travertine', new THREE.CylinderGeometry(td / 2 + 0.1, td / 2 + 0.35, 1.2, 16, 1, true), { x, y: 0.6, z: 0 });
  }
  return b.finish();
}
export interface ByzantineGateOptions { width?: number; height?: number; depth?: number; archWidth?: number; archHeight?: number; towerWidth?: number; towerHeight?: number }
/** Single 4×6m arch in a 20×8m wall, flanked by 6×11m square towers; passage along Z. */
export function createByzantineGate(o: ByzantineGateOptions = {}): THREE.Group {
  const { width: w = 20, height: h = 8, depth: d = 3, archWidth: aw = 4, archHeight: ah = 6, towerWidth: tw = 6, towerHeight: th = 11 } = o;
  const b = new Building('Byzantine Gate'); b.foundation(w + tw, Math.max(d, tw));
  b.add('limestone', arch(aw, ah, d));
  const sideWidth = (w - aw - 1.6) / 2;
  for (const side of [-1, 1]) {
    b.box('limestone', sideWidth, h, d, side * (aw / 2 + 0.8 + sideWidth / 2));
    b.box('limestone', tw, th + 3, tw, side * w / 2, (th - 3) / 2);
    b.box('travertine', tw + 0.4, 0.5, tw + 0.4, side * w / 2, th);
  }
  if (h > ah + 0.8) b.box('limestone', aw + 1.6, h - ah - 0.8, d, 0, (h + ah + 0.8) / 2);
  return b.finish();
}
