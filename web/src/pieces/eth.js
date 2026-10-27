// The climax: the Exponential Time Hypothesis. A 2^n search tree for 3-SAT
// explodes upward level by level on the eighth notes. Two heads, one per lab,
// find short paths through it and reach the top a beat apart (the papers
// came out hours apart), then the whole tree folds back into the line.
import * as THREE from 'three';
import { Piece } from './piece.js';
import { Lines } from '../gfx/lines.js';
import { Head } from '../world/head.js';
import { L } from '../layout.js';
import { S_OF, S_END } from '../curve.js';
import { WINDOWS } from '../story.js';
import { clamp, ease, smoothstep, wrap, mulberry32 } from '../time.js';

const D = 7;
const T0 = 34.0;                 // first level
const LEVEL = 1 / 8;             // one level per eighth note
const LAB = { oai: { end: 36.0, color: new THREE.Color(0.75, 0.85, 1.0) }, ant: { end: 36.25, color: new THREE.Color(1.0, 0.55, 0.3) } };

export class ETH extends Piece {
  constructor(film) {
    super('eth', { appearS: S_OF.yangmills + 4, window: WINDOWS.eth });
    const root = L.eth.root, top = L.eth.top;
    this.root3 = root; this.top3 = top;
    this.center = root.clone().lerp(top, 0.5);
    const H = top.y - root.y;
    const rnd = mulberry32(316);
    // nodes: level k has 2^k nodes; children alternate splitting in x and z
    const nodes = [[{ p: root.clone(), k: 0 }]];
    for (let k = 1; k <= D; k++) {
      // a canopy: levels get closer together and keep spreading, like a real tree
      const spread = 42 * Math.pow(0.8, k - 1);
      const y = root.y + H * 0.92 * (1 - Math.pow(0.78, k)) / (1 - Math.pow(0.78, D));
      const lvl = [];
      for (const n of nodes[k - 1]) for (const s of [-1, 1]) {
        const off = k % 2 ? new THREE.Vector3(s * spread, 0, (rnd() - 0.5) * spread * 0.5) : new THREE.Vector3((rnd() - 0.5) * spread * 0.5, 0, s * spread);
        const p = n.p.clone().add(off); p.y = y + (rnd() - 0.5) * H * 0.02;
        lvl.push({ p, k, parent: n });
      }
      nodes.push(lvl);
    }
    this.nodes = nodes;
    const segs = [];
    for (let k = 1; k <= D; k++) for (const n of nodes[k]) {
      segs.push({ a: n.parent.p, b: n.p, k0: k - 1, k1: k, color: [1, 1, 1], alpha: 0.5 * Math.pow(0.86, k) + 0.12, width: 1.0 + 0.5 * Math.pow(0.8, k) });
    }
    this.segs = segs;
    this.tree = new Lines(segs.map((s) => ({ ...s })), { blending: THREE.AdditiveBlending });
    this.root.add(this.tree.mesh);
    const leaves = nodes.flat().map((n) => n.p);
    this.leafPts = new THREE.Points(new THREE.BufferGeometry().setFromPoints(leaves),
      new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, color: new THREE.Color(1.4, 1.4, 1.5), transparent: true, depthWrite: false }));
    this.root.add(this.leafPts);
    // two short paths, one per lab: a few branch choices, then straight to the top
    const pathOf = (bits) => {
      let n = nodes[0][0]; const pts = [n.p];
      for (let k = 1; k <= 4; k++) { const kids = nodes[k].filter((c) => c.parent === n); n = kids[bits[k - 1]]; pts.push(n.p); }
      pts.push(n.p.clone().lerp(top, 0.55).setX(top.x + (n.p.x - top.x) * 0.25).setZ(top.z + (n.p.z - top.z) * 0.25));
      pts.push(top.clone());
      return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    };
    this.paths = { oai: pathOf([0, 1, 1, 0]), ant: pathOf([1, 0, 0, 1]) };
    this.glow = {};
    this.heads = {};
    for (const id of ['oai', 'ant']) {
      const c = this.paths[id], n = 160, s = [];
      for (let i = 0; i < n; i++) s.push({ a: c.getPointAt(i / n), b: c.getPointAt((i + 1) / n), k0: i / n, k1: (i + 1) / n, color: LAB[id].color.toArray(), alpha: 0.95, width: 2.6 });
      this.glow[id] = new Lines(s, { blending: THREE.AdditiveBlending });
      this.root.add(this.glow[id].mesh);
      const h = new Head();
      h.material.uniforms.uColor.value.copy(LAB[id].color);
      this.heads[id] = h;
      this.root.add(h.mesh);
    }
    // the main head steps aside while the two lab heads race
    if (film) film.headGain = (b) => { b = wrap(b); return 1 - smoothstep(34.4, 34.55, b) * (1 - smoothstep(36.2, 36.3, b)); };
    this.lastFold = -1;
  }

  progress(b, id) {
    return ease.inQuad(clamp((b - 34.45) / (LAB[id].end - 34.45)));
  }

  fold(b) { return b >= 36.45 && b < 38 ? ease.inOutCubic(clamp((b - 36.45) / 0.7)) : b >= 38 || b < 30 ? 1 : 0; }

  update(b, ctx) {
    b = wrap(b);
    this.root.visible = this.shown(ctx, this.center, 1200) && (b >= 33.9 || b < 1.3);
    if (!this.root.visible) return;
    const f = this.fold(b);
    if (f !== this.lastFold) {
      this.lastFold = f;
      const ga = this.tree.geometry.attributes.pa, gb = this.tree.geometry.attributes.pb;
      const squash = (p, o) => o.set(p.x + (this.top3.x - p.x) * f, p.y, p.z + (this.top3.z - p.z) * f);
      const A = new THREE.Vector3(), B = new THREE.Vector3();
      this.segs.forEach((s, j) => {
        squash(s.a, A); squash(s.b, B);
        for (let k = 0; k < 4; k++) { ga.setXYZ(j * 4 + k, A.x, A.y, A.z); gb.setXYZ(j * 4 + k, B.x, B.y, B.z); }
      });
      ga.needsUpdate = gb.needsUpdate = true;
    }
    const live = b >= 33.9 && b < 38;
    const reveal = live ? (b - T0) / LEVEL : 1e9;
    const treeA = live ? 1 - 0.85 * f : 0;
    this.tree.set({ res: ctx.res, reveal, opacity: treeA, gain: 1.25 });
    this.leafPts.material.opacity = live ? smoothstep(T0 + D * LEVEL, T0 + D * LEVEL + 0.1, b) * (1 - f) : 0;
    this.leafPts.material.size = 3 * ctx.res.x / 1080;
    for (const id of ['oai', 'ant']) {
      const p = this.progress(b, id);
      const on = live && b >= 34.4 ? 1 - smoothstep(36.35, 36.6, b) : 0;
      this.glow[id].set({ res: ctx.res, reveal: p, opacity: on, gain: 1.6 });
      const h = this.heads[id];
      h.mesh.visible = on > 0 && p < 1 && b < LAB[id].end;
      h.update({ pos: this.paths[id].getPointAt(p), res: ctx.res, px: 40, gain: 1.2 });
    }
  }

  labels(b) {
    b = wrap(b);
    const out = [];
    const treeA = smoothstep(34.6, 34.8, b) * (1 - smoothstep(36.3, 36.5, b));
    out.push({ p: this.root3.clone().add(new THREE.Vector3(0, -6, 0)), text: '3-SAT, n variables', style: 'label', size: 20, align: 'center', alpha: smoothstep(34.05, 34.2, b) * (1 - smoothstep(35.2, 35.4, b)) * 0.85, color: 'rgba(205,207,218,1)' });
    out.push({ screen: [0.1, 0.33], text: '2ⁿ', style: 'serif', size: 72, alpha: treeA });
    out.push({ screen: [0.1, 0.33], text: 'branches', style: 'label', size: 18, dy: 30, alpha: treeA * 0.8, color: 'rgba(205,207,218,1)' });
    for (const [id, name, date] of [['oai', 'OpenAI', 'Oct 26'], ['ant', 'Anthropic', 'Oct 27']]) {
      const p = this.paths[id].getPointAt(this.progress(b, id));
      const a = smoothstep(34.55, 34.75, b) * (1 - smoothstep(36.3, 36.5, b));
      out.push({ p, text: name, style: 'label', size: 22, dx: id === 'oai' ? -18 : 18, dy: -14, align: id === 'oai' ? 'right' : 'left', alpha: a });
      out.push({ p, text: date, style: 'mono', size: 18, dx: id === 'oai' ? -18 : 18, dy: 10, align: id === 'oai' ? 'right' : 'left', alpha: a * 0.8 });
    }
    out.push({ p: this.top3, text: '2^{o(n)}', style: 'serif', size: 52, dx: 26, dy: 14, alpha: smoothstep(36.3, 36.5, b) * (1 - smoothstep(37.35, 37.5, b)), color: 'rgba(255,120,104,1)' });
    out.push({ p: this.top3, text: 'Lean-verified · under expert review', style: 'label', size: 18, dx: 28, dy: 46, alpha: smoothstep(36.5, 36.7, b) * (1 - smoothstep(37.35, 37.5, b)) * 0.85, color: 'rgba(205,207,218,1)' });
    return out;
  }
}
