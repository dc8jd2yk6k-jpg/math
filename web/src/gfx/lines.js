// Screen-space line segments with real pixel widths and progressive reveal.
// Each segment carries a reveal interval [k0, k1]: with uReveal = r, the
// segment is drawn from a toward b up to fraction (r - k0) / (k1 - k0). This
// is how strokes, edges and trees "draw themselves".
import * as THREE from 'three';

const vert = /* glsl */`
  uniform vec2 uRes; uniform float uReveal; uniform float uWidthScale;
  attribute vec3 pa; attribute vec3 pb; attribute vec2 corner; attribute vec2 keys;
  attribute vec4 col; attribute float width;
  varying vec4 vCol; varying float vSide; varying float vHalf;
  void main() {
    float f = keys.y > keys.x ? clamp((uReveal - keys.x) / (keys.y - keys.x), 0.0, 1.0) : step(keys.x, uReveal);
    vec3 b = mix(pa, pb, f);
    vec3 p = corner.x < 0.5 ? pa : b;
    vec4 ca = projectionMatrix * modelViewMatrix * vec4(pa, 1.0);
    vec4 cb = projectionMatrix * modelViewMatrix * vec4(pb, 1.0);
    vec4 c = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    vec2 sa = ca.xy / max(abs(ca.w), 1e-4) * uRes * 0.5;
    vec2 sb = cb.xy / max(abs(cb.w), 1e-4) * uRes * 0.5;
    vec2 d = sb - sa;
    d = length(d) > 1e-5 ? normalize(d) : vec2(1.0, 0.0);
    vec2 n = vec2(-d.y, d.x);
    float hw = width * uWidthScale * 0.5 + 1.0;
    c.xy += (n * corner.y * hw + d * (corner.x * 2.0 - 1.0) * hw * 0.5) / (uRes * 0.5) * c.w;
    gl_Position = c;
    vCol = col * (f > 0.0 ? 1.0 : 0.0);
    vSide = corner.y * hw;
    vHalf = width * uWidthScale * 0.5;
  }`;

const frag = /* glsl */`
  uniform float uGain; uniform float uOpacity;
  varying vec4 vCol; varying float vSide; varying float vHalf;
  void main() {
    float a = (1.0 - smoothstep(vHalf - 0.5, vHalf + 0.9, abs(vSide))) * vCol.a * uOpacity;
    if (a <= 0.002) discard;
    gl_FragColor = vec4(vCol.rgb * uGain, a);
  }`;

export class Lines {
  // segs: [{ a: Vector3, b: Vector3, k0, k1, color: [r,g,b], alpha, width }]
  constructor(segs, { blending = THREE.NormalBlending, depthTest = true } = {}) {
    const n = segs.length;
    const pa = new Float32Array(n * 12), pb = new Float32Array(n * 12), corner = new Float32Array(n * 8);
    const keys = new Float32Array(n * 8), col = new Float32Array(n * 16), width = new Float32Array(n * 4);
    const idx = new Uint32Array(n * 6);
    const C = [[0, -1], [0, 1], [1, -1], [1, 1]];
    segs.forEach((s, i) => {
      const c = s.color || [1, 1, 1];
      for (let k = 0; k < 4; k++) {
        const j = i * 4 + k;
        pa.set([s.a.x, s.a.y, s.a.z], j * 3);
        pb.set([s.b.x, s.b.y, s.b.z], j * 3);
        corner.set(C[k], j * 2);
        keys.set([s.k0 ?? 0, s.k1 ?? 0], j * 2);
        col.set([c[0], c[1], c[2], s.alpha ?? 1], j * 4);
        width[j] = s.width ?? 1.6;
      }
      const a = i * 4;
      idx.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], i * 6);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pa.slice(), 3));
    g.setAttribute('pa', new THREE.BufferAttribute(pa, 3));
    g.setAttribute('pb', new THREE.BufferAttribute(pb, 3));
    g.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
    g.setAttribute('keys', new THREE.BufferAttribute(keys, 2));
    g.setAttribute('col', new THREE.BufferAttribute(col, 4));
    g.setAttribute('width', new THREE.BufferAttribute(width, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, depthTest, blending,
      uniforms: { uRes: { value: new THREE.Vector2(1080, 1920) }, uReveal: { value: 1e9 }, uGain: { value: 1 }, uOpacity: { value: 1 }, uWidthScale: { value: 1 } },
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.geometry = g;
  }

  set({ reveal, gain, opacity, res }) {
    const u = this.material.uniforms;
    if (reveal !== undefined) u.uReveal.value = reveal;
    if (gain !== undefined) u.uGain.value = gain;
    if (opacity !== undefined) u.uOpacity.value = opacity;
    if (res) { u.uRes.value.copy(res); u.uWidthScale.value = res.x / 1080; }
  }
}

// convenience: polyline -> segments with cumulative reveal keys starting at k
export function strokeSegs(points, { k = 0, dk = 1, color, alpha, width } = {}) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += points[i].distanceTo(points[i - 1]);
  const segs = [];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const l = points[i].distanceTo(points[i - 1]);
    segs.push({ a: points[i - 1], b: points[i], k0: k + dk * acc / total, k1: k + dk * (acc + l) / total, color, alpha, width });
    acc += l;
  }
  return segs;
}
