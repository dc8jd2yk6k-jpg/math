// HDR post pipeline: scene (half float) -> optional sub-frame accumulation
// (true motion blur) -> dual-filter bloom -> composite (tonemap, chromatic
// aberration, glitch, grain, vignette, flash, HUD) -> dithered output or a
// GPU-packed YUV420 frame for lossless capture.
import * as THREE from 'three';

const FS_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

class FullScreen {
  constructor(fs, uniforms = {}, opts = {}) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: FS_VS, fragmentShader: fs, uniforms,
      depthTest: false, depthWrite: false, blending: opts.blending ?? THREE.NoBlending, transparent: !!opts.blending,
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.cam = new THREE.Camera();
  }
  get u() { return this.mat.uniforms; }
  render(renderer, target) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.cam);
  }
}

const rtOpts = (type = THREE.HalfFloatType) => ({
  type, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
});

const DOWN_FS = /* glsl */`
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uPrefilter; uniform float uThreshold; uniform float uKnee;
  varying vec2 vUv;
  vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
  void main() {
    if (uPrefilter > 0.5) {
      // first level: 4 bilinear taps = box over 4x4 source texels, then soft threshold
      vec3 col = (s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0)) + s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0))) * 0.25;
      float br = max(col.r, max(col.g, col.b));
      float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
      soft = soft * soft / (4.0 * uKnee + 1e-4);
      col *= max(soft, br - uThreshold) / max(br, 1e-4);
      gl_FragColor = vec4(min(col, vec3(60.0)), 1.0);
      return;
    }
    // 13-tap downsample (Jimenez 2014)
    vec3 a = s(vec2(-2.0, 2.0)), b = s(vec2(0.0, 2.0)), c = s(vec2(2.0, 2.0));
    vec3 d = s(vec2(-2.0, 0.0)), e = s(vec2(0.0, 0.0)), f = s(vec2(2.0, 0.0));
    vec3 g = s(vec2(-2.0, -2.0)), h = s(vec2(0.0, -2.0)), i = s(vec2(2.0, -2.0));
    vec3 j = s(vec2(-1.0, 1.0)), k = s(vec2(1.0, 1.0)), l = s(vec2(-1.0, -1.0)), m = s(vec2(1.0, -1.0));
    vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
    gl_FragColor = vec4(col, 1.0);
  }`;

const UP_FS = /* glsl */`
  uniform sampler2D tSmall; uniform sampler2D tBase; uniform vec2 uTexel; uniform float uScatter;
  varying vec2 vUv;
  vec3 s(vec2 o) { return texture2D(tSmall, vUv + o * uTexel).rgb; }
  void main() {
    vec3 t = s(vec2(-0.5, -0.5)) + s(vec2(0.5, -0.5)) + s(vec2(-0.5, 0.5)) + s(vec2(0.5, 0.5));
    gl_FragColor = vec4(texture2D(tBase, vUv).rgb + t * 0.25 * uScatter, 1.0);
  }`;

const ACCUM_FS = /* glsl */`
  uniform sampler2D tSrc; uniform float uWeight; varying vec2 vUv;
  void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uWeight, 1.0); }`;

const COMPOSITE_FS = /* glsl */`
  uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tHud;
  uniform vec2 uRes; uniform float uFrame;
  uniform float uExposure; uniform float uBloom; uniform float uCA; uniform float uGlitch; uniform float uGlitchSeed;
  uniform float uGrain; uniform float uVignette; uniform float uFlash; uniform vec3 uFlashColor;
  uniform float uHudAlpha; uniform float uHudGlitch; uniform float uFade; uniform float uScan; uniform float uSat;
  uniform float uLetterbox;
  varying vec2 vUv;

  float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }

  vec3 aces(vec3 x) {   // Narkowicz ACES fit with a gentle shoulder
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }
  vec2 glitchUV(vec2 uv, float amt, float seed) {
    if (amt <= 0.0) return uv;
    float rows = 24.0 + 40.0 * h11(seed);
    float row = floor(uv.y * rows);
    float r = h11(row * 1.37 + seed * 7.1);
    float on = step(1.0 - 0.35 * amt, r);
    uv.x += on * (h11(row + seed) - 0.5) * 0.12 * amt;
    float blk = step(0.93, h12(floor(uv * vec2(12.0, 7.0)) + seed));
    uv += blk * amt * (vec2(h11(seed + row), h11(seed - row)) - 0.5) * 0.04;
    return uv;
  }
  void main() {
    vec2 uv = vUv;
    vec2 guv = glitchUV(uv, uGlitch, uGlitchSeed);
    vec2 cc = guv - 0.5;
    float r2 = dot(cc, cc);
    vec2 caOff = cc * (uCA * (0.004 + 0.02 * r2)) + vec2(uGlitch * 0.006, 0.0);
    vec3 col, bl;
    if (uCA > 0.02 || uGlitch > 0.0) {
      col.r = texture2D(tScene, guv + caOff).r;
      col.g = texture2D(tScene, guv).g;
      col.b = texture2D(tScene, guv - caOff).b;
      bl.r = texture2D(tBloom, guv + caOff * 2.0).r;
      bl.g = texture2D(tBloom, guv).g;
      bl.b = texture2D(tBloom, guv - caOff * 2.0).b;
    } else {
      col = texture2D(tScene, guv).rgb;
      bl = texture2D(tBloom, guv).rgb;
    }
    col += bl * uBloom;
    col *= uExposure * (1.0 + uFlash * 2.6);     // flashes are exposure spikes: highlights bloom, blacks stay black
    col = aces(col);
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, uSat);
    // a faint veil on top of the exposure spike
    col = mix(col, uFlashColor, clamp(uFlash * 0.025, 0.0, 1.0));
    // vignette
    float vig = smoothstep(0.95, 0.25, length(cc * vec2(1.0, 0.82)));
    col *= mix(1.0, vig, uVignette);
    // scanlines (subtle, only during glitch)
    col *= 1.0 - uScan * 0.12 * (0.5 + 0.5 * sin(uv.y * uRes.y * 3.14159));
    // HUD (premultiplied alpha), with its own glitch + chromatic split
    vec4 hud;
    if (uHudGlitch > 0.01) {
      vec2 huv = glitchUV(uv, uHudGlitch, uGlitchSeed + 3.0);
      float hs = uHudGlitch * 0.004 + 0.0006;
      vec4 hg = texture2D(tHud, huv);
      vec4 hr = texture2D(tHud, huv + vec2(hs, 0.0));
      vec4 hb = texture2D(tHud, huv - vec2(hs, 0.0));
      hud = vec4(hr.r, hg.g, hb.b, max(hg.a, max(hr.a, hb.a))) * uHudAlpha;
    } else hud = texture2D(tHud, uv) * uHudAlpha;
    if (hud.a > 1e-4) hud.rgb = pow(clamp(hud.rgb / hud.a, 0.0, 1.0), vec3(2.2)) * hud.a;   // sRGB canvas -> linear
    col = col * (1.0 - hud.a) + hud.rgb;
    // fade to black
    col *= uFade;
    // letterbox bars
    if (uLetterbox > 0.0 && (uv.y < uLetterbox || uv.y > 1.0 - uLetterbox)) col = vec3(0.0);
    // grain (luma-weighted so blacks stay clean-ish)
    float n = h12(uv * uRes + uFrame * 17.31) - 0.5;
    col += n * uGrain * (0.25 + 0.75 * (1.0 - abs(l - 0.5) * 2.0));
    // encode to sRGB and dither into the 8-bit target
    col = clamp(col, 0.0, 1.0);
    col = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, col));
    float d = (h12(gl_FragCoord.xy + uFrame * 3.7) + h12(gl_FragCoord.xy * 1.7 - uFrame) - 1.0) / 255.0;
    gl_FragColor = vec4(col + d, 1.0);
  }`;

const OUT_FS = /* glsl */`
  uniform sampler2D tSrc; uniform vec2 uRes; uniform float uFrame; varying vec2 vUv;
  float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec3 srgb(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }`;

// Packs the frame into planar YUV420 (BT.709, limited range) inside an RGBA8
// target of size (W/4) x (1.5 H): rows [0,H) = Y, then U (H/4 rows), then V.
const YUV_FS = /* glsl */`
  uniform sampler2D tSrc; uniform vec2 uRes; uniform float uFrame;
  varying vec2 vUv;
  float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec3 srgb(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  vec3 px(vec2 p) { return texture2D(tSrc, (p + 0.5) / uRes).rgb; }   // p in texture pixels (sRGB-encoded source)
  float Y(vec3 c) { return 16.0 + 219.0 * dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  float U(vec3 c) { return 128.0 + 224.0 * dot(c, vec3(-0.114572, -0.385428, 0.5)); }
  float V(vec3 c) { return 128.0 + 224.0 * dot(c, vec3(0.5, -0.454153, -0.045847)); }
  float dith(vec2 p, float s) { return h12(p + uFrame * 1.618 + s) + h12(p * 1.31 - uFrame + s) - 1.0; }
  vec3 avg2(vec2 c) {   // 2x2 block average in one bilinear fetch at the shared corner
    return texture2D(tSrc, (c * 2.0 + 1.0) / uRes).rgb;
  }
  void main() {
    float W = uRes.x, H = uRes.y;
    float tx = floor(gl_FragCoord.x), ty = floor(gl_FragCoord.y);   // texel coords in the pack target
    vec4 o;
    if (ty < H) {
      float iy = ty;                       // image row (top = 0); readPixels returns row 0 first
      for (int k = 0; k < 4; k++) {
        vec2 p = vec2(tx * 4.0 + float(k), iy);
        float v = Y(px(vec2(p.x, H - 1.0 - iy))) + dith(p, 0.0) * 0.5;
        o[k] = clamp(floor(v + 0.5), 0.0, 255.0) / 255.0;
      }
    } else {
      float cw = W * 0.5;
      float rowsPer = (H * 0.25);
      bool isV = ty >= H + rowsPer;
      float r = ty - H - (isV ? rowsPer : 0.0);
      float lin = (r * (W * 0.25) + tx) * 4.0;   // linear byte index in the chroma plane
      for (int k = 0; k < 4; k++) {
        float idx = lin + float(k);
        float cy = floor((idx + 0.5) / cw), cx = idx - cy * cw;
        vec3 c = avg2(vec2(cx, H * 0.5 - 1.0 - cy));
        float v = (isV ? V(c) : U(c)) + dith(vec2(cx, cy), isV ? 7.0 : 3.0) * 0.5;
        o[k] = clamp(floor(v + 0.5), 0.0, 255.0) / 255.0;
      }
    }
    gl_FragColor = o;
  }`;

export class Post {
  constructor(renderer, w, h) {
    this.r = renderer; this.w = w; this.h = h;
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, { ...rtOpts(), depthBuffer: true });
    this.accumRT = new THREE.WebGLRenderTarget(w, h, rtOpts());
    this.finalRT = new THREE.WebGLRenderTarget(w, h, rtOpts(THREE.UnsignedByteType));   // sRGB-encoded, dithered
    this.yuvRT = new THREE.WebGLRenderTarget(w / 4, h * 1.5, { ...rtOpts(THREE.UnsignedByteType), minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.levels = [];
    let lw = w, lh = h;
    for (let i = 0; i < 6; i++) {
      lw = Math.max(2, Math.round(lw / 2)); lh = Math.max(2, Math.round(lh / 2));
      this.levels.push({ down: new THREE.WebGLRenderTarget(lw, lh, rtOpts()), up: new THREE.WebGLRenderTarget(lw, lh, rtOpts()), w: lw, h: lh });
    }
    this.down = new FullScreen(DOWN_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uPrefilter: { value: 0 }, uThreshold: { value: 0.9 }, uKnee: { value: 0.6 } });
    this.up = new FullScreen(UP_FS, { tSmall: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uScatter: { value: 0.85 } });
    this.accum = new FullScreen(ACCUM_FS, { tSrc: { value: null }, uWeight: { value: 1 } }, { blending: THREE.AdditiveBlending });
    this.comp = new FullScreen(COMPOSITE_FS, {
      tScene: { value: null }, tBloom: { value: null }, tHud: { value: null },
      uRes: { value: new THREE.Vector2(w, h) }, uFrame: { value: 0 },
      uExposure: { value: 1 }, uBloom: { value: 0.9 }, uCA: { value: 0.3 }, uGlitch: { value: 0 }, uGlitchSeed: { value: 0 },
      uGrain: { value: 0.035 }, uVignette: { value: 0.55 }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) },
      uHudAlpha: { value: 1 }, uHudGlitch: { value: 0 }, uFade: { value: 1 }, uScan: { value: 0 }, uSat: { value: 1 }, uLetterbox: { value: 0 },
    });
    this.out = new FullScreen(OUT_FS, { tSrc: { value: null }, uRes: { value: new THREE.Vector2(w, h) }, uFrame: { value: 0 } });
    this.yuv = new FullScreen(YUV_FS, { tSrc: { value: null }, uRes: { value: new THREE.Vector2(w, h) }, uFrame: { value: 0 } });
    this.yuvBuf = new Uint8Array(w * h * 1.5);
    this.bgColor = new THREE.Color(0, 0, 0);
  }

  // renderScene(sub) renders the 3D scene for sub-sample `sub` of `n` (motion blur)
  renderHDR(scene, camera, n, prepare) {
    const r = this.r;
    r.setClearColor(this.bgColor, 1);
    if (n <= 1) {
      prepare(0);
      r.setRenderTarget(this.sceneRT); r.clear(true, true, false);
      r.render(scene, camera);
      return this.sceneRT.texture;
    }
    r.setRenderTarget(this.accumRT); r.setClearColor(0x000000, 1); r.clear(true, false, false);
    this.accum.u.uWeight.value = 1 / n;
    for (let i = 0; i < n; i++) {
      prepare((i + 0.5) / n - 0.5);
      r.setClearColor(this.bgColor, 1);
      r.setRenderTarget(this.sceneRT); r.clear(true, true, false);
      r.render(scene, camera);
      this.accum.u.tSrc.value = this.sceneRT.texture;
      this.accum.render(r, this.accumRT);
    }
    return this.accumRT.texture;
  }

  bloom(src, threshold = 0.85, knee = 0.6) {
    const r = this.r;
    let input = src, iw = this.w, ih = this.h;
    this.levels.forEach((L, i) => {
      this.down.u.tSrc.value = input;
      this.down.u.uTexel.value.set(1 / iw, 1 / ih);
      this.down.u.uPrefilter.value = i === 0 ? 1 : 0;
      this.down.u.uThreshold.value = threshold; this.down.u.uKnee.value = knee;
      this.down.render(r, L.down);
      input = L.down.texture; iw = L.w; ih = L.h;
    });
    let small = this.levels[this.levels.length - 1].down;
    for (let i = this.levels.length - 2; i >= 0; i--) {
      const L = this.levels[i];
      this.up.u.tSmall.value = small.texture;
      this.up.u.tBase.value = L.down.texture;
      this.up.u.uTexel.value.set(1 / small.width, 1 / small.height);
      this.up.render(r, L.up);
      small = L.up;
    }
    return this.levels[0].up.texture;
  }

  composite(hdr, bloomTex, hudTex, params) {
    const u = this.comp.u;
    u.tScene.value = hdr; u.tBloom.value = bloomTex; u.tHud.value = hudTex;
    for (const k in params) if (u[k] !== undefined) {
      if (u[k].value && u[k].value.isColor) u[k].value.setRGB(...params[k]);
      else u[k].value = params[k];
    }
    this.comp.render(this.r, this.finalRT);
  }

  toScreen(frame) {
    this.out.u.tSrc.value = this.finalRT.texture; this.out.u.uFrame.value = frame;
    this.out.render(this.r, null);
  }

  readYUV(frame) {
    this.yuv.u.tSrc.value = this.finalRT.texture; this.yuv.u.uFrame.value = frame;
    this.yuv.render(this.r, this.yuvRT);
    this.r.readRenderTargetPixels(this.yuvRT, 0, 0, this.w / 4, this.h * 1.5, this.yuvBuf);
    return this.yuvBuf;
  }
}
