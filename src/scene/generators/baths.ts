import * as THREE from 'three';
import { Building, column, combine } from '../materials';
import type { Placement } from '../materials';
export interface BathsOptions { width?: number; depth?: number; hallHeight?: number; courtDepth?: number; halls?: number }
/** 70×60m bath block with 14m halls and low-poly barrel vaults; 30m palaestra in front (+Z). */
export function createBaths(o: BathsOptions = {}): THREE.Group {
  const { width: w = 70, depth: d = 60, hallHeight: h = 14, courtDepth: court = 30, halls = 3 } = o;
  const b = new Building('Roman Baths'), blockZ = -court / 2, front = (d - court) / 2;
  b.foundation(w, d + court); b.box('travertine', w, 0.2, d + court);
  const hw = w / halls, radius = hw / 2 - 0.4, spring = h - radius;
  for (let i = 0; i < halls; i++) {
    const x = -w / 2 + hw * (i + 0.5);
    // Half-cylinder shell, closed end arches, and full-height side walls.
    const s = new THREE.Shape();
    s.moveTo(-radius - 0.5, 0);
    for (let j = 0; j <= 12; j++) { const a = Math.PI - j * Math.PI / 12; s.lineTo((radius + 0.5) * Math.cos(a), (radius + 0.5) * Math.sin(a)); }
    for (let j = 0; j <= 12; j++) { const a = j * Math.PI / 12; s.lineTo(radius * Math.cos(a), radius * Math.sin(a)); }
    s.closePath();
    b.add('roofTile', combine([new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2)]), { x, y: spring, z: blockZ });
    for (const side of [-1, 1]) b.box('limestone', 0.8, spring, d, x + side * hw / 2, spring / 2, blockZ);
    // End walls follow the vault profile and leave a true arch through each hall.
    const end = new THREE.Shape(), doorRadius = Math.min(2, hw * 0.2);
    const doorHeight = Math.min(6, h * 0.6), doorSpring = doorHeight - doorRadius;
    end.moveTo(-hw / 2, 0); end.lineTo(-hw / 2, spring);
    for (let j = 0; j <= 12; j++) {
      const a = Math.PI - j * Math.PI / 12;
      end.lineTo(radius * Math.cos(a), spring + radius * Math.sin(a));
    }
    end.lineTo(hw / 2, spring); end.lineTo(hw / 2, 0);
    end.lineTo(doorRadius, 0); end.lineTo(doorRadius, doorSpring);
    for (let j = 1; j <= 10; j++) {
      const a = j * Math.PI / 10;
      end.lineTo(doorRadius * Math.cos(a), doorSpring + doorRadius * Math.sin(a));
    }
    end.lineTo(-doorRadius, 0); end.closePath();
    for (const z of [front, blockZ - d / 2]) b.add('travertine',
      combine([new THREE.ExtrudeGeometry(end, { depth: 0.8, bevelEnabled: false }).translate(0, 0, -0.4)]), { x, y: 0, z });
  }
  const cols: Placement[] = [];
  for (const side of [-1, 1]) {
    b.box('roofTile', 4, 0.4, court, side * (w / 2 - 2), 5.7, front + court / 2);
    for (let i = 0; i <= Math.ceil(court / 4); i++) cols.push({ x: side * (w / 2 - 3), y: 0.2, z: front + i * court / Math.ceil(court / 4) });
  }
  b.repeated('marble', column(5), cols);
  return b.finish();
}
