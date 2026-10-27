# Δt → 0

**One line, one take, AI × mathematics, 1950 → 2026.**

A 91.6-second vertical (1080 × 1920, 60 fps) motion film, rendered in real-time WebGL, cut to the
Formula 1 theme and looping seamlessly.

A red head draws a thin, luminous trail through black space. The trail is one curve in 3D: x is
linear calendar time, and the height grows with every landmark result. A free chase camera follows
the head. Early on the trail runs almost flat across the frame: Shannon in 1950, then the 47-year
dash to Deep Blue. It tilts upward at AlphaGo, climbs through the IMO years, and from 2026 it is
a vertical wall. Breakthroughs then arrive months, weeks and finally hours apart. Each milestone is
an object threaded on the line, and each one stays there. The final pull-back shows the whole
trajectory on a 1950–2026 axis: an exponential explosion. Then the camera dives into the floating
voxel island on the wall, which is where the film began.

```
1950 ──── 1997 ──── 2016 ── 2024.07 ─ 2025.07 ─ 05 ─ 07 ─ 08 ─ 09.08 ─ 10.06 ─ 10.26 ─ 10.27
Shannon  Deep Blue  AlphaGo  IMO 🥈    IMO 🥇   Erdős Jacobian Perc. N–S   722 papers  Yang–Mills ETH
```

## What is real

| Scene | The object |
|---|---|
| Deep Blue | The final position of Game 6 (after 19.c4), replayed with python-chess; the black king tips over on the downbeat |
| AlphaGo | Game 2, moves 1–37, landing on the sixteenth notes; Move 37 lands on the downbeat of bar 8 |
| IMO 2024 | The Lean 4 statement of Problem 1 typed into a glass card; P1 P2 P4 P6 = 28/42; compute clock to "up to 3 days" |
| IMO 2025 | Problem 2 constructed exactly and drawn stroke by stroke; the final tangent holds to 1e-16 |
| Erdős | Erdős's 1946 grid construction (unit = 5, i.e. 3-4-5 four ways), the family the 2026 result beats |
| Jacobian | **The actual counterexample map** F: det J ≡ −2, yet F(0,0,−¼) = F(1,−3/2,13/2) = F(−1,3/2,13/2) |
| Percolation | The island's trees are clusters of site percolation on ℤ³ at p_c ≈ 0.3116 (seeded simulation, union-find) |
| Navier–Stokes | The forced equations; a vortex tube that tightens, spins up and bursts; "Lean · no goals ■" |
| 722 manuscripts | 722 pages, a counter to 722 |
| Yang–Mills | A 4D hypercubic lattice turning through the fourth dimension |
| ETH | A 2^n search tree; two lab heads find short paths and reach the top a beat apart |

Every claim, date and review status is in [SOURCES.md](SOURCES.md) (checked on 2026-10-27).

## Sound and sync

The edit is built from your copy of Brian Tyler's *Formula 1 Theme* (110 BPM, bar 0 at 11.611 s).
It follows the reference film's cut: source bars 8–37½, then 41½–43½, then 47½–58. Every splice
sits on the same chord on both sides. The loop seam (bar 58 → bar 8, both on D) is a crossfade with
a reverb wash. Milestones land on downbeats: AlphaGo on the theme entry, the island on the climax
drop, the pull-back on the breakdown. FOV punches and exposure kicks fire on brass hits detected in
the audio. A synthesized sound layer adds whooshes on whips, booms on drops, a riser and a blow-up
impact. The master is −14 LUFS.

## Run it

```bash
npm install                                   # three.js + fonts
pip install librosa soundfile scipy chess     # audio tools (+ python-chess for the FEN check)

# 1. Build the soundtrack from your own copy of the F1 theme -> assets/audio/
python3 -I audio/build.py "/path/to/F1 Theme.m4a"
python3 -I audio/check_loop.py                # joins and loop seam

# 2. Live, audio-synced player (space play/pause, ←/→ bars, D debug, H hide text)
npm run serve                                 # → http://localhost:8080/web/?scale=0.5

# 3. Deterministic render: headless Chromium (software GL) → x264 → mux
node render/render.mjs --workers 2            # → dist/delta-t_1080x1920_60fps.mp4
node render/render.mjs --scale 0.4 --step 2   # quick 432x768 / 30 fps preview
node render/still.mjs out/ b26.5 t70 1234     # stills (bar, seconds or frame)
node render/sheet.mjs sheet.png               # 1 fps contact sheet
node tools/check_loop.mjs                     # seam continuity + determinism
```

The soundtrack and the rendered MP4 are gitignored, because the music is copyrighted.

## How it is built

```
web/score.json        the timing score: edit segments and sound cues (bars)
web/src/time.js       bar clock, PCHIP, periodic keyframe tracks, audio features
web/src/data.js       milestones, the Game 6 FEN, Game 2 moves, Lean P1, the Jacobian map
web/src/curve.js      the curve: linear time × stylized height, arc-length tables
web/src/story.js      where the head is at every bar; header windows; the date clock
web/src/shots.js      the shot list (az / el / dist / fov / screen offset per key)
web/src/camera.js     one camera: monotone-cubic tracks (no overshoot, C1 across the loop) + path modes
web/src/world/        the trail (constant-pixel ribbon), the head, stars / dust streaks / sky
web/src/pieces/       one module per milestone
web/src/gfx/          HDR post (motion-blur accumulation, bloom, ACES, CA, grain), screen-space lines, GPU YUV packing
web/src/hud/          the header (rolling date, typed title, caption), 3D-pinned labels, axis
audio/                analysis of the source, the edit + sound design + loudness, join checks
render/               static server, headless capture, chunked parallel x264 render, stills, sheets
```

Everything on screen is a pure function of the bar position, so any frame can be rendered at any
time, in any order, in parallel. The camera's parameters are monotone cubic tracks over keyframes,
copied one loop before and after, so motion stays smooth across the seam and never overshoots.

## Credits

* Music: *Formula 1 Theme*, Brian Tyler. **Not included**; supply your own copy.
* Fonts (SIL OFL, via Fontsource): JetBrains Mono, Inter, Instrument Serif, STIX Two.
* Engine: three.js. Audio analysis: librosa. Encoding: ffmpeg/x264.
* Every frame is rendered in real time by code written by Claude.
