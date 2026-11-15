import * as THREE from 'three';
import { Building, arch, column, sector } from '../materials';
import type { Placement } from '../materials';
export interface TheatreOptions {
  outerRadius?: number; orchestraRadius?: number; rows?: number; rowHeight?: number; rowDepth?: number;
  sweepDegrees?: number; stageWidth?: number; stageDepth?: number; stageHeight?: number;
}
/** 200° cavea opens toward +Z; audience faces the stage at +Z. Defaults: R50/10, 45 rows, 0.4m rise, 0.8m tread, 70×12×20m scaena. */
export function createTheatre(o: TheatreOptions = {}): THREE.Group {
  const { outerRadius: r = 50, orchestraRadius: inner = 10, rows = 45, rowHeight: rise = 0.4,
    rowDepth: depth = 0.8, sweepDegrees = 200, stageWidth: sw = 70, stageDepth: sd = 12, stageHeight: sh = 20 } = o;
  const b = new Building('Theatre'), sweep = sweepDegrees * Math.PI / 180, start = Math.PI - sweep / 2;
  const pitch = (r - inner - depth - 2) / Math.max(1, rows - 1);
  b.add('limestone', sector(0, r + 1, 3, start, sweep), { x: 0, y: -3, z: 0 });
  b.add('travertine', new THREE.CylinderGeometry(inner, inner, 0.18, 48), { x: 0, y: 0.09, z: 0 });
  const seats: Placement[] = [];
  for (let row = 0; row < rows; row++) {
    const radius = inner + row * pitch + (row >= Math.floor(rows * 0.53) ? 2 : 0);
    const y = row * rise;
    b.add('limestone', sector(radius, radius + depth, Math.max(0.1, y), start, sweep), { x: 0, y: 0, z: 0 });
    const wedges = radius < inner + (r - inner) * 0.6 ? 8 : 16;
    const count = Math.ceil(radius * sweep / 1.65);
    for (let i = 0; i < count; i++) {
      const a = start + (i + 0.5) / count * sweep;
      const fraction = ((a - start) / sweep * wedges) % 1;
      if (Math.min(fraction, 1 - fraction) * radius * sweep / wedges < 0.65) continue;
      seats.push({ x: (radius + depth / 2) * Math.sin(a), y: y + rise / 2,
        z: (radius + depth / 2) * Math.cos(a), ry: a, sx: radius * sweep / count * 0.94, sy: rise, sz: depth });
    }
  }
  b.repeated('marble', new THREE.BoxGeometry(1, 1, 1), seats);
  b.add('limestone', sector(r, r + 1.2, rows * rise + 1.2, start, sweep));
  const stageZ = Math.max(13, r * 0.3);
  b.box('limestone', sw, 4.5, sd + 4, 0, -0.75, stageZ);
  b.box('marble', sw, 0.2, 4, 0, 1.6, stageZ - sd / 2 - 1.8);
  // Three actual openings on the facade facing the audience (-Z).
  const frontZ = stageZ - sd / 2;
  const doors = [-sw * 0.28, 0, sw * 0.28], doorWidth = 3;
  let edge = -sw / 2;
  for (const x of doors) {
    const left = x - doorWidth / 2 - 0.7;
    b.box('travertine', left - edge, sh, 1.4, (edge + left) / 2, sh / 2 + 1.5, frontZ);
    b.add('travertine', arch(doorWidth, 5, 1.4, 0.7), { x, y: 1.5, z: frontZ });
    b.box('travertine', doorWidth + 1.4, sh - 5.7, 1.4, x, 1.5 + 5.7 + (sh - 5.7) / 2, frontZ);
    edge = x + doorWidth / 2 + 0.7;
  }
  b.box('travertine', sw / 2 - edge, sh, 1.4, (edge + sw / 2) / 2, sh / 2 + 1.5, frontZ);
  b.box('travertine', sw, sh, 1, 0, 1.5 + sh / 2, stageZ + sd / 2);
  for (const x of [-sw / 2 + 0.5, sw / 2 - 0.5]) b.box('travertine', 1, sh, sd, x, 1.5 + sh / 2, stageZ);
  const columns: Placement[] = [];
  for (let tier = 0; tier < 2; tier++) {
    for (let i = 0; i < 18; i++) columns.push({ x: -sw / 2 + 2 + i * (sw - 4) / 17, y: 1.5 + tier * sh * 0.43, z: frontZ - 1 });
    b.box('marble', sw + 1, 0.6, 2.5, 0, 1.5 + (tier + 1) * sh * 0.43, frontZ - 0.8);
    for (const x of doors) b.box('marble', 6, 0.45, 2.8, x, 1.5 + (tier + 1) * sh * 0.43 + 0.5, frontZ - 1);
  }
  b.repeated('marble', column(sh * 0.43 - 0.3, 0.45), columns);
  return b.finish();
}
