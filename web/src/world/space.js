// Black space: far stars, near dust that streaks with camera motion, soft
// out-of-focus motes, and the daylight sky of the percolation island.
import * as THREE from 'three';
import { mulberry32 } from '../time.js';

const CENTER = new THREE.Vector3(400, 600, 0);

export class Space {
  constructor() {
    this.root = new THREE.Group();
    const rnd = mulberry32(7);

    // far stars on a shell
    {
      const n = 5200;
      const p = new Float32Array(n * 3), m = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = 5000 + rnd() * 2500;
        const q = Math.sqrt(1 - u * u);
        p.set([CENTER.x + r * q * Math.cos(th), CENTER.y + r * u, CENTER.z + r * q * Math.sin(th)], i * 3);
        const big = rnd() < 0.06;
        m.set([big ? 2.2 + rnd() * 1.6 : 1.1 + rnd() * 1.1, Math.pow(rnd(), 2.2) * (big ? 1.3 : 0.75) + 0.08], i * 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      g.setAttribute('meta', new THREE.BufferAttribute(m, 2));
      this.stars = new THREE.Points(g, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uScale: { value: 1 }, uGain: { value: 1 } },
        vertexShader: /* glsl */`
          uniform float uScale; attribute vec2 meta; varying float vB;
          void main() { vB = meta.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.99999; gl_PointSize = meta.x * uScale; }`,
        fragmentShader: /* glsl */`
          uniform float uGain; varying float vB;
          void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = exp(-r * r * 3.5); gl_FragColor = vec4(vec3(0.9, 0.93, 1.0) * vB * a * uGain, 1.0); }`,
      }));
      this.stars.frustumCulled = false;
      this.stars.renderOrder = -10;
      this.root.add(this.stars);
    }

    // near dust: a box of particles that wraps around the camera and is drawn
    // as streaks between the current and previous projected positions
    {
      const n = 2600, L = 1;
      const seed = new Float32Array(n * 4 * 4), corner = new Float32Array(n * 4 * 2);
      const idx = new Uint32Array(n * 6);
      for (let i = 0; i < n; i++) {
        const s = [rnd(), rnd(), rnd(), rnd()];
        for (let k = 0; k < 4; k++) {
          seed.set(s, (i * 4 + k) * 4);
          corner.set([k >> 1, (k & 1) ? 1 : -1], (i * 4 + k) * 2);
        }
        const a = i * 4;
        idx.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], i * 6);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3));
      g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
      g.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      this.dustMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: {
          uCam: { value: new THREE.Vector3() }, uBox: { value: 90 }, uPrevVP: { value: new THREE.Matrix4() },
          uRes: { value: new THREE.Vector2(1080, 1920) }, uGain: { value: 1 }, uStreak: { value: 1 }, uSize: { value: 1 },
        },
        vertexShader: /* glsl */`
          uniform vec3 uCam; uniform float uBox; uniform mat4 uPrevVP; uniform vec2 uRes; uniform float uStreak; uniform float uSize;
          attribute vec4 seed; attribute vec2 corner;
          varying float vA; varying vec2 vC; varying float vLen;
          void main() {
            vec3 rel = mod(seed.xyz * uBox - uCam + 0.5 * uBox, uBox) - 0.5 * uBox;
            vec3 wp = uCam + rel;
            vec4 c = projectionMatrix * viewMatrix * vec4(wp, 1.0);
            vec4 p = uPrevVP * vec4(wp, 1.0);
            float dist = length(rel);
            float fadeBox = 1.0 - smoothstep(0.3 * uBox, 0.5 * uBox, dist);
            vec2 sc = c.xy / max(c.w, 1e-3) * uRes * 0.5;
            vec2 sp = p.xy / max(p.w, 1e-3) * uRes * 0.5;
            vec2 v = (sc - sp) * uStreak;
            float L = length(v);
            if (p.w <= 0.0 || L > uRes.y) { v = vec2(0.0); L = 0.0; }
            vec2 dir = L > 1e-3 ? v / L : vec2(1.0, 0.0);
            vec2 nrm = vec2(-dir.y, dir.x);
            float size = mix(1.2, 3.2, seed.w) * uSize * (uRes.x / 1080.0);
            vec2 off = nrm * corner.y * size - dir * corner.x * L + dir * (corner.x * 2.0 - 1.0) * size * 0.5;
            c.xy += off / (uRes * 0.5) * c.w;
            gl_Position = c;
            float energy = size / (size + L);
            vA = fadeBox * (0.25 + 0.75 * seed.w) * smoothstep(0.5, 3.0, dist) * mix(1.0, energy, 0.65);
            vC = vec2(corner.x, corner.y);
            vLen = L;
          }`,
        fragmentShader: /* glsl */`
          uniform float uGain; varying float vA; varying vec2 vC; varying float vLen;
          void main() { float a = vA * (1.0 - abs(vC.y)) ; gl_FragColor = vec4(vec3(0.85, 0.88, 0.95) * a * uGain, 1.0); }`,
      });
      this.dust = new THREE.Mesh(g, this.dustMat);
      this.dust.frustumCulled = false;
      this.dust.renderOrder = -5;
      this.root.add(this.dust);
    }

    // daylight sky for the island world (a big inverted sphere, faded in by uWorld)
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, transparent: true,
      uniforms: { uWorld: { value: 0 }, uSun: { value: new THREE.Vector3(0.4, 0.55, -0.73).normalize() } },
      vertexShader: /* glsl */`varying vec3 vDir; void main() { vDir = normalize(position); vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = c.xyww; }`,
      fragmentShader: /* glsl */`
        uniform float uWorld; uniform vec3 uSun; varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 zen = vec3(0.20, 0.36, 0.66), hor = vec3(0.70, 0.78, 0.88), low = vec3(0.50, 0.58, 0.68);
          vec3 c = h > 0.0 ? mix(hor, zen, pow(h, 0.55)) : mix(hor, low, pow(-h, 0.6));
          float s = max(0.0, dot(vDir, uSun));
          c += vec3(1.0, 0.92, 0.8) * (pow(s, 900.0) * 12.0 + pow(s, 12.0) * 0.25);
          gl_FragColor = vec4(c * 1.15, uWorld);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -20;
    this.root.add(this.sky);
  }

  update({ camera, prevVP, res, world = 0, dustGain = 1, starGain = 1, streak = 1 }) {
    const d = this.dustMat.uniforms;
    d.uCam.value.copy(camera.position);
    d.uPrevVP.value.copy(prevVP);
    d.uRes.value.copy(res);
    d.uGain.value = dustGain * (1 - world);
    d.uStreak.value = streak;
    this.stars.material.uniforms.uScale.value = res.x / 1080;
    this.stars.material.uniforms.uGain.value = starGain * (1 - world);
    this.sky.position.copy(camera.position);
    this.sky.scale.setScalar(camera.far * 0.9);
    this.skyMat.uniforms.uWorld.value = world;
    this.sky.visible = world > 0.001;
  }
}
