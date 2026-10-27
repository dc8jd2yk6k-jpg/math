// 2024.07 · IMO silver. A frosted-glass card, like a chat window: the head sits
// in its input line while the Lean statement of Problem 1 types itself out,
// the six problems are scored, and a compute clock spins to "up to 3 days".
import * as THREE from 'three';
import { Piece } from './piece.js';
import { LEAN_P1, IMO24 } from '../data.js';
import { L } from '../layout.js';
import { S_OF } from '../curve.js';
import { WINDOWS } from '../story.js';
import { BAR, clamp, smoothstep, wrap, ease } from '../time.js';

const CW = 720, CH = 940;           // canvas pixels
const W = 13, H = W * CH / CW;      // world units

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

const KW = /\b(theorem|by|Even|Finset)\b/g;

export class LeanCard extends Piece {
  constructor() {
    super('imo24', { appearS: S_OF.imo24 - 30, window: WINDOWS.imo24 });
    this.center = L.imo24.center;
    this.canvas = document.createElement('canvas');
    this.canvas.width = CW; this.canvas.height = CH;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(1.25, 1.25, 1.3) });
    this.card = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
    this.card.position.copy(this.center);
    this.card.rotation.y = -0.16;
    this.card.renderOrder = 3;
    this.root.add(this.card);
    this.mat = mat;
    this.lastKey = '';
  }

  // what the card shows at bar b (state 0..1 values), so redraws only happen when it changes
  state(b) {
    const [a] = this.window;
    if (b >= 38 || b < 3) return { chars: 1e9, scores: 6, clock: 1, score: 1, cursor: false, final: true };
    if (b < a) return { chars: 0, scores: 0, clock: 0, score: 0, cursor: true, final: false };
    const t = (b - a) * BAR;                                  // seconds into the window
    return {
      chars: Math.floor(Math.max(0, t - 0.35) * 46),
      scores: Math.floor(clamp((b - 12.0) * 16 + 1, 0, 6)),
      score: smoothstep(12.4, 12.55, b),
      clock: clamp((b - 12.5) / 1.1),
      cursor: Math.floor(b * 8) % 2 === 0,
      final: false,
    };
  }

  draw(st) {
    const g = this.g;
    g.clearRect(0, 0, CW, CH);
    // glass
    roundRect(g, 6, 6, CW - 12, CH - 12, 46);
    const grad = g.createLinearGradient(0, 0, CW, CH);
    grad.addColorStop(0, 'rgba(58,62,72,0.62)');
    grad.addColorStop(1, 'rgba(28,30,36,0.55)');
    g.fillStyle = grad; g.fill();
    g.lineWidth = 3; g.strokeStyle = 'rgba(235,238,248,0.42)'; g.stroke();
    // header
    g.font = '500 25px Inter, STIXMath'; g.fillStyle = 'rgba(210,214,226,0.85)';
    g.fillText('AlphaProof', 44, 70);
    g.fillStyle = 'rgba(160,165,180,0.8)'; g.fillText('·  Lean 4  ·  IMO 2024', 178, 70);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(40, 94, CW - 80, 2);
    // code, typed
    g.font = '400 23px JBM, STIXMath';
    let left = st.chars, y = 150;
    for (const line of LEAN_P1) {
      if (left <= 0) break;
      const vis = [...line].slice(0, left).join('');
      left -= [...line].length + 4;
      let x = 44;
      // colour keywords
      const parts = vis.split(KW);
      for (const p of parts) {
        g.fillStyle = /^(theorem|by)$/.test(p) ? 'rgba(255,128,112,0.95)' : /^(Even|Finset)$/.test(p) ? 'rgba(140,200,255,0.95)' : 'rgba(232,234,242,0.95)';
        g.fillText(p, x, y);
        x += g.measureText(p).width;
      }
      if (left <= 0 && st.cursor) { g.fillStyle = 'rgba(240,240,250,0.9)'; g.fillRect(x + 3, y - 20, 12, 25); }
      y += 38;
    }
    // per-problem scores
    y = 390;
    g.font = '600 26px Inter, STIXMath';
    for (let i = 0; i < 6; i++) {
      const on = i < st.scores;
      const x = 44 + i * 106;
      roundRect(g, x, y - 34, 94, 50, 14);
      g.fillStyle = on ? (IMO24[i] ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)') : 'rgba(255,255,255,0.03)';
      g.fill();
      if (!on) continue;
      g.fillStyle = IMO24[i] ? 'rgba(240,242,250,0.98)' : 'rgba(150,154,168,0.8)';
      g.fillText(`P${i + 1}`, x + 14, y);
      g.font = '400 26px STIXMath'; g.fillText(IMO24[i] ? '✓' : '·', x + 60, y); g.font = '600 26px Inter, STIXMath';
    }
    // total
    if (st.score > 0) {
      g.globalAlpha = st.score;
      g.font = '300 88px JBM, STIXMath'; g.fillStyle = 'rgba(244,245,252,1)';
      g.fillText('28', 44, 520); g.fillStyle = 'rgba(160,165,180,1)'; g.fillText('/42', 44 + g.measureText('28').width + 8, 520);
      g.font = '500 25px Inter, STIXMath'; g.fillStyle = 'rgba(200,204,216,0.9)';
      g.fillText('silver · one point below gold', 46, 562);
      g.globalAlpha = 1;
    }
    // compute clock
    if (st.clock > 0) {
      const hrs = 72 * ease.inOutCubic(st.clock);
      const hh = String(Math.floor(hrs)).padStart(2, '0'), mm = String(Math.floor((hrs % 1) * 60)).padStart(2, '0');
      g.font = '500 23px Inter, STIXMath'; g.fillStyle = 'rgba(160,165,180,0.9)';
      g.fillText('compute per problem', 46, 640);
      g.font = '300 56px JBM, STIXMath'; g.fillStyle = 'rgba(244,245,252,0.98)';
      g.fillText(`${hh}:${mm}:00`, 44, 700);
      g.font = '500 23px Inter, STIXMath'; g.fillStyle = 'rgba(255,128,112,0.95)';
      if (st.clock > 0.98) g.fillText('up to 3 days', 360, 700);
      // dial
      const cx = 620, cy = 670, r = 34;
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(255,128,112,0.95)'; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (hrs % 12) / 12 * Math.PI * 2); g.stroke();
    }
    // input line, where the head sits
    roundRect(g, 34, CH - 128, CW - 68, 78, 39);
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill();
    g.lineWidth = 2; g.strokeStyle = 'rgba(235,238,248,0.35)'; g.stroke();
    g.font = '400 24px Inter, STIXMath'; g.fillStyle = 'rgba(170,175,190,0.75)';
    g.fillText('hand-translated into Lean', 120, CH - 80);
    g.beginPath(); g.arc(CW - 82, CH - 89, 22, 0, Math.PI * 2); g.fillStyle = 'rgba(235,238,248,0.8)'; g.fill();
    g.fillStyle = 'rgba(30,32,38,1)'; g.font = '400 26px STIXMath'; g.fillText('↑', CW - 90, CH - 79);
    this.tex.needsUpdate = true;
  }

  update(b, ctx) {
    b = wrap(b);
    this.root.visible = this.shown(ctx, this.center, 400);
    if (!this.root.visible) return;
    const st = this.state(b);
    const key = JSON.stringify(st);
    if (key !== this.lastKey) { this.draw(st); this.lastKey = key; }
    this.mat.opacity = this.presence(ctx, 12);
  }
}
