// The persistent world: sparse stars, fine dust, the line, its red head, and
// (for the reveal only) the time axis with milestone markers.
import * as THREE from 'three';
import { makeSegments, makePoints } from './gfx/glow.js';
import { lineSamples, spineOfYear, xOfYear, MILESTONE_YEARS } from './curve.js';
import { MILESTONES } from './data.js';
import { rng, hexToRgb } from './util.js';
import { PALETTE } from './config.js';

const LINE_VS = /* glsl */`
  attribute vec3 prev;
  attribute vec3 next;
  attribute float side;
  attribute float param;
  uniform float uPixel;
  uniform float uWidthPx;
  uniform float uHead;
  uniform vec3 uHeadPos;
  varying float vSide;
  varying float vAge;
  varying float vDist;
  void main() {
    vDist = distance(position, uHeadPos);
    vec4 vp = modelViewMatrix * vec4(position, 1.0);
    vec4 a = modelViewMatrix * vec4(prev, 1.0);
    vec4 c = modelViewMatrix * vec4(next, 1.0);
    vec3 dir = c.xyz - a.xyz;
    if (length(dir) < 1e-6) dir = vec3(0.0, 1.0, 0.0);
    vec3 sd = normalize(cross(normalize(dir), normalize(-vp.xyz)));
    float w = uWidthPx / (uPixel / max(-vp.z, 1e-3));       // constant width in pixels
    vp.xyz += sd * side * w * 0.5;
    vSide = side;
    vAge = uHead - param;
    gl_Position = projectionMatrix * vp;
  }`;
const LINE_FS = /* glsl */`
  uniform float uGain;
  uniform float uRedLen;
  uniform vec3 uRed;
  varying float vSide;
  varying float vAge;
  varying float vDist;
  void main() {
    if (vAge < 0.0) discard;
    float d = vSide * vSide;
    float a = exp(-d * 5.0) * 0.55 + exp(-d * 40.0);
    float r = 1.0 - smoothstep(0.0, uRedLen, vDist);   // reddens over a fixed on-screen length
    vec3 col = mix(vec3(0.82, 0.84, 0.88), uRed * 1.6, r * r);
    float core = exp(-d * 40.0);
    gl_FragColor = vec4(col * a * uGain, core * 0.6 * uGain);   // premultiplied: the core also covers what is behind
  }`;

function makeLine(samples) {
  const n = samples.length;
  const pos = new Float32Array(n * 6), prev = new Float32Array(n * 6), next = new Float32Array(n * 6);
  const side = new Float32Array(n * 2), param = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const p = samples[i].p, pp = samples[Math.max(0, i - 1)].p, pn = samples[Math.min(n - 1, i + 1)].p;
    for (let k = 0; k < 2; k++) {
      const j = i * 2 + k;
      pos.set([p.x, p.y, p.z], j * 3); prev.set([pp.x, pp.y, pp.z], j * 3); next.set([pn.x, pn.y, pn.z], j * 3);
      side[j] = k ? 1 : -1; param[j] = samples[i].u;
    }
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('prev', new THREE.BufferAttribute(prev, 3));
  geo.setAttribute('next', new THREE.BufferAttribute(next, 3));
  geo.setAttribute('side', new THREE.BufferAttribute(side, 1));
  geo.setAttribute('param', new THREE.BufferAttribute(param, 1));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    vertexShader: LINE_VS, fragmentShader: LINE_FS,
    uniforms: {
      uPixel: { value: 1000 }, uWidthPx: { value: 2.6 }, uHead: { value: 0 }, uGain: { value: 1 },
      uRedLen: { value: 8 }, uHeadPos: { value: new THREE.Vector3() }, uRed: { value: new THREE.Color(...hexToRgb(PALETTE.head)) },
    },
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

export class World {
  constructor() {
    this.root = new THREE.Group();
    // sparse stars at infinity
    const r = rng(11);
    const stars = [];
    for (let i = 0; i < 1500; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const d = new THREE.Vector3(s * Math.cos(th), u, s * Math.sin(th)).multiplyScalar(3000);
      const m = Math.pow(r(), 5) * 1.6 + 0.12;
      stars.push({ p: d, color: [m, m, m * 1.05], size: 2 + 3 * r(), motion: [r() * 6.28, 0.4 + r() * 1.5, 0, 0] });
    }
    this.stars = makePoints(stars, { minPx: 1.2, maxPx: 2.4, displace: { body: 'alpha = 0.8 + 0.2 * sin(uTime * motion.y + motion.x);' } });
    this.root.add(this.stars);

    // fine dust around the camera: parallax and a sense of speed
    const dust = [];
    for (let i = 0; i < 900; i++) dust.push({ p: new THREE.Vector3(r(), r(), r()), color: [0.75, 0.78, 0.85], size: 0.035 + r() * 0.05, motion: [r(), 0, 0, 0] });
    this.dust = makePoints(dust, {
      minPx: 1.0, maxPx: 4,
      uniforms: { uCam: { value: new THREE.Vector3() }, uBox: { value: 70 }, uDustGain: { value: 1 } },
      displace: {
        header: 'uniform vec3 uCam; uniform float uBox; uniform float uDustGain;',
        body: `
          vec3 q = position * uBox;
          P = uCam + mod(q - uCam + uBox * 0.5, uBox) - uBox * 0.5;
          float dd = length(P - uCam) / (uBox * 0.5);
          alpha = uDustGain * smoothstep(1.0, 0.5, dd) * smoothstep(0.03, 0.15, dd) * (0.35 + 0.65 * motion.x);`,
      },
    });
    this.root.add(this.dust);

    // the line and its head
    this.line = makeLine(lineSamples());
    this.root.add(this.line);
    this.head = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      uniforms: { uRed: { value: new THREE.Color(...hexToRgb(PALETTE.head)) }, uGain: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        uniform vec3 uRed; uniform float uGain; varying vec2 vUv;
        void main() {
          float r = length(vUv);
          float core = exp(-r * r * 260.0);
          float glow = exp(-r * r * 22.0) * 0.9 + exp(-r * 4.5) * 0.25;
          vec3 c = uRed * (glow * 1.6 + core * 2.5) + vec3(1.0, 0.85, 0.8) * core * 2.0;
          float cover = exp(-r * r * 60.0);
          gl_FragColor = vec4(c * uGain * smoothstep(1.0, 0.6, r), cover * uGain);
        }`,
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
    this.head.frustumCulled = false;
    this.head.renderOrder = 10;
    this.root.add(this.head);

    // reveal: time axis under the curve and a dot per milestone
    const y = -12, x0 = xOfYear(1950), x1 = xOfYear(2026.82);
    const grey = [0.55, 0.57, 0.62];
    const ax = [{ a: new THREE.Vector3(x0 - 4, y, 0), b: new THREE.Vector3(x1 + 6, y, 0), color: grey, width: 0.25 }];
    for (const yr of [1950, 1970, 1990, 2010, 2026]) {
      const x = xOfYear(yr);
      ax.push({ a: new THREE.Vector3(x, y, 0), b: new THREE.Vector3(x, y - 2.5, 0), color: yr === 2026 ? hexToRgb(PALETTE.head) : grey, width: 0.25 });
    }
    this.axis = makeSegments(ax, { minPx: 1.6, core: 0.5 });
    this.axisY = y;
    this.root.add(this.axis);
    this.markers = makePoints(MILESTONES.slice(1).map((m, i) => ({ p: spineOfYear(MILESTONE_YEARS[i + 1]), color: [1.2, 1.2, 1.25], size: 1.2 })), { minPx: 5, maxPx: 9 });
    this.root.add(this.markers);
  }

  update(ctx) {
    const { b, camera, headPos, hp, pixelScale } = ctx;
    for (const o of [this.stars, this.dust, this.axis, this.markers]) {
      o.material.uniforms.uTime.value = b;
      o.material.uniforms.uPixel.value = pixelScale;
    }
    this.stars.material.uniforms.uGain.value = hp.starGain;
    this.dust.material.uniforms.uCam.value.copy(camera.position);
    this.dust.material.uniforms.uDustGain.value = hp.dustGain;
    this.axis.material.uniforms.uGain.value = hp.revealGain;
    this.markers.material.uniforms.uGain.value = hp.revealGain;

    const lu = this.line.material.uniforms;
    lu.uHead.value = ctx.u; lu.uPixel.value = pixelScale; lu.uGain.value = hp.lineGain;
    lu.uWidthPx.value = hp.lineWidthPx;

    this.head.position.copy(headPos);
    this.head.quaternion.copy(camera.quaternion);
    const dist = camera.position.distanceTo(headPos);
    this.head.scale.setScalar((hp.headPx / pixelScale) * dist);
    this.head.material.uniforms.uGain.value = hp.headGain;
  }
}
