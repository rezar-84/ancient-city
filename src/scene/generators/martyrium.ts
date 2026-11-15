import * as THREE from 'three';
import { Building, column, sector, arch } from '../materials';
import type { Placement } from '../materials';
export interface MartyriumOptions { size?: number; innerDiameter?: number; roomDepth?: number; hallHeight?: number; porticoDepth?: number }
/** St Philip: 20m inner octagon, octagonal drum/dome, 60m square room ranges and axial entrances. */
export function createMartyrium(o: MartyriumOptions = {}): THREE.Group {
  const { size: s = 60, innerDiameter: diameter = 20, roomDepth: d = 8, hallHeight: h = 10, porticoDepth: pd = 4 } = o;
  const b = new Building('St Philip Martyrium'); b.foundation(s + 2 * pd, s + 2 * pd);
  b.box('travertine', s, 0.2, s);
  const radius = diameter / 2, entrance = 4;
  // Eight separate wall faces retain open axial access to the central sanctuary.
  const sideLength = 2 * (radius + 0.5) * Math.sin(Math.PI / 8), apothem = (radius + 0.5) * Math.cos(Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, x = apothem * Math.sin(a), z = apothem * Math.cos(a);
    if (i % 2 === 0) {
      b.add('travertine', arch(entrance, 5, 1), { x, y: 0.2, z, ry: a });
      const flank = (sideLength - entrance - 1.6) / 2;
      if (flank > 0) for (const sign of [-1, 1]) {
        const offset = sign * (sideLength / 2 - flank / 2);
        b.box('travertine', flank, h, 1, x + offset * Math.cos(a), h / 2, z - offset * Math.sin(a), a);
      }
      b.box('travertine', entrance + 1.6, h - 6, 1, x, (h + 6) / 2, z, a);
    } else b.box('travertine', sideLength, h, 1, x, h / 2, z, a);
  }
  b.add('travertine', sector(radius - 0.2, radius + 0.8, 2, 0, Math.PI * 2, 8), { x: 0, y: h, z: 0 });
  b.add('roofTile', new THREE.CylinderGeometry(radius * 0.38, radius + 1.2, 5, 8), { x: 0, y: h + 4.5, z: 0, ry: Math.PI / 8 });
  b.add('roofTile', new THREE.ConeGeometry(radius * 0.38, 1.5, 8), { x: 0, y: h + 7.75, z: 0, ry: Math.PI / 8 });
  const cols: Placement[] = [];
  for (let side = 0; side < 4; side++) {
    const a = side * Math.PI / 2;
    const put = (x: number, z: number) => ({ x: x * Math.cos(a) + z * Math.sin(a), z: z * Math.cos(a) - x * Math.sin(a) });
    // Two half-ranges on each side leave a 6m wide entrance on every axis.
    for (const sign of [-1, 1]) {
      const rangeWidth = (s - 6) / 2, center = sign * (3 + rangeWidth / 2);
      const p = put(center, s / 2 - d / 2);
      for (const offset of [-d / 2 + 0.4, d / 2 - 0.4]) {
        const wall = put(center, s / 2 - d / 2 + offset);
        b.box('plaster', rangeWidth, 6, 0.8, wall.x, 3, wall.z, a);
      }
      b.box('roofTile', rangeWidth, 0.4, d + pd, p.x + Math.sin(a) * pd / 2, 6.3, p.z + Math.cos(a) * pd / 2, a);
      for (let x = center - rangeWidth / 2; x <= center + rangeWidth / 2; x += 6) {
        const partition = put(x, s / 2 - d / 2);
        b.box('plaster', 0.5, 6, d, partition.x, 3, partition.z, a);
      }
    }
    for (let i = 0; i <= 14; i++) {
      const x = -s / 2 + i * s / 14;
      if (Math.abs(x) < 3) continue;
      const p = put(x, s / 2 + pd - 0.5); cols.push({ ...p, y: 0, ry: a });
    }
  }
  b.repeated('marble', column(6), cols);
  return b.finish();
}
