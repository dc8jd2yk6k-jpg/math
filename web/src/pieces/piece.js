// Base class for set pieces. A piece is a pure function of the bar b and the
// head's position: it appears once the head has reached it (so the rewind
// takes it away again) and plays its own animation inside its window.
import * as THREE from 'three';
import { clamp } from '../time.js';

export class Piece {
  constructor(id, { appearS = 0, window = [0, 0] } = {}) {
    this.id = id;
    this.root = new THREE.Group();
    this.root.name = id;
    this.appearS = appearS;     // visible when the head is beyond this arc length
    this.window = window;       // bars in which the piece animates
  }

  // 0..1: how far the head is past the appear point (fades in over `span` units)
  presence(ctx, span = 6) { return clamp((ctx.headS - this.appearS) / span + 1); }

  // 0..1 progress through the window; 1 after it, 0 before it (in the current lap)
  progress(b, a = this.window[0], z = this.window[1]) { return clamp((b - a) / (z - a)); }

  // visibility: present, and either near the camera or in the pull-back
  shown(ctx, center, far = 450) {
    const b = ctx.b;
    return this.presence(ctx) > 0 && (b > 38.3 && b < 41.6 || ctx.camera.position.distanceTo(center) < far);
  }

  update() {}
  labels() { return []; }
}

// line-art helpers
export function lineMaterial(color = 0xffffff, opacity = 1, gain = 1) {
  return new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(gain), transparent: true, opacity, depthWrite: false });
}

export function polyline(points, mat) {
  const g = new THREE.BufferGeometry().setFromPoints(points);
  const l = new THREE.Line(g, mat);
  l.frustumCulled = false;
  return l;
}

export class Placeholder extends Piece {
  constructor(id, center, size = 10, opts = {}) {
    super(id, opts);
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size)), lineMaterial(0x8899ff, 0.6, 1.5));
    box.position.copy(center);
    this.root.add(box);
    this.box = box;
  }
  update(b, ctx) {
    const p = this.presence(ctx);
    this.root.visible = p > 0;
    this.box.material.opacity = 0.6 * p;
    this.box.rotation.y = b * 0.3;
  }
}
