import * as THREE from 'three';
import { Building, arch, column } from '../materials';
import type { Placement } from '../materials';
export interface AgoraOptions { width?: number; length?: number; stoaDepth?: number; columnHeight?: number; spacing?: number }
/** 170×280m (or overridden) paved agora, 10m stoas on west/north/east, open +Z; east (+X) Stoa-Basilica has two storeys.
 * Monumental triple-arched propylaea pierce the west (-X, facing Frontinus Street) and north (-Z) walls for full interior access. */
export function createAgora(o: AgoraOptions = {}): THREE.Group {
  const { width: w = 170, length: l = 280, stoaDepth: d = 10, columnHeight: h = 7, spacing = 4 } = o;
  const b = new Building('Agora');
  b.box('limestone', w, 8.0, l, 0, -4.0);
  b.box('travertine', w, 0.15, l);
  const cols: Placement[] = [];

  // Helper to build a wall run along Z with monumental triple-arched propylaea at zOffsets
  const wallWithPortalsZ = (wallX: number, wallH: number, portals: number[]) => {
    const span = 12.6; // 3 arches of 3.2 m + piers
    const sorted = [...portals].filter(pz => Math.abs(pz) < l / 2 - span).sort((a, b) => a - b);
    let cursor = -l / 2;
    for (const pz of sorted) {
      const left = pz - span / 2;
      if (left > cursor + 0.2) b.box('plaster', 0.8, wallH, left - cursor, wallX, wallH / 2 + 0.4, (cursor + left) / 2);
      for (const off of [-4.0, 0, 4.0]) {
        b.add('travertine', arch(3.0, Math.min(5.2, h - 0.8), 0.9, 0.5), { x: wallX, y: 0.4, z: pz + off, ry: Math.PI / 2 });
      }
      const topBar = wallH - Math.min(5.2, h - 0.8) - 0.5;
      if (topBar > 0.2) b.box('plaster', 0.8, topBar, span, wallX, 0.4 + wallH - topBar / 2, pz);
      // Stepped travertine flight outside each propylon descending up to 3.4 m in 0.22 m risers for plateau slope tolerance
      for (let s = 0; s < 15; s++) {
        const topY = 0.22 - s * 0.22;
        b.box('travertine', 0.52, topY + 5.0, span + 1.6, wallX + Math.sign(wallX) * (0.7 + s * 0.48), (topY - 5.0) / 2, pz);
      }
      b.box('marble', 1.4, 0.35, span + 0.8, wallX, 0.4 + Math.min(5.2, h - 0.8) + 0.65, pz);
      cursor = pz + span / 2;
    }
    if (l / 2 > cursor + 0.2) b.box('plaster', 0.8, wallH, l / 2 - cursor, wallX, wallH / 2 + 0.4, (cursor + l / 2) / 2);
  };

  for (const side of [-1, 1]) {
    const tiers = side === 1 ? 2 : 1;
    b.box('limestone', d, 0.25, l, side * (w / 2 - d / 2), 0.275);
    const totalH = tiers * (h + 0.6);
    const portals = l > 120 ? [-l * 0.28, 0, l * 0.28] : [0];
    if (side === -1) {
      // West stoa opens onto Frontinus Street through triple-arched propylaea
      wallWithPortalsZ(-w / 2 + 0.4, totalH, portals);
    } else {
      // East Hadrianic-Antonine Stoa-Basilica: lower wall with portals + upper arched clerestory gallery
      wallWithPortalsZ(w / 2 - 0.4, h + 0.6, portals);
      const upperBase = 0.4 + h + 0.6;
      const bays = Math.max(6, Math.round(l / 8));
      const bp = l / bays;
      b.box('plaster', 0.8, 1.4, l, w / 2 - 0.4, upperBase + 0.7);
      for (let i = 0; i <= bays; i++) {
        b.box('plaster', 0.8, h - 2.2, Math.min(bp * 0.55, 3.6), w / 2 - 0.4, upperBase + 1.4 + (h - 2.2) / 2, -l / 2 + i * bp);
      }
      b.box('plaster', 0.8, 0.8, l, w / 2 - 0.4, upperBase + h + 0.2);
    }
    const count = Math.max(1, Math.round((l - 2) / spacing));
    for (let tier = 0; tier < tiers; tier++) {
      for (let i = 0; i <= count; i++) cols.push({ x: side * (w / 2 - d + 0.6), y: 0.4 + tier * (h + 0.6), z: -l / 2 + 1 + i * (l - 2) / count });
      b.box('marble', 1.1, 0.36, l, side * (w / 2 - d + 0.6), 0.4 + (tier + 1) * (h + 0.6) - 0.42);
      b.box(tier === tiers - 1 ? 'roofTile' : 'travertine', d + 0.5, 0.45, l, side * (w / 2 - d / 2), 0.4 + (tier + 1) * (h + 0.6) - 0.18);
    }
  }

  // North stoa (-Z) with central arched propylon
  const northSpan = w - 2 * d;
  const gateSpan = 5.6;
  for (const s of [-1, 1]) {
    const seg = (northSpan - gateSpan) / 2;
    if (seg > 0.5) b.box('plaster', seg, h + 0.6, 0.8, s * (gateSpan / 2 + seg / 2), h / 2 + 0.7, -l / 2 + 0.4);
  }
  b.add('travertine', arch(4.0, Math.min(5.2, h - 0.8), 0.9, 0.8), { x: 0, y: 0.4, z: -l / 2 + 0.4 });
  if (h + 0.6 > 6.0) b.box('plaster', gateSpan, h + 0.6 - 6.0, 0.8, 0, 0.4 + 6.0 + (h + 0.6 - 6.0) / 2, -l / 2 + 0.4);
  b.box('roofTile', northSpan, 0.5, d, 0, h + 0.75, -l / 2 + d / 2);

  const count = Math.max(1, Math.round((w - 2 * d) / spacing));
  for (let i = 0; i <= count; i++) cols.push({ x: -w / 2 + d + i * (w - 2 * d) / count, y: 0.4, z: -l / 2 + d - 0.6 });
  b.repeated('marble', column(h), cols);

  // Central civic bema / altar podium in the open market court (low 0.20 m steps, walkable)
  b.box('travertine', 9.2, 0.2, 6.4, 0, 0.25, 0);
  b.box('marble', 7.8, 0.2, 5.0, 0, 0.45, 0);
  b.box('marble', 2.2, 1.05, 1.4, 0, 1.05, 0);
  return b.finish();
}
