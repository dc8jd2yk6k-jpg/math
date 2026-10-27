// One continuous take. Shots are functions of the musical position b (bars);
// transitions between them are camera moves (eased blends of position and a
// slerp of orientation), never cuts. Whip-pans are one-beat blends with expo
// easing; the renderer adds true motion blur when the camera moves fast.
import * as THREE from 'three';
import { frameAt, headAt } from './curve.js';
import { ease, lerp, clamp, fbm1, smoothstep, keys } from './util.js';

const V = () => new THREE.Vector3();
const _m = new THREE.Matrix4();

function pose(pos, target, up, fov, roll = 0) {
  const q = new THREE.Quaternion().setFromRotationMatrix(_m.lookAt(pos, target, up));
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
  return { pos: pos.clone(), q, fov };
}

// camera relative to the spine frame at bar `at`
function rig(b, o) {
  const f = frameAt(o.at ?? b);
  const pos = V().copy(f.S)
    .addScaledVector(f.T, -(o.back ?? 10)).addScaledVector(f.N, o.up ?? 0).addScaledVector(f.Z, o.side ?? 0);
  const tgt = V().copy(f.S)
    .addScaledVector(f.T, o.ahead ?? 10).addScaledVector(f.N, o.lookUp ?? 0).addScaledVector(f.Z, o.lookSide ?? 0);
  if (o.lookHead) tgt.lerp(headAt(b), o.lookHead);
  return pose(pos, tgt, f.N, o.fov ?? 55, o.roll ?? 0);
}

// camera relative to a fixed anchor, using the frame at bar `at` as axes
function around(anchor, at, o) {
  const f = frameAt(at);
  const pos = V().copy(anchor)
    .addScaledVector(f.T, o.t ?? 0).addScaledVector(f.N, o.n ?? 0).addScaledVector(f.Z, o.z ?? 0);
  const tgt = V().copy(anchor)
    .addScaledVector(f.T, o.lt ?? 0).addScaledVector(f.N, o.ln ?? 0).addScaledVector(f.Z, o.lz ?? 0);
  const up = o.up === 'T' ? f.T : f.N;
  return pose(pos, tgt, up, o.fov ?? 45, o.roll ?? 0);
}

export class CameraRig {
  constructor(anchors) {
    this.A = anchors;
    const A = anchors;
    const e = ease;
    // seam pose: identical at b = 0 and b = 36 (loop)
    const SEAM = { back: 10, up: 1.6, ahead: 22, fov: 54 };
    this.shots = [
      { b0: -1, t: 0, fn: (b) => rig(b, { ...SEAM, back: lerp(10, 15, e.inOutCubic(clamp(b / 1.6))), up: lerp(1.6, 3.5, e.inOutCubic(clamp(b / 1.6))), fov: lerp(54, 58, clamp(b / 1.6)) }) },
      // reveal the chessboard: crane up and swing wide
      { b0: 1.55, t: 0.45, ease: 'inOutCubic', fn: (b) => around(A.chess, 2, { t: -20 + (b - 2) * 3.2, n: 20 + (b - 2) * 1.2, z: 30 - (b - 2) * 4, lt: 2 + (b - 2) * 1.5, ln: 2, fov: 42 }) },
      { b0: 3.75, t: 0.25, ease: 'inOutExpo', fn: (b) => around(A.chess, 2, { t: 15.5 + (b - 4) * 1.5, n: 2.6, z: -12 + (b - 4) * 4, lt: 0, ln: 7, lz: 0, fov: 46 }) },
      // 19 years in one bar: dive into the helix tunnel
      { b0: 4.75, t: 0.25, ease: 'inOutExpo', fn: (b) => rig(b, { back: 13, up: 0.6, ahead: 30, fov: 74 }) },
      // Go board from above
      { b0: 5.75, t: 0.3, ease: 'inOutExpo', fn: (b) => around(A.go, 6, { t: -18 + (b - 6) * 3, n: 30 - (b - 6) * 2, z: 14 - (b - 6) * 4, lt: 2, ln: 0, fov: 46 }) },
      // Move 37: whip down to the stone
      { b0: 7.75, t: 0.25, ease: 'inOutExpo', fn: (b) => { const a = (b - 8) * 0.55; return around(A.move37, 8, { t: Math.sin(a) * 9, n: 7.5 - (b - 8) * 1.5, z: Math.cos(a) * 9, ln: 0.5, fov: 42 }); } },
      // pull out and start the climb
      { b0: 8.95, t: 0.6, ease: 'inOutCubic', fn: (b) => rig(b, { back: 18, up: 4, side: 9, ahead: 12, fov: 54 }) },
      // Phase II: IMO 2024 — heavy, low, slow
      { b0: 9.85, t: 0.2, ease: 'inOutExpo', fn: (b) => rig(b, { at: Math.max(10, b), back: 13 - (b - 10) * 0.5, up: -1.5, side: 17, ahead: 6, lookSide: -2, fov: 50 }) },
      { b0: 11.85, t: 0.25, ease: 'inOutExpo', fn: (b) => rig(b, { back: 11, up: 2.5, side: -15, ahead: 7, lookSide: 2, fov: 48 }) },
      { b0: 12.9, t: 0.6, ease: 'inOutCubic', fn: (b) => rig(b, { back: 16, up: 1, side: -4, ahead: 18, fov: 58 }) },
      // GOLD: camera ahead of the head, looking back at it as it bursts through
      { b0: 13.9, t: 0.12, ease: 'inOutExpo', fn: (b) => rig(b, { back: -15 + (b - 14) * 2, up: 3, side: 9, ahead: 0, lookHead: 0.8, fov: 64 }) },
      { b0: 15.0, t: 0.75, ease: 'inOutCubic', fn: (b) => rig(b, { back: 9, up: 1.2, side: 2, ahead: 16, fov: 62 }) },
      // Phase III: frontier — tight chase + beat-locked whips to each result
      ...this.frontierShots(),
      // ETH: photo finish orbit
      { b0: 25.9, t: 0.12, ease: 'inOutExpo', fn: (b) => { const a = -0.6 + (b - 26) * 0.42; return around(A.finish, 26, { n: Math.cos(a) * 15, z: Math.sin(a) * 15, t: 1.5 + (b - 26) * 0.8, lt: 2 + (b - 26) * 1.2, up: 'T', fov: 50 }); } },
      // REVEAL: the whole curve, linear time
      { b0: 29.6, t: 1.6, ease: 'inOutQuart', fn: (b) => this.revealPose(b) },
      // DIVE back to the head: ends exactly on the seam pose
      { b0: 34.0, t: 2.0, ease: 'inOutQuart', fn: (b) => rig(b, SEAM) },
    ];
    this.cam = new THREE.PerspectiveCamera(54, 16 / 9, 0.05, 6000);
  }

  frontierShots() {
    const A = this.A;
    const chase = (b) => rig(b, { back: 7.5, up: 1.0, side: 0.5, ahead: 16, fov: 64 });
    const list = [
      { b0: 15.9, t: 0.12, ease: 'inOutExpo', fn: (b) => around(A.erdos, 16, { n: 2, z: 16, t: -3 + (b - 16) * 2.2, lt: 1, fov: 52 }) },
      { b0: 16.9, t: 0.25, ease: 'inOutExpo', fn: chase },
      { b0: 17.9, t: 0.12, ease: 'inOutExpo', fn: (b) => around(A.jacobian, 18, { n: -4, z: -15, t: -4 + (b - 18) * 2.5, lt: 1, fov: 52 }) },
      { b0: 18.9, t: 0.25, ease: 'inOutExpo', fn: chase },
      { b0: 19.9, t: 0.12, ease: 'inOutExpo', fn: (b) => around(A.percolation, 20, { n: 6 - (b - 20) * 3, z: 9 - (b - 20) * 7, t: -10 + (b - 20) * 5, lt: 1, fov: 60 }) },
      { b0: 20.9, t: 0.25, ease: 'inOutExpo', fn: chase },
      { b0: 21.9, t: 0.12, ease: 'inOutExpo', fn: (b) => around(A.navier, 22, { n: 3, z: 12 - (b - 22) * 4, t: -1 + (b - 22) * 2, lt: 0.5, fov: 54 - (b - 22) * 8 }) },
      { b0: 22.94, t: 0.12, ease: 'inOutExpo', fn: (b) => rig(b, { back: 6, up: 0.6, side: -0.5, ahead: 18, fov: 72 }) },
      { b0: 23.9, t: 0.12, ease: 'inOutExpo', fn: (b) => around(A.yangmills, 24, { n: -3, z: -13 + (b - 24) * 2, t: -2 + (b - 24) * 3, lt: 0.5, fov: 54 }) },
      { b0: 24.6, t: 0.3, ease: 'inOutExpo', fn: (b) => { const k = smoothstep(24.9, 26, b); return rig(b, { back: lerp(7, 4.5, k), up: 0.4, side: 0, ahead: 14, lookHead: 0.25 * k, fov: lerp(66, 40, ease.inQuad(k)) }); } },
    ];
    return list;
  }

  revealPose(b) {
    // the whole chart: x 0..268 (1950..2026), y 0..242 (+ the extrapolation)
    const k = ease.inOutSine(smoothstep(30, 34.5, b));
    const tgt = new THREE.Vector3(175 - 8 * k, 128 + 6 * k, 0);
    const pos = new THREE.Vector3(tgt.x + 70 - 50 * k, tgt.y - 40 + 22 * k, 540 + 40 * k);
    return pose(pos, tgt, new THREE.Vector3(0, 1, 0), 36);
  }

  evaluate(b) {
    let i = 0;
    for (let k = 0; k < this.shots.length; k++) if (b >= this.shots[k].b0) i = k;
    const s = this.shots[i];
    let p = s.fn(b);
    if (i > 0 && b < s.b0 + s.t) {
      const prev = this.shots[i - 1].fn(b);
      const w = ease[s.ease || 'inOutCubic'](clamp((b - s.b0) / s.t));
      p = { pos: prev.pos.clone().lerp(p.pos, w), q: prev.q.clone().slerp(p.q, w), fov: lerp(prev.fov, p.fov, w) };
    }
    return p;
  }

  // b: bars; fx: { shake, punch } computed by the director
  apply(b, fx = {}) {
    const p = this.evaluate(b);
    const cam = this.cam;
    cam.position.copy(p.pos);
    cam.quaternion.copy(p.q);
    const sh = fx.shake || 0;
    if (sh > 0) {
      const tt = b * 2.2;
      const e = new THREE.Euler(fbm1(tt, 1) * sh * 0.02, fbm1(tt, 2) * sh * 0.02, fbm1(tt, 3) * sh * 0.012);
      cam.quaternion.multiply(new THREE.Quaternion().setFromEuler(e));
    }
    cam.fov = p.fov + (fx.punch || 0);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    return cam;
  }
}
