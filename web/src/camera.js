// One continuous camera. Shots are keyframes on the bar grid; every orbit
// parameter is interpolated with a monotone cubic over the keys (C1, no
// overshoot, periodic across the loop seam), so the camera moves only when a
// key asks it to. There is no beat-driven shake of any kind.
//
// Orbit parameters, all around a focus point:
//   az    azimuth around world up (0 = looking at the chart from +z)
//   el    elevation (+ above, looking down)
//   dist  distance to the focus
//   ox,oy where the focus sits on screen (-1..1)
//   roll  degrees (Dutch tilt), fov vertical degrees
// focus = lerp(anchor, head, kappa): anchor is a fixed point per key.
//
// Camera paths (CameraPath) take over for designed flights. Their first and
// last keys are sampled from the orbit camera at the hand-off bars, value and
// velocity, so a path joins the orbit camera exactly: nothing is cross-faded.
import * as THREE from 'three';
import { loopTrack, wrap, N_BARS } from './time.js';

const DEG = Math.PI / 180;
const PARAMS = ['az', 'el', 'dist', 'fov', 'roll', 'ox', 'oy', 'kappa', 'ax', 'ay', 'az_'];
const _m = new THREE.Matrix4();

export class Rig {
  // keys: [{ b, focus: 'head' | THREE.Vector3, kappa?, az, el, dist, fov?, roll?, ox?, oy? }]
  // headAt(b) -> Vector3
  constructor(keys, headAt, { aspect = 9 / 16 } = {}) {
    this.headAt = headAt;
    this.cam = new THREE.PerspectiveCamera(40, aspect, 0.05, 20000);
    this.scratch = new THREE.PerspectiveCamera(40, aspect, 0.05, 20000);
    const full = [];
    let prev = { az: 0, el: 0, dist: 30, fov: 40, roll: 0, ox: 0, oy: 0 };
    for (const k of [...keys].sort((a, b) => a.b - b.b)) {
      const v = { ...prev, ...k };
      for (const p of ['ox', 'oy', 'roll']) if (k[p] === undefined) v[p] = prev[p];
      let anchor;
      if (k.focus === 'head' || k.focus === undefined) {
        anchor = headAt(k.b);
        v.kappa = k.kappa ?? 1;
      } else {
        anchor = k.focus;
        v.kappa = k.kappa ?? 0;
      }
      v.ax = anchor.x; v.ay = anchor.y; v.az_ = anchor.z;
      full.push(v);
      prev = v;
    }
    this.keys = full;
    this.tracks = {};
    for (const p of PARAMS) this.tracks[p] = loopTrack(full.map((k) => [k.b, k[p]]));
    this.paths = [];
  }

  addPath(path) { this.paths.push(path); }

  orbitPose(b) {
    const t = this.tracks;
    const az = t.az(b) * DEG, el = t.el(b) * DEG, dist = Math.max(0.05, t.dist(b));
    const fov = t.fov(b), roll = t.roll(b) * DEG, ox = t.ox(b), oy = t.oy(b);
    const kappa = Math.min(1, Math.max(0, t.kappa(b)));
    const anchor = new THREE.Vector3(t.ax(b), t.ay(b), t.az_(b));
    const focus = kappa > 0 ? anchor.lerp(this.headAt(b), kappa) : anchor;
    // basis straight from the angles (never degenerate, even looking straight up/down)
    const back = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
    const up = new THREE.Vector3().crossVectors(back, right);
    const pos = focus.clone().addScaledVector(back, dist);
    const m = new THREE.Matrix4().makeBasis(right, up, back);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    // put the focus at (ox, oy) on screen, then roll
    const tv = Math.tan(fov * DEG / 2), th = tv * this.cam.aspect;
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan(ox * th)));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.atan(oy * tv)));
    if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
    return { pos, quat: q, fov, focus };
  }

  pose(b) {
    b = wrap(b);
    for (const path of this.paths) {
      const u = path.local(b);
      if (u !== null) return path.pose(u);
    }
    return this.orbitPose(b);
  }

  // set the THREE camera for bar b
  apply(b, cam = this.cam) {
    const p = this.pose(b);
    cam.position.copy(p.pos);
    cam.quaternion.copy(p.quat);
    cam.fov = p.fov;
    cam.near = Math.max(0.03, Math.min(2, p.pos.distanceTo(p.focus) * 0.01));
    cam.far = 30000;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    return cam;
  }

  // view-projection matrix and position at bar b, without touching the main camera
  viewProj(b, outVP, outPos) {
    const c = this.apply(b, this.scratch);
    outVP.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
    if (outPos) outPos.copy(c.position);
    return outVP;
  }

  // angular + linear speed of the camera around bar b (for motion-blur sampling)
  speed(b, db) {
    const a = this.pose(b - db / 2), c = this.pose(b + db / 2);
    return { ang: a.quat.angleTo(c.quat), lin: a.pos.distanceTo(c.pos), dist: a.pos.distanceTo(a.focus), fov: a.fov };
  }
}

// ---- designed flights

// Hermite interpolation with Catmull-Rom tangents in the bar domain (C1). End
// tangents can be given explicitly (the orbit camera's own velocity).
class HermiteTrack {
  constructor(ts, vs, t0 = null, t1 = null) {
    this.t = ts; this.v = vs;
    const n = ts.length, dim = vs[0].length;
    this.m = vs.map((_, i) => {
      if (i === 0 && t0) return t0;
      if (i === n - 1 && t1) return t1;
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      return Array.from({ length: dim }, (_, k) => (vs[b][k] - vs[a][k]) / (ts[b] - ts[a]));
    });
  }
  at(x) {
    const ts = this.t, n = ts.length;
    let i = 0;
    while (i < n - 2 && x > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i], s = Math.min(1, Math.max(0, (x - ts[i]) / h));
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    return this.v[i].map((p, k) => h00 * p + h10 * h * this.m[i][k] + h01 * this.v[i + 1][k] + h11 * h * this.m[i + 1][k]);
  }
}

// keys: [{ b, orbit: true } | { b, pos: Vector3, target: Vector3, roll?: deg, fov?: deg }]
// Bars may run past N_BARS (a path across the loop seam); `local` maps a
// wrapped bar into the path's own range.
export class CameraPath {
  constructor(rig, keys) {
    this.rig = rig;
    const ks = [...keys].sort((a, b) => a.b - b.b);
    this.b0 = ks[0].b; this.b1 = ks[ks.length - 1].b;
    const sample = (b) => {
      const p = rig.orbitPose(wrap(b));
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(p.quat);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(p.quat);
      const d = Math.min(400, Math.max(5, p.pos.distanceTo(p.focus)));
      return { pos: p.pos, target: p.pos.clone().addScaledVector(fwd, d), up, fov: p.fov };
    };
    const designed = (k) => {
      const fwd = k.target.clone().sub(k.pos).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      const up0 = new THREE.Vector3().crossVectors(right, fwd);
      const up = up0.applyAxisAngle(fwd, -(k.roll || 0) * DEG);
      return { pos: k.pos, target: k.target, up, fov: k.fov ?? 40 };
    };
    const flat = (s) => [...s.pos.toArray(), ...s.target.toArray(), ...s.up.toArray(), s.fov];
    const vals = ks.map((k) => flat(k.orbit ? sample(k.b) : designed(k)));
    // orbit end keys hand over their velocity too
    const deriv = (b) => {
      const e = 0.004, a = flat(sample(b - e)), c = flat(sample(b + e));
      return a.map((v, i) => (c[i] - v) / (2 * e));
    };
    this.track = new HermiteTrack(ks.map((k) => k.b), vals, ks[0].orbit ? deriv(this.b0) : null, ks[ks.length - 1].orbit ? deriv(this.b1) : null);
  }

  // the path's own bar for wrapped bar b, or null if the path is not active
  local(b) {
    if (b >= this.b0 && b <= this.b1) return b;
    if (this.b1 > N_BARS && b + N_BARS >= this.b0 && b + N_BARS <= this.b1) return b + N_BARS;
    return null;
  }

  pose(u) {
    const v = this.track.at(u);
    const pos = new THREE.Vector3(v[0], v[1], v[2]), target = new THREE.Vector3(v[3], v[4], v[5]);
    const up = new THREE.Vector3(v[6], v[7], v[8]).normalize();
    _m.lookAt(pos, target, up);
    return { pos, quat: new THREE.Quaternion().setFromRotationMatrix(_m), fov: v[9], focus: target };
  }
}

export { N_BARS };
