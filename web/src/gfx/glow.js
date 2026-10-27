// Luminous primitives. Everything is additive light with a soft gaussian
// profile, so the film needs no MSAA (software rendering friendly) and never
// aliases: ribbons for lines, soft sprites for points.
import * as THREE from 'three';

const COMMON = /* glsl */`
  uniform float uTime;      // bars
  uniform float uPixel;     // world-to-pixel scale helper (viewport height in px)
  uniform float uGain;
`;

// ---------------------------------------------------------------- segments
// Each segment: p0, p1, color (rgb), width (world), born (bars), grow (bars),
// die (bars). The segment grows from p0 to p1 over [born, born+grow].
const SEG_VS = /* glsl */`
  ${COMMON}
  attribute vec3 p0;
  attribute vec3 p1;
  attribute vec3 color;
  attribute vec4 anim;      // born, grow, die, fadeOut
  attribute vec2 wa;        // width, alpha
  attribute vec2 corner;    // x: 0 at p0 / 1 at p1, y: -1/+1 side
  uniform float uMinPx;
  varying vec3 vColor;
  varying float vSide;
  varying float vAlpha;
  varying float vAlong;
  void main() {
    float born = anim.x, grow = max(anim.y, 1e-4), die = anim.z, fo = max(anim.w, 1e-4);
    float g = clamp((uTime - born) / grow, 0.0, 1.0);
    float life = step(born, uTime) * (1.0 - smoothstep(die - fo, die, uTime));
    vec3 a = p0;
    vec3 b = mix(p0, p1, g);
    vec3 P = mix(a, b, corner.x);
    vec4 va = modelViewMatrix * vec4(a, 1.0);
    vec4 vb = modelViewMatrix * vec4(b, 1.0);
    vec4 vp = mix(va, vb, corner.x);
    vec3 dir = vb.xyz - va.xyz;
    if (length(dir) < 1e-6) dir = vec3(1.0, 0.0, 0.0);
    vec3 side = normalize(cross(normalize(dir), normalize(-vp.xyz)));
    // keep at least uMinPx pixels wide so distant lines stay smooth
    float distPx = uPixel / max(-vp.z, 1e-3);
    float w = max(wa.x, uMinPx / distPx);
    vAlpha = wa.y * life * min(1.0, wa.x / w + 0.15) * uGain;
    vp.xyz += side * corner.y * w * 0.5;
    vColor = color;
    vSide = corner.y;
    vAlong = corner.x;
    gl_Position = projectionMatrix * vp;
  }
`;
const GLOW_FS = /* glsl */`
  varying vec3 vColor;
  varying float vSide;
  varying float vAlpha;
  uniform float uCore;
  void main() {
    float d = vSide * vSide;
    float glow = exp(-d * 3.2);
    float core = exp(-d * 28.0) * uCore;
    gl_FragColor = vec4(vColor * (glow + core) * vAlpha, 1.0);
  }
`;

export function makeSegments(segs, opts = {}) {
  const n = segs.length;
  const geo = new THREE.InstancedBufferGeometry();
  const corner = new Float32Array([0, -1, 1, -1, 1, 1, 0, 1]);
  geo.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const P0 = new Float32Array(n * 3), P1 = new Float32Array(n * 3), C = new Float32Array(n * 3);
  const A = new Float32Array(n * 4), WA = new Float32Array(n * 2);
  segs.forEach((s, i) => {
    P0.set([s.a.x, s.a.y, s.a.z], i * 3);
    P1.set([s.b.x, s.b.y, s.b.z], i * 3);
    C.set(s.color || [1, 1, 1], i * 3);
    A.set([s.born ?? -1e4, s.grow ?? 0.0001, s.die ?? 1e4, s.fade ?? 0.25], i * 4);
    WA.set([s.width ?? 0.1, s.alpha ?? 1], i * 2);
  });
  geo.setAttribute('p0', new THREE.InstancedBufferAttribute(P0, 3));
  geo.setAttribute('p1', new THREE.InstancedBufferAttribute(P1, 3));
  geo.setAttribute('color', new THREE.InstancedBufferAttribute(C, 3));
  geo.setAttribute('anim', new THREE.InstancedBufferAttribute(A, 4));
  geo.setAttribute('wa', new THREE.InstancedBufferAttribute(WA, 2));
  geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    vertexShader: SEG_VS, fragmentShader: GLOW_FS,
    uniforms: {
      uTime: { value: 0 }, uPixel: { value: 1000 }, uGain: { value: 1 },
      uMinPx: { value: opts.minPx ?? 1.6 }, uCore: { value: opts.core ?? 0.8 },
    },
    transparent: true, depthWrite: false, depthTest: opts.depthTest ?? false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,   // quads flip winding with view direction
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------- polyline ribbon
// For long continuous paths (the trajectory). Per vertex: position, prev, next,
// side, param (e.g. bar at which this point is drawn), width scale.
const RIBBON_VS = /* glsl */`
  ${COMMON}
  attribute vec3 prev;
  attribute vec3 next;
  attribute float side;
  attribute float param;
  attribute float wscale;
  attribute vec3 color;
  uniform float uWidth;
  uniform float uMinPx;
  uniform float uHead;       // only points with param <= uHead are drawn
  uniform float uTail;       // fade length behind head (in param units), <0 = no fade
  uniform float uHot;        // how many param units behind head are white-hot
  varying vec3 vColor;
  varying float vSide;
  varying float vAlpha;
  varying float vHot;
  void main() {
    vec4 vp = modelViewMatrix * vec4(position, 1.0);
    vec4 vprev = modelViewMatrix * vec4(prev, 1.0);
    vec4 vnext = modelViewMatrix * vec4(next, 1.0);
    vec3 dir = vnext.xyz - vprev.xyz;
    if (length(dir) < 1e-6) dir = vec3(1.0, 0.0, 0.0);
    vec3 sd = normalize(cross(normalize(dir), normalize(-vp.xyz)));
    float distPx = uPixel / max(-vp.z, 1e-3);
    float w0 = uWidth * wscale;
    float w = max(w0, uMinPx / distPx);
    float age = uHead - param;
    float vis = step(0.0, age);
    float tail = uTail > 0.0 ? exp(-max(age, 0.0) / uTail) : 1.0;
    vHot = exp(-max(age, 0.0) / max(uHot, 1e-4));
    vAlpha = vis * mix(0.35, 1.0, tail) * min(1.0, w0 / w + 0.2) * uGain;
    vp.xyz += sd * side * w * 0.5 * (1.0 + vHot * 0.8);
    vColor = color;
    vSide = side;
    gl_Position = projectionMatrix * vp;
  }
`;
const RIBBON_FS = /* glsl */`
  varying vec3 vColor;
  varying float vSide;
  varying float vAlpha;
  varying float vHot;
  void main() {
    float d = vSide * vSide;
    float glow = exp(-d * 3.0);
    float core = exp(-d * 30.0);
    vec3 c = mix(vColor, vec3(1.0, 0.97, 0.92) * 3.0, vHot * 0.85);
    gl_FragColor = vec4(c * (glow * 0.7 + core * (1.2 + vHot * 2.5)) * vAlpha, 1.0);
  }
`;

export function makeRibbon(points, opts = {}) {
  // points: [{p: Vector3, param: number, color: [r,g,b], w: number}]
  const n = points.length;
  const pos = new Float32Array(n * 2 * 3), prev = new Float32Array(n * 2 * 3), next = new Float32Array(n * 2 * 3);
  const side = new Float32Array(n * 2), param = new Float32Array(n * 2), ws = new Float32Array(n * 2), col = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const p = points[i].p, pp = points[Math.max(0, i - 1)].p, pn = points[Math.min(n - 1, i + 1)].p;
    for (let k = 0; k < 2; k++) {
      const j = i * 2 + k;
      pos.set([p.x, p.y, p.z], j * 3);
      prev.set([pp.x, pp.y, pp.z], j * 3);
      next.set([pn.x, pn.y, pn.z], j * 3);
      side[j] = k ? 1 : -1;
      param[j] = points[i].param;
      ws[j] = points[i].w ?? 1;
      col.set(points[i].color || [1, 1, 1], j * 3);
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
  geo.setAttribute('wscale', new THREE.BufferAttribute(ws, 1));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    vertexShader: RIBBON_VS, fragmentShader: RIBBON_FS,
    uniforms: {
      uTime: { value: 0 }, uPixel: { value: 1000 }, uGain: { value: 1 },
      uWidth: { value: opts.width ?? 0.3 }, uMinPx: { value: opts.minPx ?? 2.0 },
      uHead: { value: 1e9 }, uTail: { value: opts.tail ?? -1 }, uHot: { value: opts.hot ?? 0.0001 },
    },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------- points
// Soft sprites. Per point: position, color, size (world), born/die, and a
// "motion" vec4 interpreted by an optional custom displacement chunk.
const PTS_VS = (displace) => /* glsl */`
  ${COMMON}
  attribute vec3 color;
  attribute vec4 anim;      // born, die, fadeIn, fadeOut
  attribute vec4 motion;    // free parameters for displacement
  attribute float size;
  uniform float uMinPx;
  uniform float uMaxPx;
  uniform float uSize;
  varying vec3 vColor;
  varying float vAlpha;
  ${displace.header || ''}
  void main() {
    vec3 P = position;
    float alpha = 1.0;
    ${displace.body || ''}
    float life = smoothstep(anim.x, anim.x + max(anim.z, 1e-4), uTime) * (1.0 - smoothstep(anim.y - max(anim.w, 1e-4), anim.y, uTime));
    vec4 vp = modelViewMatrix * vec4(P, 1.0);
    float distPx = uPixel / max(-vp.z, 1e-3);
    float px = size * uSize * distPx;
    float cpx = clamp(px, uMinPx, uMaxPx);
    vAlpha = life * alpha * uGain * min(1.0, (px * px) / (cpx * cpx) + 0.05);
    vColor = color;
    gl_PointSize = cpx;
    gl_Position = projectionMatrix * vp;
    if (vAlpha <= 0.001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;
const PTS_FS = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float d = dot(q, q);
    if (d > 1.0) discard;
    float a = exp(-d * 4.0) + exp(-d * 30.0) * 1.5;
    gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
  }
`;

export function makePoints(pts, opts = {}) {
  const n = pts.length;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), anim = new Float32Array(n * 4);
  const mot = new Float32Array(n * 4), size = new Float32Array(n);
  pts.forEach((p, i) => {
    pos.set([p.p.x, p.p.y, p.p.z], i * 3);
    col.set(p.color || [1, 1, 1], i * 3);
    anim.set([p.born ?? -1e4, p.die ?? 1e4, p.fadeIn ?? 0.1, p.fadeOut ?? 0.3], i * 4);
    mot.set(p.motion || [0, 0, 0, 0], i * 4);
    size[i] = p.size ?? 0.2;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('anim', new THREE.BufferAttribute(anim, 4));
  geo.setAttribute('motion', new THREE.BufferAttribute(mot, 4));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: PTS_VS(opts.displace || {}), fragmentShader: PTS_FS,
    uniforms: {
      uTime: { value: 0 }, uPixel: { value: 1000 }, uGain: { value: 1 },
      uMinPx: { value: opts.minPx ?? 2.0 }, uMaxPx: { value: opts.maxPx ?? 64 }, uSize: { value: 1 },
      ...(opts.uniforms || {}),
    },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Points(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------- hologram surface
// Fresnel shell: bright at grazing angles, transparent face-on. Soft edges, no aliasing.
export function hologramMaterial(color, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(...color) }, uGain: { value: 1 }, uFill: { value: opts.fill ?? 0.08 },
      uPower: { value: opts.power ?? 2.2 }, uTime: { value: 0 }, uScan: { value: opts.scan ?? 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uGain; uniform float uFill; uniform float uPower; uniform float uTime; uniform float uScan;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
        float scan = uScan > 0.0 ? 0.6 + 0.4 * sin(vW.y * 6.0 - uTime * 20.0) : 1.0;
        gl_FragColor = vec4(uColor * (f * 1.4 + uFill) * uGain * scan, 1.0);
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------- text planes
const FONT_STACK = {
  title: '900 {s}px "Titillium Web"',
  bold: '700 {s}px "Titillium Web"',
  mono: '500 {s}px "JetBrains Mono"',
  monob: '800 {s}px "JetBrains Mono"',
  math: 'italic 400 {s}px "STIX Two Text"',
};

export function textTexture(lines, opts = {}) {
  const font = (FONT_STACK[opts.font || 'title']).replace('{s}', opts.px || 96);
  const pad = opts.pad ?? 16;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = font;
  const arr = Array.isArray(lines) ? lines : [lines];
  const lh = (opts.px || 96) * (opts.lineHeight || 1.15);
  let wmax = 0;
  for (const l of arr) wmax = Math.max(wmax, ctx.measureText(l).width + (opts.tracking || 0) * l.length);
  c.width = Math.ceil(wmax + pad * 2);
  c.height = Math.ceil(lh * arr.length + pad * 2);
  ctx.font = font;
  ctx.fillStyle = opts.color || '#fff';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx && opts.tracking) ctx.letterSpacing = `${opts.tracking}px`;
  arr.forEach((l, i) => {
    let x = pad;
    if (opts.align === 'center') { ctx.textAlign = 'center'; x = c.width / 2; }
    ctx.fillText(l, x, pad + lh * (i + 0.5));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex, aspect: c.width / c.height, canvas: c };
}

export function textPlane(lines, height, color = [1, 1, 1], opts = {}) {
  const { tex, aspect } = textTexture(lines, opts);
  const geo = new THREE.PlaneGeometry(height * aspect, height);
  if (opts.anchor === 'left') geo.translate(height * aspect / 2, 0, 0);
  if (opts.anchor === 'right') geo.translate(-height * aspect / 2, 0, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uColor: { value: new THREE.Color(...color) }, uGain: { value: 1 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform sampler2D map; uniform vec3 uColor; uniform float uGain; varying vec2 vUv; void main(){ float a = texture2D(map, vUv).a; gl_FragColor = vec4(uColor * a * uGain, 1.0); }',
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}

// update common uniforms on every material in a subtree
export function setUniforms(root, map) {
  root.traverse((o) => {
    const u = o.material && o.material.uniforms;
    if (!u) return;
    for (const k in map) if (u[k]) u[k].value = map[k];
  });
}
