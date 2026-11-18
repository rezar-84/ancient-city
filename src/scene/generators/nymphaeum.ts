import * as THREE from 'three';
import { Building, column, arch } from '../materials';
import type { Placement } from '../materials';
import { createFountainWater, createWaterSheet } from '../water';
import { createPersonGeometry } from '../../walk/npcGeometry';

/** a marble statue: the crowd's far-LOD figure, stripped to plain mesh attributes and indexed so it
 * merges with the masonry (Building.add needs position/normal/uv + index like BoxGeometry) */
function statue(scale: number, era: 'greek' | 'roman' = 'roman') {
  const src = createPersonGeometry(era, 'far');
  const g = new THREE.BufferGeometry();
  const n = src.getAttribute('position').count;
  g.setAttribute('position', src.getAttribute('position').clone());
  g.setAttribute('normal', src.getAttribute('normal').clone());
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  g.setIndex(Array.from({ length: n }, (_, i) => i));
  src.dispose();
  return g.scale(scale, scale, scale);
}
export interface NymphaeumOptions { width?: number; height?: number; wingDepth?: number; basinDepth?: number }
/** U-shaped 60×12m two-storey facade, 12m wings and a 10m-deep basin facing +Z. */
export function createNymphaeum(o: NymphaeumOptions = {}): THREE.Group {
  const { width: w = 60, height: h = 12, wingDepth: d = 12, basinDepth: bd = 10 } = o;
  const b = new Building('Nymphaeum'); b.foundation(w + 2, d + bd);
  const back = -(d + bd) / 2 + 1, front = (d + bd) / 2 - 1;
  b.box('travertine', w, h, 1.2, 0, h / 2, back);
  for (const side of [-1, 1]) b.box('travertine', 1.2, h, d, side * (w / 2 - 0.6), h / 2, back + d / 2);
  const cols: Placement[] = [];
  for (let tier = 0; tier < 2; tier++) {
    const y = 0.5 + tier * h / 2;
    for (let i = 0; i <= 14; i++) cols.push({ x: -w / 2 + 2 + i * (w - 4) / 14, y, z: back + 1.8 });
    for (const side of [-1, 1]) {
      for (let i = 1; i <= 3; i++) cols.push({ x: side * (w / 2 - 2), y, z: back + 1.8 + i * (d - 2) / 3 });
      b.box('marble', 3, 0.5, d + 1, side * (w / 2 - 1.5), (tier + 1) * h / 2, back + d / 2);
    }
    b.box('marble', w + 1, 0.5, 3.5, 0, (tier + 1) * h / 2, back + 1);
    for (let i = 0; i < 7; i++) {
      const bx = -w / 2 + 5 + i * (w - 10) / 6;
      b.add('limestone', arch(2.5, h / 2 - 1, 0.25, 0.35), { x: bx, y, z: back + 0.8 });
      // statue on a moulded pedestal in every bay, framed by a small aedicula with alternating pediments & Triton frieze
      b.box('marble', 1.3, 0.9, 1.0, bx, y + 0.45, back + 1.15);
      b.box('marble', 1.5, 0.12, 1.15, bx, y + 0.94, back + 1.15);
      b.add('marble', statue(1.12, (i + tier) % 2 ? 'greek' : 'roman'), { x: bx, y: y + 1.0, z: back + 1.15, ry: (i - 3) * 0.06 });
      b.box('marble', 2.2, 0.35, 0.45, bx, y + h / 2 - 1.6, back + 1.0);
      if (tier === 0) b.box('travertine', 2.4, 0.42, 0.14, bx, h / 2 + 0.32, back + 2.68);
    }
  }
  // central group (the tritons and sea creatures that named the fountain): a raised plinth with three figures
  b.box('marble', 5.5, 1.4, 2.6, 0, 0.7 + 0.5, back + 4.2);
  for (const [dx, sc, ry] of [[-1.5, 1.05, 0.5], [0, 1.25, 0], [1.5, 1.05, -0.5]] as const)
    b.add('marble', statue(sc, 'greek'), { x: dx, y: 1.9, z: back + 4.2, ry });
  // crowning cornice with dentil band over the upper storey
  b.box('marble', w + 1.2, 0.6, 2.2, 0, h + 0.3, back + 0.6);
  for (let i = 0; i < 60; i++) b.box('marble', 0.35, 0.22, 0.3, -w / 2 + 0.6 + i * (w - 1.2) / 59, h - 0.11, back + 1.6);
  b.repeated('marble', column(h / 2 - 1, 0.4), cols);
  const basinZ = front - bd / 2;
  b.box('limestone', w - 4, 0.25, bd, 0, 0.125, basinZ);
  for (const side of [-1, 1]) {
    b.box('travertine', 0.5, 1, bd, side * (w / 2 - 2.25), 0.5, basinZ);
    b.box('travertine', w - 4, 1, 0.5, 0, 0.5, basinZ + side * bd / 2);
  }
  // marble coping on the parapet, and a raised back parapet with spout heads feeding the basin
  b.box('marble', w - 3.6, 0.12, 0.7, 0, 1.06, basinZ + bd / 2);
  for (const side of [-1, 1]) b.box('marble', 0.7, 0.12, bd, side * (w / 2 - 2.25), 1.06, basinZ);
  const backZ = basinZ - bd / 2;
  b.box('marble', w - 4, 1.5, 0.6, 0, 1.75, backZ);
  const spouts = 9, spoutX = (i: number) => -w / 2 + 6 + i * (w - 12) / (spouts - 1);
  for (let i = 0; i < spouts; i++) {
    b.box('marble', 0.7, 0.6, 0.55, spoutX(i), 2.0, backZ + 0.5); // carved spout head
    b.box('limestone', 0.22, 0.14, 0.45, spoutX(i), 1.8, backZ + 0.95);
  }
  const g = b.finish();
  const water = createFountainWater(w - 5, bd - 1, 0.86);
  water.position.z = basinZ;
  water.name = 'nymphaeum-water';
  g.add(water);
  const jet = createWaterSheet(0.42, 1.0);
  for (let i = 0; i < spouts; i++) {
    const sheet = i ? jet.clone() : jet; // shared geometry + material: one program, cheap
    sheet.position.set(spoutX(i), 1.8, backZ + 1.2);
    sheet.rotation.x = -0.45; // the jet leaves the spout and arcs forward into the basin
    sheet.userData.noShadow = sheet.userData.noCollide = true;
    g.add(sheet);
  }
  water.userData.noShadow = water.userData.noCollide = true;
  return g;
}
