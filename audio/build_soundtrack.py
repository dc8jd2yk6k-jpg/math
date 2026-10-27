"""Build the 36-bar loopable soundtrack edit from the F1 theme and export
frame-accurate audio features for the renderer.

Usage: python3 -I audio/build_soundtrack.py <source.wav|m4a> <out_dir>

Musical facts (measured with audio/analyze_track.py):
  tempo 110 BPM exactly, bar 0 downbeat (pulse entry) at 11.611 s
  bars  0-10 pulse ostinato | 10-14 drums enter | 14-30 full theme (D A C G x2)
  bars 30-34 groove build   | 34-54 climax theme | 54+ breakdown/outro
Edit (source bars):  [0, 22) + [30, 44)  = 36 bars = 78.545 s
  output bars  0-22 = source bars 0-22   (pulse, drums, theme cycle 1)
  output bars 22-36 = source bars 30-44  (build + climax)
The source bars 20-21 and 28-29 are both the G chord, so splice 1 is a
one-beat equal-power crossfade between identical harmony. The loop seam
(source bar 44 -> bar 0, A# -> D) carries the climax's continuation into
a synthesized reverb wash plus sub impact laid over the first bar.
"""
import sys, json, subprocess, os, re
import numpy as np

SR = 48000
BPM = 110.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
BAR0 = 11.611            # source time of bar 0 downbeat
FPS = 60
N_BARS = 36
DUR_MUSICAL = N_BARS * BAR                     # 78.5454 s
N_FRAMES = int(np.ceil(DUR_MUSICAL * FPS))     # 4713
N_SAMPLES = N_FRAMES * SR // FPS               # exact video length in samples


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2',
                          '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def src_t(bar):
    return BAR0 + bar * BAR


def seg(x, t0, n):
    i0 = int(round(t0 * SR))
    return x[i0:i0 + n].copy()


def synth_reverb_ir(seconds=3.2, rt60=2.4, seed=7):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    env = 10 ** (-3 * t / rt60)
    ir = rng.standard_normal((n, 2)) * env[:, None]
    # darken the tail: one-pole lowpass whose cutoff falls with time
    out = np.zeros_like(ir)
    y = np.zeros(2)
    for i in range(n):
        a = 0.35 + 0.6 * min(1.0, t[i] / seconds)
        y = a * y + (1 - a) * ir[i]
        out[i] = y
    out[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    return out / np.sqrt((out ** 2).sum(0, keepdims=True))


def fft_convolve(a, b):
    n = len(a) + len(b) - 1
    nfft = 1 << (n - 1).bit_length()
    out = np.zeros((n, 2))
    for c in range(2):
        out[:, c] = np.fft.irfft(np.fft.rfft(a[:, c], nfft) * np.fft.rfft(b[:, c], nfft), nfft)[:n]
    return out


def sub_boom(dur=2.4, f0=62, f1=31, gain=0.55):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.18)
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = (1 - np.exp(-t / 0.004)) * np.exp(-t / 0.55)
    s = np.sin(ph) * env * gain
    return np.stack([s, s], 1)


def riser(dur, gain=0.12, seed=3):
    """Filtered-noise swell that ends exactly at its last sample."""
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal((n, 2))
    out = np.zeros_like(noise)
    y = np.zeros(2)
    for i in range(n):
        p = t[i] / dur
        a = 0.995 - 0.6 * p ** 2           # cutoff sweeps up
        y = a * y + (1 - a) * noise[i]
        out[i] = y
    out -= np.concatenate([out[:1], out[:-1]]) * 0.6   # gentle highpass tilt
    env = (t / dur) ** 3
    out *= env[:, None]
    return out / (np.abs(out).max() + 1e-9) * gain


def whoosh(dur=0.55, gain=0.06, seed=11):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal((n, 2))
    out = np.zeros_like(noise)
    y = np.zeros(2)
    for i in range(n):
        p = t[i] / dur
        a = 0.97 - 0.5 * np.sin(np.pi * p)
        y = a * y + (1 - a) * noise[i]
        out[i] = y
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    pan = np.stack([0.5 + 0.5 * np.cos(np.pi * t / dur), 0.5 - 0.5 * np.cos(np.pi * t / dur)], 1)
    out = out * env[:, None] * (0.4 + 1.2 * pan)
    return out / (np.abs(out).max() + 1e-9) * gain


def add(dst, sig, at):
    i0 = int(round(at * SR))
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    n = min(len(sig), len(dst) - i0)
    if n > 0:
        dst[i0:i0 + n] += sig[:n]


def main():
    src, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    x = load(src)

    bar_n = BAR * SR
    out = np.zeros((N_SAMPLES, 2))

    # --- part 1: output bars 0..22  <- source bars 0..22 (+ one beat of overlap)
    xf = int(round(BEAT * SR))                       # one-beat crossfade
    n1 = int(round(22 * bar_n))
    p1 = seg(x, src_t(0), n1 + xf)
    # --- part 2: output bars 22..36 (+ tail to fill the frame-rounded length)
    n2 = N_SAMPLES - n1
    p2 = seg(x, src_t(30) - BEAT, n2 + xf)           # starts one beat early (G chord)
    w = np.linspace(0, np.pi / 2, xf)
    fade_out, fade_in = np.cos(w)[:, None], np.sin(w)[:, None]
    out[:n1 - xf] = p1[:n1 - xf]
    out[n1 - xf:n1] = p1[n1 - xf:n1] * fade_out + p2[:xf] * fade_in
    out[n1:] = p2[xf:xf + n2]

    # --- loop seam: the climax keeps ringing into bar 0 as a dark reverb wash
    seam_src = src_t(44) + (N_SAMPLES / SR - DUR_MUSICAL)   # exact continuation point
    dry = seg(x, seam_src, int(1.5 * SR))
    tdry = np.arange(len(dry)) / SR
    dry_tail = dry * np.exp(-tdry / 0.09)[:, None]
    last_bar = seg(x, src_t(43), int(bar_n))
    last_bar *= np.linspace(0.15, 1.0, len(last_bar))[:, None] ** 2
    wet = fft_convolve(last_bar, synth_reverb_ir())
    wet = wet[len(last_bar):]                         # the part that rings past the seam
    wet *= 0.55 / (np.abs(wet).max() + 1e-9)
    wet = wet[: int(3.0 * SR)] * np.linspace(1, 0, int(3.0 * SR))[:, None] ** 1.5
    add(out, dry_tail, 0.0)
    add(out, wet, 0.0)

    # --- sound design layer, all on the bar grid (output time)
    add(out, sub_boom(), 0.0)                        # ignition (also the loop seam)
    add(out, sub_boom(gain=0.45), 10 * BAR)          # Phase II: drums enter
    add(out, sub_boom(gain=0.6), 14 * BAR)           # IMO gold drop
    add(out, sub_boom(gain=0.4), 16 * BAR)           # frontier sector
    add(out, sub_boom(dur=3.2, gain=0.75), 26 * BAR) # ETH climax
    add(out, sub_boom(gain=0.45), 30 * BAR)          # reveal
    r = riser(2 * BAR, gain=0.10)
    add(out, r, 26 * BAR - len(r) / SR)               # into the ETH drop
    r2 = riser(BAR, gain=0.07, seed=5)
    add(out, r2, 14 * BAR - len(r2) / SR)             # into the gold drop
    r3 = riser(BAR, gain=0.06, seed=9)
    add(out, r3, N_SAMPLES / SR - len(r3) / SR)       # into the loop seam
    for b, s in [(5, 1), (9.5, 2), (13.5, 3), (21.75, 4), (29.75, 6), (33.5, 8)]:
        add(out, whoosh(seed=20 + s), b * BAR - 0.3)

    # --- master: gentle glue + true-peak safety, then loudnorm in ffmpeg
    peak = np.abs(out).max()
    out = np.tanh(out / peak * 1.25) / np.tanh(1.25) * 0.89
    raw_path = os.path.join(out_dir, 'soundtrack_raw.wav')
    import soundfile as sf
    sf.write(raw_path, out.astype(np.float32), SR, subtype='FLOAT')
    final = os.path.join(out_dir, 'soundtrack.wav')
    # static gain to -14 LUFS (measured by ffmpeg's EBU R128 meter); a dynamic
    # normalizer would pump and is not loop-aware
    meter = subprocess.run(['ffmpeg', '-v', 'info', '-nostats', '-i', raw_path, '-af',
                            'ebur128=peak=true', '-f', 'null', '-'],
                           capture_output=True, text=True).stderr
    lufs = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', meter)[-1])
    y = out * 10 ** ((-14.0 - lufs) / 20)
    ceiling = 10 ** (-1.0 / 20)
    y = np.where(np.abs(y) > 0.8 * ceiling,
                 np.sign(y) * (0.8 * ceiling + 0.2 * ceiling * np.tanh((np.abs(y) - 0.8 * ceiling) / (0.2 * ceiling))),
                 y)
    sf.write(final, y.astype(np.float32), SR, subtype='PCM_24')
    print('measured', lufs, 'LUFS -> gain', -14.0 - lufs, 'dB')

    # --- frame-accurate features for the renderer
    mono = y.mean(1)
    spf = SR // FPS
    win = 2048
    feats = {'fps': FPS, 'frames': N_FRAMES, 'bpm': BPM, 'bars': N_BARS,
             'duration': N_SAMPLES / SR, 'rms': [], 'low': [], 'mid': [], 'high': [], 'onset': []}
    freqs = np.fft.rfftfreq(win, 1 / SR)
    hann = np.hanning(win)
    prev = None
    for f in range(N_FRAMES):
        c = f * spf + spf // 2
        idx = (np.arange(win) + c - win // 2) % N_SAMPLES     # periodic (loop-aware)
        fr = mono[idx] * hann
        sp = np.abs(np.fft.rfft(fr))
        feats['rms'].append(float(np.sqrt((fr ** 2).mean())))
        feats['low'].append(float(sp[(freqs > 25) & (freqs < 160)].mean()))
        feats['mid'].append(float(sp[(freqs >= 160) & (freqs < 2500)].mean()))
        feats['high'].append(float(sp[freqs >= 2500].mean()))
        lg = np.log1p(sp * 10)
        feats['onset'].append(0.0 if prev is None else float(np.maximum(0, lg - prev).mean()))
        prev = lg
    for k in ['rms', 'low', 'mid', 'high', 'onset']:
        a = np.array(feats[k])
        a = a / (np.percentile(a, 99) + 1e-9)
        feats[k] = [round(float(v), 4) for v in np.clip(a, 0, 1.5)]
    with open(os.path.join(out_dir, 'features.json'), 'w') as fh:
        json.dump(feats, fh, separators=(',', ':'))
    print(json.dumps({'frames': N_FRAMES, 'samples': N_SAMPLES, 'seconds': N_SAMPLES / SR}))


if __name__ == '__main__':
    main()
