// The luminous trail: a ribbon of constant pixel width along the curve, cut
// off at the head (uHeadS), white along its length and reddening into the head.
import * as THREE from 'three';
import { SAMPLES, N_SAMPLES, posAtS, tanAtS, S_OF } from '../curve.js';
import { MILESTONES } from '../data.js';

const vert = /* glsl */`
  uniform vec2 uRes;
  uniform float uWidth;
  attribute vec3 tang;
  attribute float arc;
  attribute float side;
  varying float vArc;
  varying float vSide;
  varying float vDepth;
  void main() {
    vec4 m0 = modelViewMatrix * vec4(position, 1.0);
    float eps = 0.01 * max(0.2, -m0.z);
    vec4 m1 = modelViewMatrix * vec4(position + tang * eps, 1.0);
    vec4 c0 = projectionMatrix * m0;
    vec4 c1 = projectionMatrix * m1;
    vec2 s0 = c0.xy / c0.w * uRes * 0.5;
    vec2 s1 = c1.xy / c1.w * uRes * 0.5;
    vec2 d = s1 - s0;
    d = length(d) > 1e-6 ? normalize(d) : vec2(1.0, 0.0);
    vec2 n = vec2(-d.y, d.x);
    float half_ = uWidth * 0.5 + 1.0;
    c0.xy += n * side * half_ / (uRes * 0.5) * c0.w;
    gl_Position = c0;
    vArc = arc;
    vSide = side * half_;
    vDepth = -m0.z;
  }
`;

const frag = /* glsl */`
  uniform float uHeadS;
  uniform float uRedLen;
  uniform float uWidth;
  uniform float uGain;
  uniform float uNear;
  uniform vec3 uWhite;
  uniform vec3 uRed;
  varying float vArc;
  varying float vSide;
  varying float vDepth;
  void main() {
    if (vArc > uHeadS) discard;
    float hw = uWidth * 0.5;
    float a = 1.0 - smoothstep(hw - 0.6, hw + 0.9, abs(vSide));
    float k = clamp((uHeadS - vArc) / uRedLen, 0.0, 1.0);
    float red = 1.0 - smoothstep(0.0, 1.0, k);
    vec3 col = mix(uWhite, uRed, red) * (1.0 + 1.6 * red * red);
    a *= smoothstep(uNear, uNear * 3.0, vDepth);      // fade right in front of the lens
    gl_FragColor = vec4(col * uGain, a);
  }
`;

export class Trail {
  constructor() {
    const n = N_SAMPLES;
    const pos = new Float32Array(n * 2 * 3), tng = new Float32Array(n * 2 * 3);
    const arc = new Float32Array(n * 2), side = new Float32Array(n * 2);
    const t = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      tanAtS(SAMPLES.s[i], 0.05, t);
      for (let k = 0; k < 2; k++) {
        const j = i * 2 + k;
        pos[j * 3] = SAMPLES.x[i]; pos[j * 3 + 1] = SAMPLES.y[i]; pos[j * 3 + 2] = 0;
        tng[j * 3] = t.x; tng[j * 3 + 1] = t.y; tng[j * 3 + 2] = t.z;
        arc[j] = SAMPLES.s[i]; side[j] = k ? 1 : -1;
      }
    }
    const idx = new Uint32Array((n - 1) * 6);
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.set([a, c, b, b, c, d], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('tang', new THREE.BufferAttribute(tng, 3));
    g.setAttribute('arc', new THREE.BufferAttribute(arc, 1));
    g.setAttribute('side', new THREE.BufferAttribute(side, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(400, 600, 0), 1e5);
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
      uniforms: {
        uRes: { value: new THREE.Vector2(1080, 1920) }, uWidth: { value: 2.4 }, uHeadS: { value: 0 },
        uRedLen: { value: 30 }, uGain: { value: 1 }, uNear: { value: 0.05 },
        uWhite: { value: new THREE.Color(0.92, 0.93, 0.98) }, uRed: { value: new THREE.Color(1.0, 0.13, 0.08) },
      },
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;

    // milestone dots on the line
    const dg = new THREE.BufferGeometry();
    const dp = new Float32Array(MILESTONES.length * 3), ds = new Float32Array(MILESTONES.length);
    MILESTONES.forEach((m, i) => { const p = posAtS(S_OF[m.id]); dp.set([p.x, p.y, p.z], i * 3); ds[i] = S_OF[m.id]; });
    dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    dg.setAttribute('arc', new THREE.BufferAttribute(ds, 1));
    this.dots = new THREE.Points(dg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uHeadS: { value: 0 }, uSize: { value: 7 }, uGain: { value: 1 } },
      vertexShader: /* glsl */`
        uniform float uHeadS; uniform float uSize; attribute float arc; varying float vOn;
        void main() { vOn = step(arc, uHeadS - 0.5); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize; }`,
      fragmentShader: /* glsl */`
        uniform float uGain; varying float vOn;
        void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = (1.0 - smoothstep(0.55, 1.0, r)) * vOn; if (a <= 0.0) discard; gl_FragColor = vec4(vec3(1.6) * uGain, a); }`,
    }));
    this.dots.frustumCulled = false;
    this.dots.renderOrder = 6;
    this.root = new THREE.Group();
    this.root.add(this.mesh, this.dots);
  }

  update({ headS, camera, res, width = 2.4, gain = 1, redLen }) {
    const u = this.material.uniforms;
    u.uHeadS.value = headS;
    u.uRes.value.copy(res);
    u.uWidth.value = width * res.x / 1080;
    u.uGain.value = gain;
    u.uRedLen.value = redLen;
    u.uNear.value = camera.near * 4;
    this.dots.material.uniforms.uHeadS.value = headS;
    this.dots.material.uniforms.uSize.value = 7 * res.x / 1080;
    this.dots.material.uniforms.uGain.value = gain;
  }
}
