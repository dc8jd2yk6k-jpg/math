// Black space: far stars, and the daylight sky of the percolation island.
// The dust and the reactive swarm live in world/particles.js.
import * as THREE from 'three';
import { mulberry32 } from '../time.js';

const CENTER = new THREE.Vector3(400, 600, 0);

export class Space {
  constructor() {
    this.root = new THREE.Group();
    const rnd = mulberry32(7);

    // far stars on a shell
    {
      const n = 6000;
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

    // daylight sky for the island world (a big inverted sphere, faded in by uWorld)
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, transparent: true,
      uniforms: { uWorld: { value: 0 }, uSun: { value: new THREE.Vector3(0.4, 0.55, -0.73).normalize() } },
      vertexShader: /* glsl */`varying vec3 vDir; void main() { vDir = normalize(position); vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = c.xyww; }`,
      fragmentShader: /* glsl */`
        uniform float uWorld; uniform vec3 uSun; varying vec3 vDir;
        void main() {
          float h = vDir.y;
          // linear HDR, chosen through the ACES curve: the display shows a clear
          // mid-blue 10-15 degrees up and a pale blue haze at the horizon
          vec3 zen = vec3(0.09, 0.16, 0.38), hor = vec3(0.27, 0.385, 0.70), low = vec3(0.22, 0.31, 0.56);
          vec3 c = h > 0.0 ? mix(hor, zen, pow(h, 0.5)) : mix(hor, low, pow(-h, 0.6));
          float s = max(0.0, dot(vDir, uSun));
          c += vec3(1.0, 0.92, 0.8) * (pow(s, 900.0) * 12.0 + pow(s, 12.0) * 0.2);
          gl_FragColor = vec4(c, uWorld);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -20;
    this.root.add(this.sky);
  }

  update({ camera, res, world = 0, starGain = 1 }) {
    this.stars.material.uniforms.uScale.value = res.x / 1080;
    this.stars.material.uniforms.uGain.value = starGain * (1 - world);
    this.sky.position.copy(camera.position);
    this.sky.scale.setScalar(camera.far * 0.9);
    this.skyMat.uniforms.uWorld.value = world;
    this.sky.visible = world > 0.001;
  }
}
