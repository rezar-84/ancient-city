import * as THREE from 'three';
import { Building, arch, column, sector } from '../materials';
import type { Placement } from '../materials';
export interface TheatreOptions {
  outerRadius?: number; orchestraRadius?: number; rows?: number; rowHeight?: number; rowDepth?: number;
  sweepDegrees?: number; stageWidth?: number; stageDepth?: number; stageHeight?: number;
}
/** Documented Hierapolis Theatre: 103m cavea width (R51.5), 21.65m orchestra (R10.8), 50 rows (23 lower + 27 upper
 * divided by diazoma), open side parodoi, lateral stage stairs, and three-portal Severan scaenae frons. */
export function createTheatre(o: TheatreOptions = {}): THREE.Group {
  const { outerRadius: r = 51.5, orchestraRadius: inner = 10.8, rows = 50, rowHeight: rise = 0.38,
    rowDepth: depth = 0.76, sweepDegrees = 200, stageWidth: sw = 70, stageDepth: sd = 12, stageHeight: sh = 20 } = o;
  const b = new Building('Theatre'), sweep = sweepDegrees * Math.PI / 180, start = Math.PI - sweep / 2;
  const pitch = (r - inner - depth - 2) / Math.max(1, rows - 1);
  b.add('limestone', sector(0, r + 1, 3, start, sweep), { x: 0, y: -3, z: 0 });
  // Orchestra paving + low marble water-show parapet rim (AD 352 kolymbethra adaptation, leaving parodoi open!)
  b.add('travertine', new THREE.CylinderGeometry(inner, inner, 0.18, 48), { x: 0, y: 0.09, z: 0 });
  b.add('marble', sector(inner - 0.35, inner, 0.38, start + 0.12, sweep - 0.24, 36), { x: 0, y: 0.18, z: 0 });
  const seats: Placement[] = [];
  for (let row = 0; row < rows; row++) {
    // 23 lower rows (ima cavea) + diazoma walkway + 27 upper rows (summa cavea)
    const radius = inner + row * pitch + (row >= 23 ? 2.2 : 0);
    const y = row * rise;
    b.add('limestone', sector(radius, radius + depth, Math.max(0.1, y), start, sweep), { x: 0, y: 0, z: 0 });
    const wedges = row < 23 ? 9 : 10;
    const count = Math.ceil(radius * sweep / 1.65);
    for (let i = 0; i < count; i++) {
      const a = start + (i + 0.5) / count * sweep;
      const fraction = ((a - start) / sweep * wedges) % 1;
      if (Math.min(fraction, 1 - fraction) * radius * sweep / wedges < 0.65) continue;
      seats.push({ x: (radius + depth / 2) * Math.sin(a), y: y + rise / 2,
        z: (radius + depth / 2) * Math.cos(a), ry: a, sx: radius * sweep / count * 0.94, sy: rise, sz: depth });
    }
  }
  const seatMesh = b.repeated('marble', new THREE.BoxGeometry(1, 1, 1), seats);
  if (seatMesh) seatMesh.userData.noShadow = true;
  // Upper colonnaded gallery wall & vomitorium portals around the cavea rim
  b.add('limestone', sector(r, r + 1.2, rows * rise + 1.2, start, sweep));
  const stageZ = Math.max(13, r * 0.3);
  b.box('limestone', sw, 4.5, sd + 4, 0, -0.75, stageZ);
  b.box('marble', sw, 0.2, 4, 0, 1.6, stageZ - sd / 2 - 1.8);
  // Lateral stairs from the orchestra/parodoi up onto the 1.6 m pulpitum stage so the stage & porta regia are walkable
  const stageSteps = 7;
  for (const side of [-1, 1]) {
    for (let i = 0; i < stageSteps; i++) {
      const topY = ((i + 1) / stageSteps) * 1.6;
      b.box('travertine', 2.4, topY + 1.6, 0.42, side * (sw * 0.41), (topY - 1.6) / 2, stageZ - sd / 2 - 3.8 - (stageSteps - i - 0.5) * 0.42);
    }
  }
  // Three actual openings (porta regia + hospitalia) on the facade facing the audience (-Z) AND rear stage doors (+Z)
  const frontZ = stageZ - sd / 2;
  const doors = [-sw * 0.28, 0, sw * 0.28], doorWidth = 3.2;
  let edge = -sw / 2;
  for (const x of doors) {
    const left = x - doorWidth / 2 - 0.7;
    b.box('travertine', left - edge, sh, 1.4, (edge + left) / 2, sh / 2 + 1.5, frontZ);
    b.add('travertine', arch(doorWidth, 5, 1.4, 0.7), { x, y: 1.5, z: frontZ });
    b.box('travertine', doorWidth + 1.4, sh - 5.7, 1.4, x, 1.5 + 5.7 + (sh - 5.7) / 2, frontZ);
    edge = x + doorWidth / 2 + 0.7;
  }
  b.box('travertine', sw / 2 - edge, sh, 1.4, (edge + sw / 2) / 2, sh / 2 + 1.5, frontZ);
  // Rear postscaenium wall with central portal & arched windows
  for (const side of [-1, 1]) b.box('travertine', (sw - 5.2) / 2, sh, 1, side * (sw + 5.2) / 4, 1.5 + sh / 2, stageZ + sd / 2);
  b.add('travertine', arch(3.6, 5.2, 1.0, 0.8), { x: 0, y: 1.5, z: stageZ + sd / 2 });
  b.box('travertine', 5.2, sh - 6.0, 1, 0, 1.5 + 6.0 + (sh - 6.0) / 2, stageZ + sd / 2);
  for (const x of [-sw / 2 + 0.5, sw / 2 - 0.5]) b.box('travertine', 1, sh, sd, x, 1.5 + sh / 2, stageZ);

  const columns: Placement[] = [];
  for (let tier = 0; tier < 2; tier++) {
    for (let i = 0; i < 18; i++) columns.push({ x: -sw / 2 + 2 + i * (sw - 4) / 17, y: 1.5 + tier * sh * 0.43, z: frontZ - 1 });
    b.box('marble', sw + 1, 0.6, 2.5, 0, 1.5 + (tier + 1) * sh * 0.43, frontZ - 0.8);
    for (const x of doors) b.box('marble', 6, 0.45, 2.8, x, 1.5 + (tier + 1) * sh * 0.43 + 0.5, frontZ - 1);
  }
  b.repeated('marble', column(sh * 0.43 - 0.3, 0.45), columns);
  for (const tier of [1, 2]) {
    const y = 1.5 + tier * sh * 0.43;
    b.box('travertine', sw + 1.4, 0.22, 2.8, 0, y + 0.42, frontZ - 0.85);
    b.box('marble', sw + 1.8, 0.18, 3.1, 0, y + 0.62, frontZ - 0.9);
    const dentils: Placement[] = [];
    for (let x = -sw / 2; x <= sw / 2; x += 0.85)
      dentils.push({ x, y: y + 0.12, z: frontZ - 2.1 });
    const dm = b.repeated('marble', new THREE.BoxGeometry(0.32, 0.25, 0.35), dentils);
    if (dm) { dm.userData.noShadow = true; dm.userData.noCollide = true; }
  }
  for (const x of doors) {
    b.box('marble', doorWidth + 1.4, 0.22, 2.5, x, 1.62, frontZ - 0.4);
    for (const side of [-1, 1]) {
      b.box('marble', 0.18, 4.8, 0.25, x + side * (doorWidth / 2 + 0.12), 3.9, frontZ - 0.82);
      // Open carved timber stage doors tucked inside the portal reveal
      b.box('ground', 0.08, 4.2, 1.35, x + side * (doorWidth / 2 - 0.1), 3.6, frontZ + 0.65);
    }
  }
  return b.finish();
}
