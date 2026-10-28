// HDR pipeline: scene -> (motion-blur accumulation) -> bloom mip chain ->
// composite (exposure, chromatic aberration, ACES, grain, vignette, HUD) ->
// screen, or a GPU-packed YUV420 buffer for the encoder.
import * as THREE from 'three';

const VS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function pass(fs, uniforms, extra = {}) {
  return new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, ...extra });
}

const DOWN = /* glsl */`
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uKaris; varying vec2 vUv;
  vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
  float lw(vec3 c) { return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
  void main() {
    vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
    vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
    vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
    vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
    vec3 o;
    if (uKaris > 0.5) {
      vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
      float w0 = lw(g0), w1 = lw(g1), w2 = lw(g2), w3 = lw(g3), w4 = lw(g4);
      o = (g0 * w0 * 0.125 + g1 * w1 * 0.125 + g2 * w2 * 0.125 + g3 * w3 * 0.125 + g4 * w4 * 0.5) / (w0 * 0.125 + w1 * 0.125 + w2 * 0.125 + w3 * 0.125 + w4 * 0.5);
    } else {
      o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
    }
    gl_FragColor = vec4(max(o, 0.0), 1.0);
  }`;

// full -> quarter resolution: four bilinear taps cover a 4x4 block; Karis
// weighting keeps single hot pixels (the head) from flickering
const DOWN4 = /* glsl */`
  uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
  float lw(vec3 c) { return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
  void main() {
    vec3 a = texture2D(tSrc, vUv + vec2(-1.0, -1.0) * uTexel).rgb;
    vec3 b = texture2D(tSrc, vUv + vec2(1.0, -1.0) * uTexel).rgb;
    vec3 c = texture2D(tSrc, vUv + vec2(-1.0, 1.0) * uTexel).rgb;
    vec3 d = texture2D(tSrc, vUv + vec2(1.0, 1.0) * uTexel).rgb;
    a = min(a, vec3(24.0)); b = min(b, vec3(24.0)); c = min(c, vec3(24.0)); d = min(d, vec3(24.0));
    float wa = lw(a), wb = lw(b), wc = lw(c), wd = lw(d);
    gl_FragColor = vec4((a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd), 1.0);
  }`;

const UP = /* glsl */`
  uniform sampler2D tSrc; uniform sampler2D tBase; uniform vec2 uTexel; uniform float uRadius; varying vec2 vUv;
  vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel * uRadius).rgb; }
  void main() {
    vec3 o = s(vec2(0, 0)) * 4.0 + (s(vec2(-1, 0)) + s(vec2(1, 0)) + s(vec2(0, -1)) + s(vec2(0, 1))) * 2.0
           + s(vec2(-1, -1)) + s(vec2(1, -1)) + s(vec2(-1, 1)) + s(vec2(1, 1));
    gl_FragColor = vec4(o / 16.0 + texture2D(tBase, vUv).rgb, 1.0);
  }`;

const COMPOSITE = /* glsl */`
  uniform sampler2D tHDR; uniform sampler2D tBloom; uniform sampler2D tHUD;
  uniform vec2 uRes; uniform float uExposure; uniform float uBloom; uniform float uCA; uniform float uHudCA;
  uniform float uGrain; uniform float uVignette; uniform float uFlash; uniform vec3 uFlashColor;
  uniform float uFade; uniform float uSat; uniform float uFrame; uniform float uHud; uniform float uLift;
  varying vec2 vUv;
  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
  vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  void main() {
    vec2 d = vUv - 0.5;
    vec2 off = d * uCA * (0.4 + 2.0 * dot(d, d));
    vec3 c = vec3(texture2D(tHDR, vUv - off).r, texture2D(tHDR, vUv).g, texture2D(tHDR, vUv + off).b);
    c = min(c, vec3(48.0));
    c += texture2D(tBloom, vUv).rgb * uBloom;
    c *= uExposure;
    c += uFlashColor * uFlash;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, uSat);
    c = aces(c) + uLift;
    float vig = smoothstep(0.95, 0.25, length(d * vec2(1.0, 0.82)));
    c *= mix(1.0, vig, uVignette);
    c = srgb(clamp(c, 0.0, 1.0));
    // overlay with a slight colour split
    vec2 hoff = vec2(uHudCA / uRes.x, 0.0);
    vec2 hv = vec2(vUv.x, 1.0 - vUv.y);
    vec4 h = texture2D(tHUD, hv);
    float hr = texture2D(tHUD, hv - hoff).a;
    float hb = texture2D(tHUD, hv + hoff).a;
    vec3 hc = h.rgb;
    vec3 ha = vec3(max(h.a, hr * 0.85), h.a, max(h.a, hb * 0.85)) * uHud;
    c = c * (1.0 - ha) + hc * ha;
    c += (hash(gl_FragCoord.xy + uFrame * 17.31) - 0.5) * uGrain;
    gl_FragColor = vec4(c * uFade, 1.0);
  }`;

// planar YUV420 (BT.709 limited) packed 4 bytes per RGBA texel, stream order = readPixels order
const YUV = /* glsl */`
  uniform sampler2D tSrc; uniform vec2 uRes; varying vec2 vUv;
  vec3 px(float x, float y) { return texture2D(tSrc, vec2((x + 0.5) / uRes.x, 1.0 - (y + 0.5) / uRes.y)).rgb; }
  float Y(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  float chroma(float k, int which) {
    float cw = uRes.x * 0.5;
    float cy = floor(k / cw), cx = k - cy * cw;
    vec3 c = (px(2.0 * cx, 2.0 * cy) + px(2.0 * cx + 1.0, 2.0 * cy) + px(2.0 * cx, 2.0 * cy + 1.0) + px(2.0 * cx + 1.0, 2.0 * cy + 1.0)) * 0.25;
    float y = Y(c);
    float v = which == 0 ? (c.b - y) / 1.8556 : (c.r - y) / 1.5748;
    return (128.0 + 224.0 * v) / 255.0;
  }
  void main() {
    float col = floor(gl_FragCoord.x), row = floor(gl_FragCoord.y);
    vec4 o;
    if (row < uRes.y) {
      for (int i = 0; i < 4; i++) { float yv = (16.0 + 219.0 * Y(px(col * 4.0 + float(i), row))) / 255.0; if (i == 0) o.r = yv; else if (i == 1) o.g = yv; else if (i == 2) o.b = yv; else o.a = yv; }
    } else {
      float q = uRes.y * 0.25;
      int which = row < uRes.y + q ? 0 : 1;
      float base = (row - uRes.y - (which == 0 ? 0.0 : q)) * uRes.x + col * 4.0;
      o = vec4(chroma(base, which), chroma(base + 1.0, which), chroma(base + 2.0, which), chroma(base + 3.0, which));
    }
    gl_FragColor = o;
  }`;

export class Post {
  constructor(renderer, w, h, { msaa = 4 } = {}) {
    this.r = renderer;
    this.w = w; this.h = h;
    const hf = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.sceneAA = msaa > 0 ? new THREE.WebGLRenderTarget(w, h, { ...hf, depthBuffer: true, samples: msaa }) : null;
    this.scene = new THREE.WebGLRenderTarget(w, h, { ...hf, depthBuffer: true });
    this.accum = new THREE.WebGLRenderTarget(w, h, hf);
    this.mips = [];
    this.ups = [];
    let mw = w >> 2, mh = h >> 2;
    for (let i = 0; i < 5; i++) {
      this.mips.push(new THREE.WebGLRenderTarget(Math.max(1, mw), Math.max(1, mh), hf));
      this.ups.push(new THREE.WebGLRenderTarget(Math.max(1, mw), Math.max(1, mh), hf));
      mw >>= 1; mh >>= 1;
    }
    this.ldr = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
    this.yuv = new THREE.WebGLRenderTarget(w / 4, h * 1.5, { type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
    this.yuvBuf = new Uint8Array(w * h * 1.5);

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qscene = new THREE.Scene();
    this.qscene.add(this.quad);
    this.qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.mCopy = pass(/* glsl */`uniform sampler2D tSrc; uniform float uW; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uW, 1.0); }`,
      { tSrc: { value: null }, uW: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true });
    this.mDown4 = pass(DOWN4, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mDown = pass(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uKaris: { value: 0 } });
    this.mUp = pass(UP, { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 } });
    this.mComp = pass(COMPOSITE, {
      tHDR: { value: null }, tBloom: { value: null }, tHUD: { value: null }, uRes: { value: new THREE.Vector2(w, h) },
      uExposure: { value: 1 }, uBloom: { value: 0.06 }, uCA: { value: 0.002 }, uHudCA: { value: 1.2 }, uGrain: { value: 0.025 },
      uVignette: { value: 0.35 }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) }, uFade: { value: 1 },
      uSat: { value: 1 }, uFrame: { value: 0 }, uHud: { value: 1 }, uLift: { value: 0 },
    });
    this.mYUV = pass(YUV, { tSrc: { value: null }, uRes: { value: new THREE.Vector2(w, h) } });
    this.mBlit = pass(/* glsl */`uniform sampler2D tSrc; varying vec2 vUv; void main() { gl_FragColor = texture2D(tSrc, vUv); }`, { tSrc: { value: null } });
  }

  run(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.qscene, this.qcam);
  }

  // render the scene n times (sub-frame times set by setSub(i/n)) and average
  renderHDR(scene, camera, n, setSub, aa = false) {
    const r = this.r;
    if (n <= 1) {
      const rt = aa && this.sceneAA ? this.sceneAA : this.scene;
      setSub(0.5, 1);
      r.setRenderTarget(rt);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, true);
      r.render(scene, camera);
      return rt.texture;
    }
    r.setRenderTarget(this.accum);
    r.setClearColor(0x000000, 1);
    r.clear(true, false, false);
    for (let i = 0; i < n; i++) {
      setSub((i + 0.5) / n, 1 / n);        // (centre, width) of this sub-interval, as fractions of the shutter
      r.setRenderTarget(this.scene);
      r.clear(true, true, true);
      r.render(scene, camera);
      this.mCopy.uniforms.tSrc.value = this.scene.texture;
      this.mCopy.uniforms.uW.value = 1 / n;
      this.run(this.mCopy, this.accum);
    }
    return this.accum.texture;
  }

  bloom(src) {
    let prev = src, pw = this.w, ph = this.h;
    for (let i = 0; i < this.mips.length; i++) {
      const m = i === 0 ? this.mDown4 : this.mDown;
      m.uniforms.tSrc.value = prev;
      m.uniforms.uTexel.value.set(1 / pw, 1 / ph);
      if (i > 0) m.uniforms.uKaris.value = 0;
      this.run(m, this.mips[i]);
      prev = this.mips[i].texture;
      pw = this.mips[i].width; ph = this.mips[i].height;
    }
    let up = this.mips[this.mips.length - 1].texture;
    for (let i = this.mips.length - 2; i >= 0; i--) {
      const src = this.mips[i + 1];
      this.mUp.uniforms.tSrc.value = up;
      this.mUp.uniforms.tBase.value = this.mips[i].texture;
      this.mUp.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.run(this.mUp, this.ups[i]);
      up = this.ups[i].texture;
    }
    return up;
  }

  composite(hdr, bloom, hudTex, fx, target) {
    const u = this.mComp.uniforms;
    u.tHDR.value = hdr; u.tBloom.value = bloom; u.tHUD.value = hudTex;
    for (const [k, v] of Object.entries(fx)) {
      if (!u[k]) continue;
      if (u[k].value && u[k].value.isColor) u[k].value.setRGB(...v);
      else u[k].value = v;
    }
    this.run(this.mComp, target);
  }

  toScreen() {
    this.mBlit.uniforms.tSrc.value = this.ldr.texture;
    this.run(this.mBlit, null);
  }

  readYUV() {
    this.mYUV.uniforms.tSrc.value = this.ldr.texture;
    this.run(this.mYUV, this.yuv);
    this.r.readRenderTargetPixels(this.yuv, 0, 0, this.w / 4, this.h * 1.5, this.yuvBuf);
    return this.yuvBuf;
  }
}
