// One calm, continuous camera move. The camera works in the screen frame of
// the line (U = direction of travel is always screen-up), so the line reads as
// straight and vertical. During each milestone it settles on that object and
// tracks the head only partly (kappa), so the head drifts up through the
// object, as in the reference. Every parameter is an eased keyframe track.
import * as THREE from 'three';
import { frameAt, headAt, storyAt } from './curve.js';
import { keys, lerp, ease, smoothstep, clamp } from './util.js';

const _m = new THREE.Matrix4();

export class CameraRig {
  constructor(pieces, chartCenter) {
    const P = pieces;
    const c = (p) => p.center.toArray();
    // shot list: [b from, b to, settings]. Between shots everything eases.
    // kappa = 1 follows the head; 0 holds on `center`; uRef = frame used for axes
    const S = (a, z, o) => ({ a, z, ...o });
    const H = { kappa: 1 };
    this.shots = [
      S(-1, 0, { ...H, dist: 22, yaw: 0, pitch: 0, fov: 40, lift: 0.06 }),
      S(0.9, 1.0, { ...H, dist: 15, yaw: 6, pitch: 8, fov: 40, lift: 0.0 }),
      S(1.0, 1.5, { ...H, dist: 13, yaw: 10, pitch: 12, fov: 40, lift: 0.0 }),
      S(1.75, 1.75, { ...H, dist: 22, yaw: 4, pitch: 4, fov: 40, lift: 0.06 }),
      S(2.05, 5.3, { kappa: 0.2, center: c(P.chess), u0: 3.0, dist: 29, yaw: -9, yaw2: 7, pitch: 3, fov: 40, lift: 0.0 }),
      S(5.75, 5.75, { ...H, dist: 26, yaw: 0, pitch: 2, fov: 40, lift: 0.06 }),
      S(6.05, 7.75, { kappa: 0.2, center: c(P.go), u0: 7.0, dist: 34, yaw: 7, yaw2: -4, pitch: 3, fov: 40, lift: 0.0 }),
      S(8.0, 9.0, { kappa: 0.1, center: P.go.move37.toArray(), u0: 7.0, dist: 15, yaw: -8, yaw2: -14, pitch: 6, fov: 40, lift: 0.0 }),
      S(9.65, 9.65, { ...H, dist: 26, yaw: 0, pitch: 0, fov: 40, lift: 0.08 }),
      S(10.1, 13.75, { kappa: 0.35, center: c(P.lean), u0: 12.0, dist: 30, yaw: -6, yaw2: 5, pitch: 2, fov: 40, lift: 0.0 }),
      S(14.05, 15.9, { kappa: 0.35, center: c(P.geometry), u0: 15.0, dist: 32, yaw: 4, yaw2: -4, pitch: 0, fov: 40, lift: 0.0 }),
      S(16.1, 17.9, { kappa: 0.35, center: c(P.erdos), u0: 16.9, dist: 29, yaw: -5, yaw2: 5, pitch: 2, fov: 40, lift: 0.0 }),
      S(18.1, 19.9, { kappa: 0.35, center: c(P.jacobian), u0: 18.9, dist: 27, yaw: 10, yaw2: -6, pitch: 6, fov: 40, lift: 0.0 }),
      S(20.1, 21.9, { kappa: 0.35, center: c(P.percolation), u0: 20.9, dist: 32, yaw: -6, yaw2: 6, pitch: 8, fov: 40, lift: 0.0 }),
      S(22.05, 22.95, { kappa: 0.35, center: c(P.navier), u0: 22.6, dist: 26, yaw: 3, yaw2: -3, pitch: 0, fov: 40, lift: 0.0 }),
      S(23.05, 23.95, { kappa: 0.35, center: c(P.papers), u0: 23.45, dist: 27, yaw: -4, yaw2: 3, pitch: 0, fov: 40, lift: 0.0 }),
      S(24.05, 24.9, { kappa: 0.35, center: c(P.yangmills), u0: 24.45, dist: 25, yaw: 6, yaw2: -6, pitch: 4, fov: 40, lift: 0.0 }),
      S(25.05, 26.6, { kappa: 0.12, center: c(P.eth), u0: 25.5, dist: 46, yaw: -4, yaw2: 3, pitch: 2, fov: 40, lift: 0.0 }),
      S(27.4, 29.5, { ...H, dist: 24, yaw: 0, yaw2: 6, pitch: 3, fov: 40, lift: 0.1 }),
      S(35.4, 37, { ...H, dist: 22, yaw: 0, pitch: 0, fov: 40, lift: 0.06 }),
    ];

    this.chartCenter = chartCenter;
    this.cam = new THREE.PerspectiveCamera(40, 9 / 16, 1.0, 4000);
  }

  // scalar/array track value at b: holds within a shot, eases between shots
  track(b, name, fallback) {
    const sh = this.shots;
    const val = (s, t) => {
      let v = s[name] ?? fallback;
      if (name === 'yaw' && s.yaw2 !== undefined) v = lerp(s.yaw, s.yaw2, ease.inOutSine(clamp((t - s.a) / Math.max(1e-3, s.z - s.a))));
      return v;
    };
    if (b <= sh[0].z) return val(sh[0], b);
    for (let i = 0; i < sh.length; i++) {
      const s = sh[i];
      if (b >= s.a && b <= s.z) return val(s, b);
      const n = sh[i + 1];
      if (n && b > s.z && b < n.a) {
        const w = ease.inOutCubic((b - s.z) / (n.a - s.z));
        const a = val(s, s.z), c = val(n, n.a);
        if (a === undefined || c === undefined) return a ?? c;
        return Array.isArray(a) ? a.map((x, j) => lerp(x, c[j], w)) : lerp(a, c, w);
      }
    }
    return val(sh[sh.length - 1], b);
  }

  // last defined centre / reference u (head-follow shots don't define them)
  centerAt(b) {
    const sh = this.shots;
    let prev = null, next = null;
    for (const s of sh) { if (s.center) { if (s.a <= b) prev = s; else if (!next) next = s; } }
    if (!prev) return next ? next : null;
    if (!next || b <= prev.z) return prev;
    const w = ease.inOutCubic(clamp((b - prev.z) / (next.a - prev.z)));
    return { center: prev.center.map((x, j) => lerp(x, next.center[j], w)), u0: lerp(prev.u0, next.u0, w) };
  }

  followPose(b) {
    const u = storyAt(b);
    const kappa = this.track(b, 'kappa', 1);
    const cs = this.centerAt(b);
    const uRef = cs ? lerp(cs.u0, u, kappa) : u;
    const f = frameAt(uRef);
    const dist = this.track(b, 'dist', 22), yaw = this.track(b, 'yaw', 0), pitch = this.track(b, 'pitch', 0);
    const fov = this.track(b, 'fov', 40), lift = this.track(b, 'lift', 0);
    const head = headAt(u);
    const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    const headFocus = head.clone().addScaledVector(f.U, -lift * visH);
    const focus = cs ? new THREE.Vector3(...cs.center).lerp(headFocus, kappa) : headFocus;
    const q = new THREE.Quaternion().setFromAxisAngle(f.U, THREE.MathUtils.degToRad(yaw))
      .multiply(new THREE.Quaternion().setFromAxisAngle(f.R, THREE.MathUtils.degToRad(-pitch)));
    const pos = focus.clone().add(f.F.clone().multiplyScalar(dist).applyQuaternion(q));
    const up = f.U.clone().applyQuaternion(q);
    return { pos, q: new THREE.Quaternion().setFromRotationMatrix(_m.lookAt(pos, focus, up)), fov };
  }

  revealPose(b) {
    const c = this.chartCenter;
    const k = ease.inOutSine(smoothstep(30.5, 34.5, b));
    const tgt = new THREE.Vector3(c.x, c.y + 6 * k, 0);
    const pos = new THREE.Vector3(c.x + 6 - 4 * k, c.y - 8 + 3 * k, 470 + 20 * k);
    return { pos, q: new THREE.Quaternion().setFromRotationMatrix(_m.lookAt(pos, tgt, new THREE.Vector3(0, 1, 0))), fov: 40 };
  }

  evaluate(b) {
    const w = ease.inOutCubic(smoothstep(29.6, 31.8, b)) * (1 - ease.inOutCubic(smoothstep(33.9, 35.4, b)));
    const f = this.followPose(b);
    if (w <= 0) return f;
    const r = this.revealPose(b);
    if (w >= 1) return r;
    return { pos: f.pos.clone().lerp(r.pos, w), q: f.q.clone().slerp(r.q, w), fov: lerp(f.fov, r.fov, w) };
  }

  apply(b, fx = {}) {
    const p = this.evaluate(b);
    this.cam.position.copy(p.pos);
    this.cam.quaternion.copy(p.q);
    this.cam.fov = p.fov + (fx.punch || 0);
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld(true);
    return this.cam;
  }
}
