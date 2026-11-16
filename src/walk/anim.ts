import type { InstancedBufferAttribute } from 'three';

/** Allocation-free per-frame two-pose blending. Times and duration are in seconds.
 * set() queues changes received mid-transition, avoiding discontinuous interruptions.
 * write() updates iPose and optionally iAnim.z; mark attributes needsUpdate once per batch.
 */
export class PoseBlender {
  private readonly current: Float32Array;
  private readonly previous: Float32Array;
  private readonly pending: Float32Array;
  private readonly started: Float64Array;
  readonly duration: number;
  constructor(count: number, initialPose = 0, duration = 0.3) {
    if (!Number.isInteger(count) || count < 0 || !Number.isFinite(duration) || duration <= 0 || !Number.isInteger(initialPose) || initialPose < 0 || initialPose > 10) throw new RangeError('Invalid pose blender configuration');
    this.duration = duration;
    this.current = new Float32Array(count).fill(initialPose);
    this.previous = new Float32Array(count).fill(initialPose);
    this.pending = new Float32Array(count).fill(initialPose);
    this.started = new Float64Array(count).fill(-Infinity);
  }
  private check(i: number, now: number) {
    if (!Number.isInteger(i) || i < 0 || i >= this.current.length || !Number.isFinite(now)) throw new RangeError('Invalid instance or time');
  }
  private advance(i: number, now: number) {
    if (now - this.started[i] >= this.duration && this.pending[i] !== this.current[i]) {
      this.previous[i] = this.current[i]; this.current[i] = this.pending[i]; this.started[i] = now;
    }
  }
  set(i: number, pose: number, now: number) {
    this.check(i, now);
    if (!Number.isInteger(pose) || pose < 0 || pose > 10) throw new RangeError('Invalid pose');
    this.pending[i] = pose; this.advance(i, now);
  }
  write(attr: InstancedBufferAttribute, i: number, now: number, anim?: InstancedBufferAttribute): number {
    this.check(i, now); this.advance(i, now);
    attr.setXY(i, this.previous[i], Math.max(0, Math.min(1, (now - this.started[i]) / this.duration)));
    if (anim) anim.setZ(i, this.current[i]);
    return this.current[i];
  }
}
