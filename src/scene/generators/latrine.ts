import * as THREE from 'three';
import { Building, column, gable, arch } from '../materials';
import type { Placement } from '../materials';
import { createFountainWater } from '../water';
export interface LatrineOptions { length?: number; width?: number; height?: number; columnSpacing?: number }
/** 40×10m communal latrine (forica), 5m high, two internal column rows, keyhole benches, running euripus channel, clerestory windows and entrance doors. Front +Z. */
export function createLatrine(o: LatrineOptions = {}): THREE.Group {
  const { length: l = 40, width: w = 10, height: h = 5, columnSpacing = 4 } = o;
  const b = new Building('Latrine');
  // Stepped threshold apron at the +Z entrance so approaching from portico or street is always <= 0.18 m per step
  b.box('limestone', l, 3.1, w, 0, -1.55);
  for (let step = 0; step < 2; step++) {
    b.box('travertine', 4.4, 2.0, 1.4 + step * 0.9, 0, -0.02 - step * 0.16 - 1.0, w / 2 + 0.5 + step * 0.45);
  }
  b.box('travertine', l, 0.15, w);
  const doorClear = 2.6;
  // Back wall (-Z) with lower solid dado and high clerestory ventilation windows
  const backDado = Math.min(3.5, h - 1.3);
  b.box('plaster', l, backDado, 0.5, 0, backDado / 2, -w / 2);
  if (h > backDado + 0.45) {
    const winH = h - backDado - 0.45;
    const winBays = Math.max(3, Math.round(l / 4.5));
    const wp = l / winBays;
    for (let i = 0; i <= winBays; i++) {
      const wx = -l / 2 + i * wp;
      b.box('plaster', Math.min(wp * 0.65, wp - 0.85), winH, 0.5, wx, backDado + winH / 2, -w / 2);
      if (i < winBays) b.box('limestone', 0.95, 0.1, 0.56, wx + wp / 2, backDado + 0.05, -w / 2);
    }
    b.box('plaster', l, 0.45, 0.5, 0, h - 0.225, -w / 2);
  }

  // Helper to build keyhole bench + recessed euripus channel along a straight run
  const addForicaRun = (cx: number, cz: number, runLen: number, ry: number) => {
    if (runLen < 1.2) return;
    const c = Math.cos(ry), s = Math.sin(ry);
    const lx = (u: number, v: number) => cx + u * c + v * s;
    const lz = (u: number, v: number) => cz - u * s + v * c;
    // Marble bench seat + front vertical riser (v = +0.42 is toward the aisle)
    b.box('marble', runLen, 0.09, 0.84, cx, 0.54, cz, ry);
    b.box('marble', runLen, 0.4, 0.12, lx(0, 0.36), 0.32, lz(0, 0.36), ry);
    b.box('travertine', runLen, 0.4, 0.14, lx(0, -0.35), 0.32, lz(0, -0.35), ry);
    // Individual keyhole apertures along the marble bench
    const seats = Math.max(1, Math.floor((runLen - 0.4) / 0.72));
    const sp = runLen / seats;
    for (let i = 0; i < seats; i++) {
      const u = -runLen / 2 + (i + 0.5) * sp;
      b.box('dark', 0.21, 0.02, 0.28, lx(u, 0.06), 0.582, lz(u, 0.06), ry);
      b.box('dark', 0.13, 0.22, 0.14, lx(u, 0.36), 0.34, lz(u, 0.36), ry);
    }
    // Recessed limestone euripus sponge-rinse gutter curb in front of the bench
    for (const edge of [0.56, 0.94]) {
      b.box('limestone', runLen, 0.08, 0.08, lx(0, edge), 0.19, lz(0, edge), ry);
    }
    b.box('dark', runLen - 0.08, 0.02, 0.3, lx(0, 0.75), 0.155, lz(0, 0.75), ry);
  };

  // Back wall continuous bench & channel (facing +Z into room, ry = 0)
  addForicaRun(0, -w / 2 + 0.72, l - 2.2, 0);
  // Front wall (+Z) bench & channel SPLIT cleanly at the 2.6 m entrance vestibule!
  const frontSeg = (l - 2.2 - doorClear) / 2;
  for (const dir of [-1, 1]) {
    addForicaRun(dir * (doorClear / 2 + frontSeg / 2), w / 2 - 0.72, frontSeg, Math.PI);
  }
  // Short end walls (±X) with water conduit spout on -X and short side benches
  for (const side of [-1, 1]) {
    b.box('plaster', 0.5, h, w, side * l / 2, h / 2);
    if (w >= 8) addForicaRun(side * (l / 2 - 0.72), 0, w - 4.2, -side * Math.PI / 2);
    const wallSpan = (l - 4) / 2;
    b.box('plaster', wallSpan, backDado, 0.5, side * (l + 4) / 4, backDado / 2, w / 2);
    if (h > backDado + 0.45) {
      const winH = h - backDado - 0.45;
      const wb = Math.max(2, Math.round(wallSpan / 4.5));
      const wp = wallSpan / wb;
      for (let i = 0; i <= wb; i++) {
        const wx = side * (2 + i * wp);
        b.box('plaster', Math.min(wp * 0.65, wp - 0.85), winH, 0.5, wx, backDado + winH / 2, w / 2);
      }
      b.box('plaster', wallSpan, 0.45, 0.5, side * (l + 4) / 4, h - 0.225, w / 2);
    }
  }
  // Terracotta / stone spring-water inlet spout feeding the euripus channel on the west wall
  b.box('travertine', 0.36, 0.48, 0.44, -l / 2 + 0.42, 0.88, -w / 2 + 1.47);
  b.box('bronze', 0.22, 0.12, 0.16, -l / 2 + 0.65, 0.86, -w / 2 + 1.47);

  // Entrance arch (+Z) with flush marble threshold, dressed jambs, and swung-open wooden privacy doors
  b.box('marble', 2.8, 0.16, 1.1, 0, 0.08, w / 2);
  b.add('plaster', arch(2.4, 3.5, 0.5), { x: 0, y: 0, z: w / 2 });
  for (const leaf of [-1, 1]) {
    b.box('limestone', 0.16, 2.55, 0.58, leaf * 1.24, 1.35, w / 2);
    // Open timber double doors folded back at 85° inside the entrance vestibule, leaving the full 2.2 m clear width
    b.box('ground', 0.07, 2.36, 0.92, leaf * 1.11, 1.33, w / 2 - 0.68, leaf * 0.08);
    b.box('bronze', 0.09, 0.07, 0.88, leaf * 1.11, 0.78, w / 2 - 0.68, leaf * 0.08);
    b.box('bronze', 0.09, 0.07, 0.88, leaf * 1.11, 1.98, w / 2 - 0.68, leaf * 0.08);
  }
  b.box('marble', 3.0, 0.22, 0.64, 0, 2.72, w / 2);
  if (h > 4.3) b.box('plaster', 4, h - 4.3, 0.5, 0, (h + 4.3) / 2, w / 2);

  const cols: Placement[] = [], n = Math.max(1, Math.floor((l - 4) / columnSpacing));
  for (const side of [-1, 1]) for (let i = 0; i <= n; i++) cols.push({ x: -l / 2 + 2 + i * (l - 4) / n, y: 0.15, z: side * w * 0.22 });
  b.repeated('marble', column(h - 0.15, 0.25), cols);
  b.add('roofTile', gable(w + 1, 1.6, l + 1).rotateY(Math.PI / 2), { x: 0, y: h, z: 0 });
  const group = b.finish();
  // Running spring water in the back euripus channel (noShadow, noCollide)
  if (l > 3) {
    const channelWater = createFountainWater(l - 2.4, 0.28, 0.19);
    channelWater.position.set(0, 0, -w / 2 + 1.47);
    channelWater.userData.noShadow = channelWater.userData.noCollide = true;
    group.add(channelWater);
  }
  return group;
}
