// The head: a hot red point with a halo, drawn as a camera-facing sprite of
// constant pixel size so it reads the same up close and in the pull-back.
import * as THREE from 'three';

export class Head {
  constructor() {
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
      uniforms: { uPx: { value: 40 }, uRes: { value: new THREE.Vector2(1080, 1920) }, uGain: { value: 1 }, uColor: { value: new THREE.Color(1, 0.16, 0.08) } },
      vertexShader: /* glsl */`
        uniform float uPx; uniform vec2 uRes; varying vec2 vUv;
        void main() {
          vUv = position.xy;
          vec4 c = projectionMatrix * modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          c.xy += position.xy * uPx / uRes * 2.0 * c.w;
          gl_Position = c;
        }`,
      fragmentShader: /* glsl */`
        uniform float uGain; uniform vec3 uColor; varying vec2 vUv;
        void main() {
          float r = length(vUv) * 2.0;
          float core = exp(-r * r * 60.0);
          float glow = exp(-r * r * 9.0) * 0.55 + exp(-r * 4.5) * 0.12;
          vec3 c = uColor * (glow * 2.2) + mix(uColor, vec3(1.0, 0.85, 0.75), 0.55) * core * 9.0;
          float a = clamp(core + glow, 0.0, 1.0);
          if (a < 0.002) discard;
          gl_FragColor = vec4(c * uGain, 1.0);
        }`,
    });
    const g = new THREE.PlaneGeometry(1, 1);
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
  }

  update({ pos, res, px = 40, gain = 1 }) {
    this.mesh.position.copy(pos);
    const u = this.material.uniforms;
    u.uPx.value = px * res.x / 1080;
    u.uRes.value.copy(res);
    u.uGain.value = gain;
  }
}
