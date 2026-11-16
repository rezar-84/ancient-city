import { Vector4 } from 'three';
export const RIPPLE_COUNT = 16;
/** Absolute seconds; synchronize with sceneUniforms.uTime before rendering. */
export const waterUniforms = {
  uTime: { value: 0 },
  uRipples: { value: Array.from({ length: RIPPLE_COUNT }, () => new Vector4(0, 0, -1e6, 0)) },
};
let cursor = 0;
/** Coordinates are world XZ; mutates preallocated storage, including on wraparound. */
export function addRipple(x: number, z: number, amp: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(amp)) return;
  waterUniforms.uRipples.value[cursor].set(x, z, waterUniforms.uTime.value, Math.max(0, Math.min(amp, 1)));
  cursor = (cursor + 1) % RIPPLE_COUNT;
}
