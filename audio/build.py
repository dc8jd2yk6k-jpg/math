"""Build the loopable 42-bar soundtrack edit and the renderer's audio data.

Usage: python3 -I audio/build.py <F1 theme audio> [out_dir=assets/audio]

Musical facts (measured with audio/analyze.py on the supplied track):
  110.00 BPM, source bar 0 (pulse entry) at 11.611 s, bar = 2.1818 s
  src  8-10 pulse | 10-14 drums | 14-30 theme (D A C G, twice) | 30-34 build
  src 34-54 climax (D A C G Bb D Bb D G A Bb C) | 54-58 breakdown

The edit (web/score.json) mirrors the reference film's cut: the climax skips
src 37.5-41.5 and 43.5-47.5, both on matching chords. The output is treated as
a circle: every segment is placed with equal-power crossfades, and whatever
spills past the end wraps to the start, so the last sample flows into the
first. The loop seam (src 58 -> src 8, both centred on D) gets a longer
crossfade and a dark reverb wash.

Writes: soundtrack.wav (24-bit, gitignored), features.json (per-frame bands)
and cues.json (downbeats, detected hits and snare rolls).
"""
import sys, os, json, re, subprocess
import numpy as np
from scipy import signal
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCORE = json.load(open(os.path.join(ROOT, 'web', 'score.json')))

SR = 48000
BPM = SCORE['bpm']
SRC_BAR = 4 * 60.0 / BPM
SRC_BAR0 = 11.611
FPS = SCORE['fps']
N_BARS = SCORE['bars']
N_FRAMES = int(round(N_BARS * SRC_BAR * FPS))          # 5498
N = N_FRAMES * SR // FPS                                # samples: exactly the video length
OUT_BAR = N / SR / N_BARS                               # output bar (3 ms shorter over 42 bars)
rng = np.random.default_rng(1950)


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def add_circ(dst, sig, at):
    """Add sig into the circular buffer dst starting at sample `at` (may be negative)."""
    n = len(dst)
    i = int(round(at)) % n
    k = 0
    while k < len(sig):
        m = min(len(sig) - k, n - i)
        dst[i:i + m] += sig[k:k + m]
        k += m
        i = 0


def fade(n, kind):
    w = np.linspace(0, np.pi / 2, n)
    return (np.sin(w) if kind == 'in' else np.cos(w))[:, None]


# ---------------------------------------------------------------- sound design
def noise(n, ch=2):
    return rng.standard_normal((n, ch))


def tv_bandpass(x, f_lo, f_hi, q=1.2):
    """Band-pass noise whose centre moves over time (STFT-domain shaping)."""
    f, t, Z = signal.stft(x.T, fs=SR, nperseg=1024)
    n = Z.shape[-1]
    centre = np.geomspace(f_lo, f_hi, n) if f_hi > 0 else np.full(n, f_lo)
    lf = np.log(np.maximum(f, 1))[:, None]
    gain = np.exp(-0.5 * ((lf - np.log(centre)[None, :]) / (0.55 / q)) ** 2)
    _, y = signal.istft(Z * gain[None], fs=SR, nperseg=1024)
    return y.T[:len(x)]


def whoosh(dur):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    x = tv_bandpass(noise(n), 350, 5000, q=0.9)
    env = np.sin(np.pi * t ** 0.7) ** 2
    pan = np.stack([0.5 + 0.5 * np.cos(np.pi * t), 0.5 - 0.5 * np.cos(np.pi * t)], 1)
    y = x * env[:, None] * (0.35 + 1.3 * pan)
    return y / (np.abs(y).max() + 1e-9)


def rewind(dur):
    """Tape-rewind texture: chattering band noise rising in pitch with a stutter."""
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    x = tv_bandpass(noise(n), 300, 6000, q=1.6)
    chatter = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * np.cumsum(8 + 70 * t ** 2) / SR))
    env = np.minimum(1, t * 8) * (1 - t ** 6)
    y = x * (env * chatter)[:, None]
    return y / (np.abs(y).max() + 1e-9)


def boom(dur=2.6, f0=70, f1=32):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.16)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 - np.exp(-t / 0.003)) * np.exp(-t / 0.7)
    click = signal.lfilter([1], [1, -0.6], noise(n, 1)[:, 0]) * np.exp(-t / 0.012) * 0.25
    y = np.stack([s + click, s + click], 1)
    return y / (np.abs(y).max() + 1e-9)


def impact(dur=3.2):
    """Blow-up hit: boom plus a bright noise burst and a short reverse swell into it."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    burst = tv_bandpass(noise(n), 2500, 400, q=0.7) * np.exp(-t / 0.35)[:, None]
    y = boom(dur, 90, 30) * 0.9 + burst / (np.abs(burst).max() + 1e-9) * 0.6
    return y / (np.abs(y).max() + 1e-9)


def riser(dur):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    x = tv_bandpass(noise(n), 200, 7000, q=1.1)
    tone = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (3 * t)) / SR)
    y = x / (np.abs(x).max() + 1e-9) + 0.25 * tone[:, None]
    y *= (t ** 2.5)[:, None]
    y[-int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))[:, None]
    return y / (np.abs(y).max() + 1e-9)


def chime(dur=2.5, f=1318.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t / (0.9 / k)) for k, a in [(1, 1), (2.76, 0.4), (5.4, 0.2)])
    s *= 1 - np.exp(-t / 0.002)
    y = np.stack([s, s], 1)
    return y / (np.abs(y).max() + 1e-9)


def tick(dur=0.08, f=3200):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.012) + 0.4 * noise(n, 1)[:, 0] * np.exp(-t / 0.004)
    y = np.stack([s, s], 1)
    return y / (np.abs(y).max() + 1e-9)


def clack(seed):
    """Go stone on wood: two damped modes and a noise transient."""
    r = np.random.default_rng(seed)
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f1, f2 = 2150 * r.uniform(0.9, 1.1), 3700 * r.uniform(0.9, 1.1)
    s = np.sin(2 * np.pi * f1 * t) * np.exp(-t / 0.018) + 0.5 * np.sin(2 * np.pi * f2 * t) * np.exp(-t / 0.01)
    s += 0.6 * r.standard_normal(n) * np.exp(-t / 0.003)
    p = r.uniform(-0.6, 0.6)
    y = np.stack([s * (1 - p), s * (1 + p)], 1)
    return y / (np.abs(y).max() + 1e-9)


def key(seed):
    """Mechanical key click."""
    r = np.random.default_rng(seed)
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    s = signal.lfilter([1, -1], [1, -0.3], r.standard_normal(n)) * np.exp(-t / 0.006)
    s += 0.3 * np.sin(2 * np.pi * r.uniform(1800, 2600) * t) * np.exp(-t / 0.01)
    p = r.uniform(-0.4, 0.4)
    y = np.stack([s * (1 - p), s * (1 + p)], 1)
    return y / (np.abs(y).max() + 1e-9)


def flutter(dur):
    """Pages flying past: dense granular paper noise."""
    n = int(dur * SR)
    y = np.zeros((n, 2))
    for k in range(int(dur * 90)):
        g = tv_bandpass(noise(int(0.04 * SR)), rng.uniform(1500, 5000), 0, q=1.5)
        g *= np.hanning(len(g))[:, None]
        at = int(rng.uniform(0, n - len(g)))
        y[at:at + len(g)] += g * rng.uniform(0.2, 1.0)
    t = np.linspace(0, 1, n)
    y *= np.sin(np.pi * t)[:, None] ** 0.5
    return y / (np.abs(y).max() + 1e-9)


SFX = {'whoosh': whoosh, 'rewind': rewind, 'riser': riser, 'flutter': flutter}
ONE_SHOT = {'boom': boom, 'impact': impact, 'chime': chime, 'tick': tick}
LEVEL = {'whoosh': 0.16, 'rewind': 0.2, 'riser': 0.12, 'flutter': 0.07, 'boom': 0.42, 'impact': 0.5,
         'chime': 0.08, 'tick': 0.07, 'clack': 0.05, 'key': 0.025}


def reverb_ir(seconds=3.5, rt60=2.8):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = noise(n) * (10 ** (-3 * t / rt60))[:, None]
    b, a = signal.butter(2, 2500 / (SR / 2))
    ir = signal.lfilter(b, a, ir, axis=0)
    ir[:int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))[:, None]
    return ir / np.sqrt((ir ** 2).sum(0, keepdims=True))


def convolve(a, b):
    return np.stack([signal.fftconvolve(a[:, c], b[:, c]) for c in range(2)], 1)


# ---------------------------------------------------------------- the edit
def build(src):
    x = load(src)
    srct = lambda bar: SRC_BAR0 + bar * SRC_BAR
    out = np.zeros((N, 2))
    segs = SCORE['edit']['segments']
    xf = int(SCORE['edit']['xfade'] * SR)
    sxf = int(SCORE['edit']['seamXfade'] * SR)
    for k, (ob, sb, nb) in enumerate(segs):
        fin = sxf if k == 0 else xf                   # the seam is the join into segment 0
        fout = sxf if k == len(segs) - 1 else xf
        s0 = int(round(srct(sb) * SR)) - fin // 2
        s1 = int(round(srct(sb + nb) * SR)) + fout // 2
        piece = x[s0:s1].copy()
        piece[:fin] *= fade(fin, 'in')
        piece[-fout:] *= fade(fout, 'out')
        add_circ(out, piece, ob * OUT_BAR * SR - fin // 2)
    music = out.copy()

    # loop seam wash: the breakdown's last bar rings on into bar 0 through a dark reverb
    a, b = int(srct(57) * SR), int(srct(58) * SR)
    last = x[a:b] * np.linspace(0.2, 1, b - a)[:, None] ** 2
    wet = convolve(last, reverb_ir())[len(last):]
    wet = wet[:int(3.0 * SR)] * np.linspace(1, 0, int(3.0 * SR))[:, None] ** 2
    wet *= 0.18 / (np.abs(wet).max() + 1e-9)
    add_circ(out, wet, 0)

    # sound-design layer
    fx = np.zeros((N, 2))
    for name, bar, length, gain in SCORE['sfx']:
        at = bar * OUT_BAR * SR
        lv = LEVEL[name] * gain
        if name in SFX:
            add_circ(fx, SFX[name](length * OUT_BAR) * lv, at)
        elif name in ONE_SHOT:
            add_circ(fx, ONE_SHOT[name]() * lv, at)
    for k, (bar, kind) in enumerate(SCORE.get('foley', [])):
        sig = clack(k) if kind == 'clack' else key(k)
        add_circ(fx, sig * LEVEL[kind], bar * OUT_BAR * SR)
    return music, out + fx


def master(y, out_dir):
    peak = np.abs(y).max()
    y = np.tanh(y / peak * 1.2) / np.tanh(1.2) * 0.9
    raw = os.path.join(out_dir, 'soundtrack_raw.wav')
    sf.write(raw, y.astype(np.float32), SR, subtype='FLOAT')
    meter = subprocess.run(['ffmpeg', '-v', 'info', '-nostats', '-i', raw, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                           capture_output=True, text=True).stderr
    lufs = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', meter)[-1])
    y = y * 10 ** ((-14.0 - lufs) / 20)
    ceil = 10 ** (-1.2 / 20)
    k = 0.75 * ceil
    a = np.abs(y)
    y = np.where(a > k, np.sign(y) * (k + (ceil - k) * np.tanh((a - k) / (ceil - k))), y)
    os.remove(raw)
    return y, lufs


def features(y):
    mono = y.mean(1)
    spf = SR // FPS
    win = 2048
    fr = np.fft.rfftfreq(win, 1 / SR)
    hann = np.hanning(win)
    bands = {'low': (25, 160), 'mid': (160, 2500), 'high': (2500, 16000)}
    feats = {k: [] for k in ['rms', 'low', 'mid', 'high', 'flux']}
    prev = None
    for f in range(N_FRAMES):
        idx = (np.arange(win) + f * spf + spf // 2 - win // 2) % N     # circular: loop-aware
        seg = mono[idx] * hann
        sp = np.abs(np.fft.rfft(seg))
        feats['rms'].append(np.sqrt((seg ** 2).mean()))
        for k, (a, b) in bands.items():
            feats[k].append(sp[(fr >= a) & (fr < b)].mean())
        lg = np.log1p(sp * 10)
        feats['flux'].append(0 if prev is None else np.maximum(0, lg - prev).mean())
        prev = lg
    out = {'fps': FPS, 'frames': N_FRAMES}
    for k, v in feats.items():
        a = np.array(v)
        a = np.clip(a / (np.percentile(a, 99) + 1e-9), 0, 1.5)
        out[k] = [round(float(z), 3) for z in a]
    return out


def cues(music):
    """Hits and snare rolls detected in the edited music (before sound design)."""
    import librosa
    mono = music.mean(1).astype(np.float32)
    y = librosa.resample(mono, orig_sr=SR, target_sr=22050)
    hop = 128
    H, P = librosa.decompose.hpss(librosa.stft(y, n_fft=2048, hop_length=hop), margin=2.0)
    perc = librosa.istft(P, hop_length=hop, length=len(y))
    env = librosa.onset.onset_strength(y=perc, sr=22050, hop_length=hop)
    full = librosa.onset.onset_strength(y=y, sr=22050, hop_length=hop, aggregate=np.median)
    t = librosa.times_like(env, sr=22050, hop_length=hop)
    # hits: strong broadband onsets, at least an eighth note apart
    strength = full / (np.percentile(full, 99.5) + 1e-9)
    peaks = librosa.util.peak_pick(strength, pre_max=8, post_max=8, pre_avg=40, post_avg=40, delta=0.18, wait=int(0.27 * 22050 / hop))
    hits = [{'t': round(float(t[i]), 4), 'bar': round(float(t[i] / OUT_BAR), 4), 's': round(float(min(1.5, strength[i])), 3)}
            for i in peaks if strength[i] > 0.35]
    # snare rolls: windows where percussive onsets come faster than 16ths
    pk = librosa.util.peak_pick(env / (env.max() + 1e-9), pre_max=2, post_max=2, pre_avg=6, post_avg=6, delta=0.04, wait=2)
    pt = t[pk]
    rolls, i = [], 0
    while i < len(pt):
        j = i
        while j + 1 < len(pt) and pt[j + 1] - pt[j] < 0.11:
            j += 1
        if j - i >= 6:
            rolls.append({'t0': round(float(pt[i]), 3), 't1': round(float(pt[j]), 3),
                          'b0': round(float(pt[i] / OUT_BAR), 3), 'b1': round(float(pt[j] / OUT_BAR), 3)})
        i = j + 1
    return {'bar': OUT_BAR, 'bars': N_BARS, 'frames': N_FRAMES, 'hits': hits, 'rolls': rolls}


def main():
    src = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'assets', 'audio')
    os.makedirs(out_dir, exist_ok=True)
    music, mix = build(src)
    y, lufs = master(mix, out_dir)
    sf.write(os.path.join(out_dir, 'soundtrack.wav'), y.astype(np.float32), SR, subtype='PCM_24')
    # the music alone (no sound design), for checking the splices themselves
    sf.write(os.path.join(out_dir, 'soundtrack_music.wav'), (music / (np.abs(music).max() + 1e-9) * 0.8).astype(np.float32), SR, subtype='PCM_16')
    print(f'edit: {N} samples = {N / SR:.4f} s = {N_FRAMES} frames @ {FPS}; measured {lufs:.1f} LUFS before gain')
    with open(os.path.join(out_dir, 'features.json'), 'w') as fh:
        json.dump(features(y), fh, separators=(',', ':'))
    c = cues(music)
    with open(os.path.join(out_dir, 'cues.json'), 'w') as fh:
        json.dump(c, fh, indent=0)
    print(f"cues: {len(c['hits'])} hits, {len(c['rolls'])} rolls")


if __name__ == '__main__':
    main()
