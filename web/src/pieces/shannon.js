// 1950 · Claude Shannon. The head waits at the origin inside concentric red
// rings that pulse with the drums; then it launches along the time axis.
import * as THREE from 'three';
import { Piece } from './piece.js';
import { Lines } from '../gfx/lines.js';
import { hitEnv, smoothstep, wrap } from '../time.js';
import { posAtS } from '../curve.js';

export class Shannon extends Piece {
  constructor() {
    super('shannon', { appearS: -1e9, window: [1.9, 3.2] });
    this.center = posAtS(0);
    const segs = [];
    const N = 13;
    for (let i = 0; i < N; i++) {
      const r = 0.55 + i * 0.09;
      const a = 0.85 * (1 - i / N) + 0.1;
      for (let k = 0; k < 96; k++) {
        const t0 = (k / 96) * Math.PI * 2, t1 = ((k + 1) / 96) * Math.PI * 2;
        // rings lie in the plane normal to the line's direction (+x)
        segs.push({ a: new THREE.Vector3(0, Math.cos(t0) * r, Math.sin(t0) * r), b: new THREE.Vector3(0, Math.cos(t1) * r, Math.sin(t1) * r),
          color: [1.0, 0.16, 0.1], alpha: a, width: 1.3 });
      }
    }
    this.rings = new Lines(segs, { blending: THREE.AdditiveBlending });
    this.rings.mesh.position.copy(this.center);
    this.root.add(this.rings.mesh);
  }

  update(b, ctx) {
    b = wrap(b);
    const on = smoothstep(1.86, 2.0, b) * (1 - smoothstep(2.9, 3.25, b));
    this.root.visible = on > 0.001;
    if (!this.root.visible) return;
    const pulse = hitEnv(b, { min: 0.5, decay: 8, from: 1.9, to: 3.2 });
    const grow = 1 + 0.6 * smoothstep(2.5, 3.2, b);
    this.rings.mesh.scale.setScalar(grow * (1 + 0.06 * pulse));
    this.rings.mesh.rotation.x = b * 0.4;
    this.rings.set({ res: ctx.res, opacity: on, gain: 1.4 + 1.2 * pulse });
  }

  labels(b) {
    b = wrap(b);
    const a = smoothstep(2.1, 2.3, b) * (1 - smoothstep(2.7, 2.95, b));
    return [
      { p: this.center.clone().add(new THREE.Vector3(0, -2.3, 0)), text: '10^{120}', style: 'serif', size: 44, align: 'center', alpha: a },
      { p: this.center.clone().add(new THREE.Vector3(0, -2.3, 0)), dy: 30, text: 'possible games of chess', style: 'label', size: 19, align: 'center', alpha: a * 0.8, color: 'rgba(200,202,214,1)' },
    ];
  }
}
