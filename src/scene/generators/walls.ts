import * as THREE from 'three';
import { Building } from '../materials';
import type { Placement } from '../materials';
export interface WallOptions { height?: number; thickness?: number; towerSpacing?: number; towerWidth?: number; towerHeight?: number; terrainStep?: number; heightAt?: (x: number, z: number) => number }
/** 8m high, 2.5m thick walls with 6×11m towers every ~60m. Input XZ is in site coordinates;
 * returned group is centered on the polyline bounds; heightAt samples original site coordinates.
 * Heights remain relative to y=0. Terrain is sampled at <=4m intervals; foundations reach 3m below it.
 */
export function createWall(points: Array<[number, number]>, o: WallOptions = {}): THREE.Group {
  const { height: h = 8, thickness: t = 2.5, towerSpacing = 60, towerWidth: tw = 6, towerHeight: th = 11, terrainStep = 4, heightAt = () => 0 } = o;
  const b = new Building('City Wall');
  if (!points.length) return b.finish();
  const xs = points.map(p => p[0]), zs = points.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  b.group.userData.origin = { x: cx, z: cz };
  let distance = 0, nextTower = 0;
  const towers: Placement[] = [], caps: Placement[] = [], merlons: Placement[] = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], dx = bx - ax, dz = bz - az;
    const length = Math.hypot(dx, dz); if (!length) continue;
    const angle = Math.atan2(dx, dz), count = Math.max(1, Math.ceil(length / Math.max(0.25, terrainStep)));
    for (let j = 0; j < count; j++) {
      const f0 = j / count, f1 = (j + 1) / count;
      const x = ax + dx * (f0 + f1) / 2, z = az + dz * (f0 + f1) / 2;
      const y0 = heightAt(ax + dx * f0, az + dz * f0), y1 = heightAt(ax + dx * f1, az + dz * f1);
      const low = Math.min(y0, y1), high = Math.max(y0, y1);
      b.box('limestone', t, h + 3 + high - low, length / count + 0.04, x - cx, (low + high + h - 3) / 2, z - cz, angle);
      b.box('travertine', t + 0.2, 0.35, length / count + 0.05, x - cx, high + h, z - cz, angle);
      // crenellated parapet on the outer edge: one merlon every ~2.6 m
      const seg = length / count, nm = Math.max(1, Math.round(seg / 2.6));
      for (let k = 0; k < nm; k++) {
        const f = (j + (k + 0.5) / nm) / count, mx = ax + dx * f, mz = az + dz * f, off = t / 2 - 0.3;
        merlons.push({ x: mx - cx + off * Math.cos(angle), y: high + h + 0.175 + 0.65, z: mz - cz - off * Math.sin(angle), ry: angle });
      }
    }
    while (nextTower <= distance + length) {
      const f = (nextTower - distance) / length;
      const x = ax + dx * f, z = az + dz * f, y = heightAt(x, z);
      towers.push({ x: x - cx, y: y + (th - 3) / 2, z: z - cz, ry: angle });
      caps.push({ x: x - cx, y: y + th, z: z - cz, ry: angle });
      nextTower += Math.max(1, towerSpacing);
    }
    distance += length;
  }
  b.repeated('limestone', new THREE.BoxGeometry(tw, th + 3, tw), towers);
  b.repeated('travertine', new THREE.BoxGeometry(tw + 0.4, 0.5, tw + 0.4), caps);
  if (merlons.length) b.repeated('limestone', new THREE.BoxGeometry(0.6, 1.3, 1.4), merlons);
  return b.finish();
}
