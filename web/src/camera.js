// One continuous camera. Shots are keyframes on the bar grid; every parameter
// is interpolated with a monotone cubic over the keys (C1, no overshoot, and
// periodic across the loop seam), so the camera never wobbles: it moves only
// when a key asks it to. Whips are simply keys placed close together.
//
// Orbit parameters, all around a focus point:
//   az    azimuth around world up (0 = looking at the chart from +z)
//   el    elevation (+ above, looking down)
//   dist  distance to the focus
//   ox,oy where the focus sits on screen (-1..1)
//   roll  degrees, fov vertical degrees
// focus = lerp(anchor, head, kappa): anchor is a fixed point per key.
// Path modes (the island fly-through) blend in on top with their own weight.
import * as THREE from 'three';
import { loopTrack, wrap, N_BARS } from './time.js';

const DEG = Math.PI / 180;
const PARAMS = ['az', 'el', 'dist', 'fov', 'roll', 'ox', 'oy', 'kappa', 'ax', 'ay', 'az_'];

export class Rig {
  // keys: [{ b, focus: 'head' | THREE.Vector3, kappa?, az, el, dist, fov?, roll?, ox?, oy? }]
  // headAt(b) -> Vector3
  constructor(keys, headAt, { aspect = 9 / 16 } = {}) {
    this.headAt = headAt;
    this.cam = new THREE.PerspectiveCamera(40, aspect, 0.05, 20000);
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
    this.paths = [];        // { weight(b) -> 0..1, pose(b) -> {pos, quat, fov} }
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
    let p = this.orbitPose(b);
    for (const path of this.paths) {
      const w = path.weight(b);
      if (w <= 0) continue;
      const q = path.pose(b);
      if (w >= 1) { p = { ...q, focus: p.focus }; continue; }
      p = { pos: p.pos.clone().lerp(q.pos, w), quat: p.quat.clone().slerp(q.quat, w), fov: p.fov + (q.fov - p.fov) * w, focus: p.focus };
    }
    return p;
  }

  // set the THREE camera for bar b; fx: { punch (deg), shake: Vector3 offset, shakeRot (rad) }
  apply(b, fx = {}) {
    const p = this.pose(b);
    const c = this.cam;
    c.position.copy(p.pos);
    if (fx.shake) c.position.add(fx.shake);
    c.quaternion.copy(p.quat);
    if (fx.shakeRot) c.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(fx.shakeRot.x, fx.shakeRot.y, fx.shakeRot.z)));
    c.fov = Math.max(5, p.fov - (fx.punch || 0));
    c.near = fx.near ?? Math.max(0.03, Math.min(2, p.pos.distanceTo(p.focus) * 0.01));
    c.far = fx.far ?? 30000;
    c.updateProjectionMatrix();
    c.updateMatrixWorld(true);
    return c;
  }

  // angular + linear speed of the camera around bar b (for motion-blur sampling)
  speed(b, db) {
    const a = this.pose(b - db / 2), c = this.pose(b + db / 2);
    return { ang: a.quat.angleTo(c.quat), lin: a.pos.distanceTo(c.pos), dist: a.pos.distanceTo(a.focus) };
  }
}

export { N_BARS };
