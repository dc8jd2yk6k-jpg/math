// 1997 · Deep Blue. The board shows the real final position of Game 6
// (Kasparov resigned after 19.c4). Above it, a minimax game tree grows on
// the 16th notes, then alpha-beta pruning cuts most of it away.
import * as THREE from 'three';
import { Piece, frameMatrix } from './common.js';
import { makeSegments, makePoints, hologramMaterial, textPlane } from '../gfx/glow.js';
import { CHESS_FEN } from '../data.js';
import { rng, clamp, smoothstep, ease, hexToRgb } from '../util.js';
import { PALETTE } from '../config.js';

const SQ = 3.6;

export function boardMaterial(n, color, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uN: { value: n }, uColor: { value: new THREE.Color(...color) }, uGain: { value: 1 }, uReveal: { value: 0 },
      uChecker: { value: opts.checker ?? 0.08 }, uLine: { value: opts.line ?? 1.0 }, uTime: { value: 0 }, uPixel: { value: 1 },
      uStar: { value: opts.star ?? 0 }, uLines: { value: opts.lines ?? 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */`
      uniform float uN; uniform vec3 uColor; uniform float uGain; uniform float uReveal; uniform float uChecker; uniform float uLine;
      uniform float uStar; uniform float uLines;
      varying vec2 vUv;
      void main() {
        // uLines > 0: grid of (uN) intersections (Go), else uN cells (chess)
        vec2 g = uLines > 0.5 ? vUv * (uN - 1.0) : vUv * uN;
        vec2 f = abs(fract(g + 0.5) - 0.5);
        vec2 fw = fwidth(g);
        float line = max(1.0 - smoothstep(0.0, fw.x * 1.5, f.x), 1.0 - smoothstep(0.0, fw.y * 1.5, f.y));
        float glow = max(exp(-f.x * 18.0), exp(-f.y * 18.0)) * 0.35;
        vec2 cell = floor(g);
        float chk = uLines > 0.5 ? 0.0 : mod(cell.x + cell.y, 2.0);
        float r = length(vUv - 0.5) * 1.42;
        float mask = smoothstep(uReveal, uReveal - 0.08, r);
        float edge = exp(-abs(r - uReveal) * 40.0) * step(r, uReveal + 0.05) * 2.0;
        float star = 0.0;
        if (uStar > 0.5) {
          for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) {
            vec2 sp = vec2(3.0 + float(i) * 6.0, 3.0 + float(j) * 6.0);
            star += exp(-dot(g - sp, g - sp) * 40.0) * 2.0;
          }
        }
        float border = 0.0;
        vec2 bd = min(vUv, 1.0 - vUv);
        border = exp(-min(bd.x, bd.y) * 220.0) * 1.5;
        vec3 c = uColor * ((line * uLine + glow * uLine + chk * uChecker + star + border) * mask + edge * 0.6);
        gl_FragColor = vec4(c * uGain, 1.0);
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

function lathe(profile, s) {
  const pts = profile.map(([r, h]) => new THREE.Vector2(r * s, h * s));
  return new THREE.LatheGeometry(pts, 40);
}

function pieceGeometry(type, s) {
  switch (type) {
    case 'p': return lathe([[0, 0], [0.34, 0], [0.34, 0.07], [0.27, 0.13], [0.18, 0.2], [0.13, 0.42], [0.22, 0.46], [0.14, 0.5], [0.19, 0.6], [0.2, 0.7], [0.15, 0.79], [0.06, 0.83], [0, 0.84]], s);
    case 'r': return lathe([[0, 0], [0.37, 0], [0.37, 0.08], [0.29, 0.15], [0.23, 0.22], [0.2, 0.7], [0.27, 0.76], [0.29, 0.98], [0.21, 0.98], [0.21, 0.9], [0, 0.9]], s);
    case 'b': return lathe([[0, 0], [0.36, 0], [0.36, 0.08], [0.27, 0.14], [0.17, 0.24], [0.13, 0.62], [0.23, 0.66], [0.14, 0.7], [0.2, 0.86], [0.17, 1.0], [0.08, 1.1], [0.05, 1.16], [0.07, 1.2], [0, 1.24]], s);
    case 'q': return lathe([[0, 0], [0.4, 0], [0.4, 0.08], [0.3, 0.15], [0.19, 0.27], [0.14, 0.82], [0.27, 0.86], [0.15, 0.92], [0.27, 1.16], [0.2, 1.2], [0.08, 1.24], [0.1, 1.3], [0, 1.36]], s);
    case 'k': {
      const g = lathe([[0, 0], [0.4, 0], [0.4, 0.08], [0.3, 0.15], [0.2, 0.27], [0.15, 0.88], [0.28, 0.92], [0.16, 0.98], [0.26, 1.18], [0.12, 1.26], [0, 1.27]], s);
      const c1 = new THREE.BoxGeometry(0.07 * s, 0.3 * s, 0.07 * s); c1.translate(0, 1.4 * s, 0);
      const c2 = new THREE.BoxGeometry(0.22 * s, 0.07 * s, 0.07 * s); c2.translate(0, 1.45 * s, 0);
      return mergeGeos([g, c1, c2]);
    }
    case 'n': {
      const base = lathe([[0, 0], [0.37, 0], [0.37, 0.08], [0.27, 0.15], [0.2, 0.25], [0, 0.25]], s);
      const sh = new THREE.Shape();
      const P = [[-0.18, 0.2], [0.2, 0.2], [0.17, 0.5], [0.24, 0.8], [0.12, 1.02], [-0.04, 1.08], [-0.1, 1.02], [-0.3, 0.86], [-0.32, 0.74], [-0.22, 0.72], [-0.06, 0.78], [-0.2, 0.5]];
      sh.moveTo(P[0][0] * s, P[0][1] * s);
      P.slice(1).forEach(([x, y]) => sh.lineTo(x * s, y * s));
      const head = new THREE.ExtrudeGeometry(sh, { depth: 0.22 * s, bevelEnabled: true, bevelSize: 0.03 * s, bevelThickness: 0.03 * s, bevelSegments: 2 });
      head.translate(0, 0, -0.11 * s);
      return mergeGeos([base, head.toNonIndexed()]);
    }
  }
  return null;
}

function mergeGeos(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; parts.forEach((g) => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  parts.forEach((g) => {
    g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

export class Chess extends Piece {
  constructor(A) {
    super(1.55, 6.3, 0.4, 0.9);
    this.local = new THREE.Group();
    this.local.matrixAutoUpdate = false;
    this.local.matrix.copy(frameMatrix(2.0, A.chess));
    this.root.add(this.local);
    const ice = hexToRgb(PALETTE.ice);

    const board = new THREE.Mesh(new THREE.PlaneGeometry(8 * SQ, 8 * SQ), boardMaterial(8, ice.map((c) => c * 0.9), { checker: 0.12 }));
    board.rotation.x = -Math.PI / 2;
    board.frustumCulled = false;
    this.board = board;
    this.local.add(board);

    // pieces from the FEN (white = Deep Blue, black = Kasparov)
    this.pieces = [];
    const rows = CHESS_FEN.split('/');
    const r = rng(3);
    rows.forEach((row, ri) => {
      let file = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { file += Number(ch); continue; }
        const white = ch === ch.toUpperCase();
        const geo = pieceGeometry(ch.toLowerCase(), SQ * 0.95);
        const col = white ? [0.85, 0.93, 1.0] : [0.35, 0.45, 1.0];
        const m = new THREE.Mesh(geo, hologramMaterial(col, { fill: white ? 0.12 : 0.05, power: white ? 1.8 : 2.4 }));
        // rank 8 is row 0; board local: x = file (along T), z = rank (along Z)
        const x = (file - 3.5) * SQ, z = (ri - 3.5) * SQ;
        m.position.set(x, 0, z);
        if (!white && ch.toLowerCase() === 'n') m.rotation.y = Math.PI;
        m.frustumCulled = false;
        m.userData = { delay: 2.02 + r() * 0.45, white, kind: ch.toLowerCase(), x, z };
        if (ch === 'k') this.blackKing = m;
        this.local.add(m);
        this.pieces.push(m);
        file++;
      }
    });

    // minimax tree with alpha-beta pruning
    const segs = [], pruned = [], pv = [], leaves = [];
    const branching = [5, 4, 4, 3, 3, 2];
    const rootPos = new THREE.Vector3(0, 1.0, 0);
    const levelH = 3.4;
    let pvNode = true;
    const grow = (p, level, ang, spread, isPV, isPruned) => {
      if (level >= branching.length) {
        leaves.push({ p, born: 2.5 + level * 0.25, pruned: isPruned, pv: isPV });
        return;
      }
      const c = branching[level];
      const pvChild = Math.floor(r() * c);
      for (let i = 0; i < c; i++) {
        const a = ang + (i - (c - 1) / 2) * (spread / c) * 2.2 + (r() - 0.5) * 0.3;
        const rad = 5.5 / (level + 1.2) + 1.2;
        const q = new THREE.Vector3(p.x + Math.cos(a) * rad, p.y + levelH * (1 - level * 0.06), p.z + Math.sin(a) * rad);
        const born = 2.5 + level * 0.25 + r() * 0.06;
        const childPV = isPV && i === pvChild;
        const childPruned = isPruned || (!childPV && level >= 1 && r() < 0.62);
        const seg = { a: p, b: q, born, grow: 0.2, width: 0.11 + 0.05 * (6 - level) / 6, alpha: 0.9 };
        if (childPV) pv.push({ ...seg, color: [1.6, 1.6, 1.7], born: 4.0 + level * 0.08, grow: 0.1, width: seg.width * 1.6, die: 6.4, fade: 0.6 });
        if (childPruned) pruned.push({ ...seg, color: [0.4, 0.75, 1.2], die: 4.5 + r() * 0.3, fade: 0.25 });
        else segs.push({ ...seg, color: [0.4, 0.75, 1.2], die: 6.4, fade: 0.6 });
        grow(q, level + 1, a, spread * 0.8, childPV, childPruned);
      }
    };
    grow(rootPos, 0, 0, Math.PI, true, false);
    this.tree = makeSegments(segs, { minPx: 1.2, core: 0.7 });
    this.pruned = makeSegments(pruned, { minPx: 1.2, core: 0.7 });
    this.pv = makeSegments(pv, { minPx: 2, core: 1.4 });
    this.leaves = makePoints(leaves.map((l) => ({ p: l.p, color: l.pv ? [2, 2, 2.2] : [0.6, 0.85, 1.4], size: 0.5, born: l.born, die: l.pruned ? 4.6 : 6.4, fadeIn: 0.05, fadeOut: 0.3, motion: [r() * 6, 0, 0, 0] })), {
      minPx: 2, maxPx: 10, displace: { body: 'alpha = 0.6 + 0.4 * sin(uTime * 40.0 + motion.x);' },
    });
    [this.tree, this.pruned, this.pv, this.leaves].forEach((o) => this.local.add(o));
    this.treeTop = new THREE.Vector3(0, levelH * 5.3, 0).applyMatrix4(this.local.matrix);
    this.kingWorld = this.blackKing.position.clone().applyMatrix4(this.local.matrix);
  }

  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    const g = this.g;
    this.board.material.uniforms.uReveal.value = ease.outCubic(clamp((b - 1.75) / 0.5)) * 1.1;
    this.board.material.uniforms.uGain.value = g * (1 + 0.25 * ctx.beat);
    for (const m of this.pieces) {
      const k = ease.outBack(clamp((b - m.userData.delay) / 0.12));
      m.scale.setScalar(Math.max(0.001, k));
      m.position.y = (1 - clamp((b - m.userData.delay) / 0.12)) * 4;
      m.material.uniforms.uGain.value = g * clamp((b - m.userData.delay) / 0.05) * (m.userData.white ? 1.0 : 1.2);
    }
    // the black king flashes: resignation
    if (this.blackKing) {
      const res = smoothstep(4.0, 4.2, b);
      this.blackKing.material.uniforms.uColor.value.setRGB(0.35 + 1.4 * res, 0.45 - 0.2 * res, 1.0 - 0.7 * res);
    }
    for (const o of [this.tree, this.pruned, this.leaves]) o.material.uniforms.uGain.value = g * 0.5;
    this.pv.material.uniforms.uGain.value = g;
  }
}
