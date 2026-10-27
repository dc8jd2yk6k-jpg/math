# Δt → 0

**One line. One take. AI × mathematics, 1950 → 2026.**

A 78.5-second vertical (9:16) motion film rendered in real-time WebGL and locked to the F1 theme.
A thin straight line with a red head travels through black space. At each milestone one object
appears beside it: a lit chessboard showing Deep Blue–Kasparov Game 6, AlphaGo's Move 37, a Lean
proof card, the IMO 2025 geometry figure, and the frontier results of 2026 arriving months, then
weeks, then days apart. At the end the camera pulls back, and the straight line turns out to be the
vertical wall of an exponential plotted on a **linear time axis**. The film then rewinds to 1950 and
loops forever.

```
1950 ─── 1997 ─────── 2016 ──── 2024 ─ 2025 ─ May ─ Jul ─ Aug ─ Sep 8 ─ Oct 6 ─ Oct 26 ─ Oct 16|16
Shannon  Deep Blue    AlphaGo   IMO 🥈  IMO 🥇  Erdős  Jacobian  Perc.  N–S    722    Yang–Mills  ETH ✕
```

## Design

| Idea | How it's built |
|---|---|
| **One line, no wobble.** | The line is the data: x is linear calendar time, and y is the cumulative count of the landmarks, joined with monotone PCHIP interpolation. The camera always looks along it, so up close it reads as straight and vertical. Only the final pull-back shows the curve flat for decades and then vertical. |
| **One object per beat.** | Black space, sparse stars, nothing else. The chessboard and Go board are lit, realistic PBR. Everything else is white line art drawn stroke by stroke. The only colour is the red head. |
| **Three lines of type.** | A date in light mono that rolls between milestones (its last changing digit scrambles), a bold title, and a one-line grey caption. Small italic labels sit next to objects. |
| **Beat-locked.** | The F1 theme was measured at exactly 110 BPM, with bar 0 at 11.611 s. Every object, stroke, stone and title change lands on a bar or 16th-note position of the 36-bar edit. |
| **Exact loop.** | Frame 0 is the end state: the head at the top of the curve on 2026.10.27. Over the first bar the date rewinds and the line retracts to 1950. The last frame is pose-for-pose the first, and the audio edit loops on the bar grid. |
| **Real artifacts.** | Game 6's final position (replayed with python-chess). Game 2's first 37 moves (BGA record). The actual IMO 2025 P2 construction (the tangency is checked numerically, with error ~1e-15). A real unit-distance graph (the 7-cube with unit edges). A genuine percolation simulation at p = 0.2488. |
| **Honest captions.** | 2026 results carry their status as of 2026-10-27 ("under expert review", "mass gap not claimed"). See [SOURCES.md](SOURCES.md). |

## Structure (36 bars at 110 BPM)

| Bars | Header | Object |
|---|---|---|
| 0–1 | 2026.10.27 → rewinding | the line retracts from today back to 1950 |
| 1–2 | 1950 · Claude Shannon | red orbit rings around the head |
| 2–6 | 1997 · Deep Blue | lit board, Game 6 final position; the black king tips over |
| 6–10 | 2016 · AlphaGo | wooden board, Game 2 moves 1–37, white ring on Move 37 (bar 8) |
| 10–14 | 2024.07 · IMO Silver | Lean 4 card for P1, a compute clock running to 72 h, P1 P2 P4 P6 ticked |
| 14–16 | 2025.07 · IMO Gold | IMO 2025 P2 drawn stroke by stroke: Ω, Γ, A–H, the tangent |
| 16–18 | 2026.05 · Erdős | unit-distance graph, edge by edge |
| 18–20 | 2026.07 · Jacobian | a polynomial warp; three points meet in one |
| 20–22 | 2026.08 · Percolation | 3D lattice at p_c, largest cluster lit |
| 22–23 | 2026.09.08 · Navier–Stokes | a vortex stretches until it blows up; "Lean · no goals ■" |
| 23–24 | 2026.10.06 · 722 Manuscripts | 722 pages fly into a wall |
| 24–25 | 2026.10.26 · 4D Yang–Mills | a lattice rotating through the 4th dimension |
| 25–30 | 2026.10.16 · ETH | the 2ⁿ tree; OpenAI and Anthropic reach the top on the same beat; the tree folds into the line |
| 30–35 | 2026.10.27 · Δt → 0 | pull back: the whole line on a 1950–2026 axis |
| 35–36 | 2026.10.27 | back to the head: frame 0 |

## Run it

```bash
npm install                       # three.js
pip install librosa soundfile     # for the audio tools

# 1. Build the soundtrack edit from your own copy of the F1 theme (Brian Tyler).
#    Produces assets/audio/soundtrack.wav (gitignored) + features.json
python3 -I audio/build_soundtrack.py "/path/to/F1 Theme.m4a" assets/audio

# 2. Live, audio-synced player (space = play/pause, ←/→ = bar, H = hide UI)
npm run serve                     # → http://localhost:8080/web/

# 3. Deterministic 1080×1920 @ 60 fps render (headless Chromium + ffmpeg)
npm run render -- --workers 3     # → dist/delta-t-to-zero_1080x1920_60fps.mp4
node render/still.mjs out/ b16 b26.5 t70   # single frames (bars, seconds or frame no.)
```

## Architecture

```
audio/   analyze_track.py    tempo/phase grid search, section map
         build_soundtrack.py 36-bar edit, loop seam, -14 LUFS, per-frame features
web/src/ curve.js            the line: PCHIP spine on linear time, story position u(b), frames
         camera.js           keyframed shots: settle on each object, partial head tracking, reveal
         film.js             director: lights for the boards, FX, labels, exact loop
         world.js            stars, dust, the line (constant pixel width), the head, reveal axis
         pieces/*.js         chess, go, imo (Lean card + IMO 2025 P2), frontier, eth (+ Shannon)
         hud/                the three-line header and labels (Canvas2D)
         gfx/glow.js         soft gaussian line/point primitives
         gfx/post.js         HDR → bloom → ACES → grain → HUD → YUV420 pack
render/  render.mjs          N browser workers × 4-s chunks → x264 → concat → mux
```

Everything on screen is a pure function of time, so rendering is deterministic, parallel and
resumable chunk by chunk.

## Credits

* Music: *Formula 1 Theme*, Brian Tyler. **Not included in this repository**; supply your own copy.
* Fonts: Inter, JetBrains Mono, STIX Two (SIL Open Font License; see `assets/fonts`).
* Engine: three.js. Analysis: librosa. Encoding: ffmpeg/x264.
* Go record: British Go Association. Chess score: Deep Blue–Kasparov 1997, Game 6.
