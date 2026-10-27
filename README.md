# Δt → 0

**One take. Linear time. AI × mathematics, 1950 → 2026.**

A 78.5-second, beat-locked motion film rendered in real-time WebGL. A single unbroken camera move
rides a luminous trajectory through a 3D coordinate space. It starts at Shannon's 1950 chess paper,
runs through Deep Blue and AlphaGo, then the 2024 and 2025 Olympiads, and then a run of frontier results that
arrive months, then weeks, then days apart, ending with two rival labs refuting the Exponential Time
Hypothesis on the same day. Then the camera pulls back and the 3D helix you've been riding turns out
to be a chart: the landmarks plotted on a **linear time axis**. Flat for seventy years, then vertical.
The last frame dissolves into the first, so the film loops forever.

```
1950 ─── 1997 ─────── 2016 ──── 2024 ─ 2025 ─ May ─ Jul ─ Aug ─ Sep 8 ─ Oct 6 ─ Oct 26 ─ Oct 16|16
Shannon  Deep Blue    AlphaGo   IMO🥈   IMO🥇  Erdős  Jacobian  Perc.  N–S    722    Yang–Mills  ETH ✕
Δt:      +47 y        +18.8 y   +8.4 y +361 d +303 d  +60 d  +40 d  +11 d  +28 d   +20 d    0 (dead heat)
```

## What makes it work

| Idea | How it's built |
|---|---|
| **The curve is the data.** | The spine is literally *cumulative landmark count vs. linear calendar time*, interpolated monotonically (PCHIP) through the real dates. Nobody drew the hockey stick; the dates produce it. |
| **Helix → line.** | The camera rides a helix wound around that spine. It unfurls from a seed, tightens as breakthroughs accelerate, and converges onto the spine at the ETH climax. In the final reveal the coil visibly collapses into the exponential. |
| **Time compression you can see.** | Timing gates (F1-style timing loops) are placed at calendar intervals whose labels change granularity: `1960 1970…` → `2017 2018…` → `JUN 2025…` → `JUL 13, JUL 27…` → `OCT 12, OCT 13, OCT 14…`. By the end they flash past on 16th notes. |
| **Frame-accurate beat sync.** | The F1 theme was measured at exactly 110 BPM, with bar 0 at 11.611 s. Every reveal, whip-pan, FOV punch, glitch and flash is keyed to an exact bar or 16th-note position in the edit, plus per-frame audio features (RMS, bands, onsets). |
| **Seamless loop.** | The audio edit loops bar-aligned, and the climax rings into bar 0 through a synthesized reverb wash plus a sub impact. Visually, the last quarter-bar crossfades into the pre-roll of the opening, and the camera ends in exactly the pose it starts in. |
| **Broadcast language.** | F1 TV graphics grammar: sector bars (purple = fastest), a timing tower of landmarks with **Δt gaps**, a calendar ticker with a `1 s ≈ 3.2 YEARS → 1 s ≈ 6 HOURS` compression readout, and a "◀◀ REPLAY" photo finish. |
| **Real artifacts.** | The chessboard is the real final position of Deep Blue–Kasparov Game 6 (replayed with python-chess). The Go board replays the real first 37 moves of AlphaGo–Lee Sedol Game 2, with Move 37 on the downbeat. The percolation lattice is a genuine critical-point simulation (p = 0.2488, union-find clusters). The Erdős piece is a real unit-distance graph (the 7-cube projected with unit edges). The Yang–Mills lattice rotates through the 4th dimension. |
| **Honest labels.** | 2026 results carry the status they had on 2026-10-27 (e.g. *LEAN-FORMALIZED · UNDER EXPERT REVIEW*, *mass gap not claimed*). See [SOURCES.md](SOURCES.md). |

## Structure (36 bars at 110 BPM)

| Bars | Music (F1 theme edit) | Picture |
|---|---|---|
| 0–2 | pulse ostinato enters | ignition; decades of gates rush past (Shannon 1950) |
| 2–6 | pulse | **Deep Blue 1997**: holographic board, minimax tree grows on 16ths, alpha-beta prunes it |
| 5–6 | pulse | 19 years in one bar, through the helix tunnel |
| 6–10 | pulse | **AlphaGo 2016**: real game record, policy/value net, **Move 37** on the downbeat |
| 10–14 | drums enter | **IMO 2024 silver**: P1 P2 P4 P6 light up, walls of Lean, 72-hour compute dial (the constraints) |
| 14–16 | full theme drop | **IMO 2025 gold**: the Lean walls shatter, five panels go gold |
| 16–22 | theme, chord changes every 2 bars | **Erdős · Jacobian · Percolation**: whip-pans to each result, months → weeks |
| 22–26 | groove build | **Navier–Stokes blow-up · 722 manuscripts · 4D Yang–Mills**: one per bar, days apart |
| 26–30 | climax drop | **ETH**: the 2ⁿ tree grows, two comets cross a checkered gantry in a dead heat, the exponential collapses |
| 30–34 | climax theme | **Reveal**: the whole trajectory on a linear time axis. Δt → 0 |
| 34–36 | climax theme | dive back into the head; dissolves into frame 0 |

## Run it

```bash
npm install                       # three.js (+ ws)
pip install librosa soundfile     # for the audio tools

# 1. Build the soundtrack edit from your own copy of the F1 theme (Brian Tyler).
#    Produces assets/audio/soundtrack.wav (gitignored) + features.json
python3 -I audio/build_soundtrack.py "/path/to/F1 Theme.m4a" assets/audio

# 2. Live, audio-synced player (space = play/pause, ←/→ = bar, H = hide UI)
npm run serve                     # → http://localhost:8080/web/

# 3. Deterministic 1080p60 render (headless Chromium + ffmpeg)
npm run render -- --workers 3     # → dist/delta-t-to-zero_1080p60.mp4
node render/still.mjs out/ b16 b26.5 t70   # single frames (bars, seconds or frame no.)
```

Without the soundtrack the player still runs silently, and `features.json` (committed) keeps the
audio-reactive motion intact.

## Architecture

```
audio/   analyze_track.py   tempo/phase grid search, section map
         build_soundtrack.py 36-bar edit, loop seam, SFX layer, -14 LUFS, per-frame features
web/src/ config.js          bars ⇄ seconds, palette
         data.js            milestones, dates, card copy, Game 6 FEN, Game 2 moves
         curve.js           spine (PCHIP, linear time), calendar(b), helix trail, frames
         camera.js          one-take shot list → eased blends + slerps, whip-pans
         film.js            director: per-frame gains/FX, adaptive motion blur, loop crossfade
         gates.js           timing gates + speed streaks
         pieces/*.js        chess, go, imo, frontier (erdős, jacobian, percolation, navier,
                            papers, yang–mills), eth
         gfx/glow.js        soft gaussian ribbons / segments / sprites (no MSAA needed)
         gfx/post.js        HDR → bloom → ACES → CA/glitch/grain → HUD → YUV420 pack
         hud/               Canvas2D broadcast HUD + tiny ^{}/_{} math typesetter
render/  render.mjs         N browser workers × 4-s chunks → x264 → concat → mux
```

Everything on screen is a pure function of time. That's what makes the render deterministic,
parallel and resumable: chunks can be re-rendered on their own. Every element is additive light
with a gaussian profile, so the film looks clean without MSAA, and software rendering
(SwiftShader) is fast enough. Real motion blur comes from sub-frame accumulation, which switches
on only when the camera moves fast.

## Credits

* Music: *Formula 1 Theme*, Brian Tyler. **Not included in this repository**; supply your own copy.
* Fonts: Titillium Web, JetBrains Mono, STIX Two (SIL Open Font License; see `assets/fonts`).
* Engine: three.js. Analysis: librosa. Encoding: ffmpeg/x264.
* Go record: British Go Association. Chess score: Deep Blue–Kasparov 1997, Game 6.
