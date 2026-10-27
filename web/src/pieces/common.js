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

// soft contact shadow: a dark radial disc on the board under a piece
// (shadow maps band badly in software rendering; this never does)
const blobGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
const blobMat = new THREE.ShaderMaterial({
  uniforms: { uOpacity: { value: 1 } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform float uOpacity; varying vec2 vP; void main(){ float r = length(vP); gl_FragColor = vec4(0.0, 0.0, 0.0, 0.62 * uOpacity * smoothstep(1.0, 0.25, r)); }',
  transparent: true, depthWrite: false,
});
export function contactShadow(radius) {
  const m = new THREE.Mesh(blobGeo, blobMat);
  m.scale.setScalar(radius);
  m.position.y = 0.01;
  m.renderOrder = 1;
  return m;
}
export const CONTACT_MATERIAL = blobMat;

// fade a realistic (lit) object in or out
export function setOpacity(obj, a) {
  CONTACT_MATERIAL.uniforms.uOpacity.value = a;
  obj.traverse((o) => {
    if (!o.material || o.material.isShaderMaterial) return;
    o.material.transparent = a < 0.999;
    o.material.opacity = a;
    o.material.depthWrite = a > 0.5;
  });
}
