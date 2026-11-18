import * as THREE from 'three';
import { Building, arch, column, gable } from '../materials';
import type { MaterialKey, Placement } from '../materials';
export interface TempleOptions {
  width?: number; length?: number; podiumHeight?: number; columnHeight?: number; frontColumns?: number; peripteral?: boolean;
  /** Architectural phase: 'hellenistic' uses Doric/early Ionic limestone & timber trim; 'roman' uses fluted white marble. */
  eraPhase?: 'hellenistic' | 'roman';
  /** Include the chthonic Ploutonion grotto arch & stepped CO₂ viewing forecourt (D'Andria 2013). */
  grotto?: boolean;
}
/** Stepped podium temple (or sanctuary shrine); stairs face +Z, accessible cella interior via open double doors. */
export function createTemple(o: TempleOptions = {}): THREE.Group {
  const {
    width: w = 20, length: l = 35, podiumHeight: p = 2.5, columnHeight: h = 10,
    frontColumns: n = 6, peripteral = true, eraPhase = 'roman', grotto = false,
  } = o;
  const b = new Building('Temple');
  const orderMat: MaterialKey = eraPhase === 'hellenistic' ? 'limestone' : 'marble';
  const trimMat: MaterialKey = eraPhase === 'hellenistic' ? 'travertine' : 'marble';
  const colRadius = Math.min(0.56, Math.max(0.22, w * 0.026));

  b.box('limestone', w, 3.1, l, 0, -1.55);
  b.box('travertine', w, p, l);
  // Podium mouldings: projecting base and crowning cornice
  b.box('travertine', w + 0.6, 0.45, l + 0.6, 0, 0.225);
  b.box(trimMat, w + 0.5, 0.3, l + 0.5, 0, p - 0.15);
  b.box(trimMat, w + 0.2, 0.18, l + 0.2, 0, p + 0.09);

  const cols: Placement[] = [];
  const edgeInset = Math.max(1.1, colRadius * 3.0);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + edgeInset + i * (w - 2 * edgeInset) / Math.max(1, n - 1);
    cols.push({ x, y: p, z: l / 2 - edgeInset });
    if (peripteral) cols.push({ x, y: p, z: -l / 2 + edgeInset });
  }
  const sideCount = Math.max(4, Math.round((l - 2 * edgeInset) / Math.max(2.2, (w - 2 * edgeInset) / Math.max(1, n - 1))));
  if (peripteral) {
    for (const side of [-1, 1]) {
      for (let i = 1; i < sideCount; i++) {
        cols.push({ x: side * (w / 2 - edgeInset), y: p, z: -l / 2 + edgeInset + i * (l - 2 * edgeInset) / sideCount });
      }
    }
  }
  b.repeated(orderMat, column(h, colRadius), cols);

  // Accessible cella with side clerestory grilles, wide framed doorway, swung-open bronze/timber doors, and oracle/cult plinth
  const cellaW = w * 0.58, cellaL = l * 0.62, cellaZ = -l * 0.04;
  const cellaH = h - 0.3;
  for (const side of [-1, 1]) {
    const cx = side * cellaW / 2;
    const dado = cellaH * 0.68;
    b.box('plaster', 0.7, dado, cellaL, cx, p + dado / 2, cellaZ);
    // High clerestory window openings with stone grilles
    const piers = 4;
    for (let k = 0; k <= piers; k++) {
      b.box('plaster', 0.7, cellaH - dado - 0.5, cellaL / (piers * 2.2), cx, p + dado + (cellaH - dado - 0.5) / 2, cellaZ - cellaL / 2 + k * cellaL / piers);
    }
    b.box('plaster', 0.7, 0.5, cellaL, cx, p + cellaH - 0.25, cellaZ);
  }
  b.box('plaster', cellaW + 0.7, cellaH, 0.75, 0, p + cellaH / 2, cellaZ - cellaL / 2);

  const doorW = Math.min(cellaW - 1.4, Math.max(1.9, w * 0.24));
  const doorH = Math.min(cellaH - 0.9, Math.max(2.8, h * 0.62));
  const frontZ = cellaZ + cellaL / 2;
  const jambSpan = (cellaW - doorW) / 2;
  for (const side of [-1, 1]) {
    if (jambSpan > 0.2) b.box('plaster', jambSpan, cellaH, 0.75, side * (doorW / 2 + jambSpan / 2), p + cellaH / 2, frontZ);
    b.box(trimMat, 0.22, doorH + 0.2, 0.92, side * (doorW / 2 + 0.11), p + (doorH + 0.2) / 2, frontZ);
    // Open double temple doors folded inward so the cella threshold is 100% clear
    b.box(eraPhase === 'hellenistic' ? 'ground' : 'bronze', 0.08, doorH - 0.1, doorW * 0.46, side * (doorW / 2 - 0.12), p + (doorH - 0.1) / 2 + 0.05, frontZ - doorW * 0.26);
  }
  if (cellaH > doorH + 0.2) b.box('plaster', doorW, cellaH - doorH - 0.2, 0.75, 0, p + doorH + 0.2 + (cellaH - doorH - 0.2) / 2, frontZ);
  b.box(trimMat, doorW + 0.9, 0.32, 1.05, 0, p + doorH + 0.28, frontZ);

  // Interior cult podium & bronze Delphic tripod / lustral basin inside the accessible cella
  b.box(trimMat, Math.min(2.6, cellaW * 0.42), 0.85, 1.6, 0, p + 0.425, cellaZ - cellaL * 0.28);
  b.add('bronze', new THREE.CylinderGeometry(0.32, 0.42, 1.15, 8), { x: 0, y: p + 1.42, z: cellaZ - cellaL * 0.28 });
  if (eraPhase === 'hellenistic') {
    // Limestone lustral basin (perirrhanterion) beside the sanctuary steps
    b.add('limestone', new THREE.CylinderGeometry(0.65, 0.45, 0.28, 12), { x: w * 0.38, y: 0.86, z: l / 2 + 1.8 });
    b.add('limestone', new THREE.CylinderGeometry(0.18, 0.24, 0.72, 10), { x: w * 0.38, y: 0.36, z: l / 2 + 1.8 });
  }

  // Entablature: architrave, frieze, projecting cornice & pediments
  b.box(trimMat, w - 0.2, 0.55, l - 0.2, 0, p + h + 0.275);
  b.box(orderMat, w - 0.4, 0.5, l - 0.4, 0, p + h + 0.8);
  b.box(trimMat, w + 0.9, 0.3, l + 0.9, 0, p + h + 1.2);
  const roofRise = Math.max(1.8, w * 0.2);
  b.add('roofTile', gable(w + 1, roofRise, l + 1), { x: 0, y: p + h + 1.35, z: 0 });
  for (const side of [-1, 1]) b.add(trimMat, gable(w + 1.3, roofRise + 0.22, 0.25), { x: 0, y: p + h + 1.3, z: side * (l / 2 + 0.6) });

  // Broad walkable front stair (+Z) with <= 0.22 m risers extending 2.6 m below datum for slope tolerance
  const steps = Math.max(2, Math.ceil((p + 0.45) / 0.22));
  for (let i = 0; i < steps; i++) {
    const topY = -0.45 + (p + 0.45) * (i + 1) / steps;
    b.box('travertine', w * 0.68, topY + 2.6, 0.42, 0, (topY - 2.6) / 2, l / 2 + (steps - i - 0.5) * 0.42);
  }

  // Ploutonion chthonic grotto mouth & stepped viewing parapet (D'Andria 2013)
  if (grotto) {
    const gz = -l / 2 - 0.35;
    b.add('travertine', arch(2.2, Math.min(2.4, p + 1.1), 1.1, 0.65), { x: 0, y: -0.2, z: gz });
    b.box('dark', 2.1, 2.2, 0.35, 0, 0.9, gz + 0.35);
    for (let row = 0; row < 3; row++) {
      b.box('limestone', w + 3.6 + row * 1.4, 0.36, 0.75, 0, 0.18 + row * 0.34, gz - 3.6 - row * 0.78);
    }
  }
  return b.finish();
}
