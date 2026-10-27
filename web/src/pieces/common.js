import * as THREE from 'three';
import { setUniforms } from '../gfx/glow.js';
import { envelope } from '../util.js';

// A set piece: visible over [b0, b1] with fades. `center` is where the camera
// looks while the piece is on screen; `labels` are italic captions the HUD
// draws next to 3D points: { p: Vector3, text, b0, b1, dx, dy, size }.
export class Piece {
  constructor(b0, b1, fi = 0.25, fo = 0.4) {
    this.root = new THREE.Group();
    this.b0 = b0; this.b1 = b1; this.fi = fi; this.fo = fo;
    this.center = new THREE.Vector3();
    this.labels = [];
    this.g = 0;
  }
  gain(b) { return envelope(b, this.b0, this.b1, this.fi, this.fo); }
  update(b, ctx) {
    const g = this.gain(b);
    this.root.visible = g > 0.001;
    this.g = g;
    if (!this.root.visible) return false;
    setUniforms(this.root, { uTime: b, uPixel: ctx.pixelScale });
    return true;
  }
}

// line-art colour: everything except the head is monochrome
export const WHITE = [0.92, 0.93, 0.96];
export const DIM = [0.42, 0.44, 0.48];

// fade a realistic (lit) object in or out
export function setOpacity(obj, a) {
  obj.traverse((o) => {
    if (!o.material || o.material.isShaderMaterial) return;
    o.material.transparent = a < 0.999;
    o.material.opacity = a;
    o.material.depthWrite = a > 0.5;
  });
}
