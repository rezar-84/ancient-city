import * as THREE from 'three';
import { Building, column, sector, arch } from '../materials';
import type { Placement } from '../materials';
export interface MartyriumOptions { size?: number; innerDiameter?: number; roomDepth?: number; hallHeight?: number; porticoDepth?: number }
/** St Philip Martyrium: 20m inner octagon, octagonal clerestory drum with transenna windows, lead-roofed dome,
 * 60m square pilgrim room ranges, central ciborium canopy, and stepped axial entrances on all four sides. */
export function createMartyrium(o: MartyriumOptions = {}): THREE.Group {
  const { size: s = 60, innerDiameter: diameter = 20, roomDepth: d = 8, hallHeight: h = 10, porticoDepth: pd = 4 } = o;
  const b = new Building('St Philip Martyrium');
  // Deep limestone hillside retaining plinth (16 m) so the 68 m platform never floats on the steep eastern slope
  b.box('limestone', s + 2 * pd, 16.0, s + 2 * pd, 0, -8.0);
  // Processional stepped flights on all 4 cardinal 6m entrances descending up to 4.0 m in 0.22 m risers
  for (let side = 0; side < 4; side++) {
    const a = side * Math.PI / 2;
    for (let step = 0; step < 18; step++) {
      const topY = 0.05 - step * 0.22;
      const dist = s / 2 + pd + 0.4 + step * 0.46;
      b.box('travertine', 7.2, topY + 6.0, 0.52, Math.sin(a) * dist, (topY - 6.0) / 2, Math.cos(a) * dist, a);
    }
  }
  b.box('travertine', s + 2 * pd, 0.2, s + 2 * pd);
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
    } else {
      // Diagonal exedra/chapel faces with upper arched clerestory window & marble transenna lattice
      b.box('travertine', sideLength, h * 0.58, 1, x, h * 0.29, z, a);
      for (const sign of [-1, 1]) {
        const offset = sign * (sideLength * 0.34);
        b.box('travertine', sideLength * 0.32, h * 0.28, 1, x + offset * Math.cos(a), h * 0.72, z - offset * Math.sin(a), a);
      }
      b.box('marble', 0.12, h * 0.28, 0.18, x, h * 0.72, z, a);
      b.box('marble', sideLength * 0.36, 0.12, 0.18, x, h * 0.72, z, a);
      b.box('travertine', sideLength, h * 0.14, 1, x, h * 0.93, z, a);
    }
  }
  // Octagonal clerestory drum & lead-sheathed wooden dome
  b.add('travertine', sector(radius - 0.2, radius + 0.8, 2, 0, Math.PI * 2, 8), { x: 0, y: h, z: 0 });
  b.add('roofTile', new THREE.CylinderGeometry(radius * 0.38, radius + 1.2, 5, 8), { x: 0, y: h + 4.5, z: 0, ry: Math.PI / 8 });
  b.add('roofTile', new THREE.ConeGeometry(radius * 0.38, 1.5, 8), { x: 0, y: h + 7.75, z: 0, ry: Math.PI / 8 });
  b.box('bronze', 0.12, 1.4, 0.12, 0, h + 9.1, 0);
  b.box('bronze', 0.75, 0.12, 0.12, 0, h + 9.45, 0);

  // Central marble ciborium canopy over the Apostle's octagonal shrine (4 columns at ±1.6m leave 2.6m clear passage)
  const cibCols: Placement[] = [];
  for (const cx of [-1.6, 1.6]) for (const cz of [-1.6, 1.6]) cibCols.push({ x: cx, y: 0.2, z: cz });
  b.repeated('marble', column(3.8, 0.18), cibCols);
  b.box('marble', 3.6, 0.28, 3.6, 0, 4.14, 0);
  b.add('bronze', new THREE.ConeGeometry(2.3, 1.2, 8), { x: 0, y: 4.88, z: 0, ry: Math.PI / 8 });
  b.box('marble', 1.3, 0.95, 1.3, 0, 0.675, 0);

  const cols: Placement[] = [];
  for (let side = 0; side < 4; side++) {
    const a = side * Math.PI / 2;
    const put = (x: number, z: number) => ({ x: x * Math.cos(a) + z * Math.sin(a), z: z * Math.cos(a) - x * Math.sin(a) });
    // Open studded timber doors flanking the 6m axial passage
    for (const leaf of [-1, 1]) {
      const dp = put(leaf * 2.75, s / 2 - d / 2);
      b.box('ground', 0.1, 3.8, 2.2, dp.x, 2.1, dp.z, a);
    }
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
      const p = put(x, s / 2 + pd - 0.5); cols.push({ ...p, y: 0.2, ry: a });
    }
  }
  b.repeated('marble', column(6), cols);
  return b.finish();
}
