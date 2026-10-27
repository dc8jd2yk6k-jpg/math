"""Measure the musical grid of the F1 theme and map the reference edit onto it.

Usage:
  python3 -I audio/analyze.py <f1 theme audio> [reference video/audio] [out.json]

Prints tempo, the bar-0 downbeat, per-bar loudness/brightness/chroma, and (if a
reference is given) which source bars the reference edit plays, found by
cross-correlating log-RMS envelopes. Writes the numbers to out.json.
"""
import sys, json, subprocess
import numpy as np
import librosa

SR = 22050


def load(path, sr=SR):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def grid(y, sr):
    hop = 64
    on = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop, n_fft=1024)
    fps = sr / hop
    t_on = lambda t: on[np.clip(np.round(t * fps).astype(int), 0, len(on) - 1)]
    best = None
    for P in np.arange(0.535, 0.556, 0.00005):
        for ph in np.arange(0, P, 0.002):
            t = 16 + ph + np.arange(0, int(110 / P)) * P
            s = t_on(t).mean()
            if best is None or s > best[0]:
                best = (s, P, 16 + ph)
    _, P, ph = best
    return on, fps, P, ph


def main():
    src = sys.argv[1]
    ref = sys.argv[2] if len(sys.argv) > 2 else None
    out = sys.argv[3] if len(sys.argv) > 3 else None
    y = load(src)
    on, fps, P, ph = grid(y, SR)
    bpm = 60 / P
    print(f'tempo {bpm:.3f} BPM (beat {P:.5f} s), beat phase {ph:.3f} s')
    # Downbeat: the beat-of-bar residue with the largest low-band (kick/drum) energy
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=256)) ** 2
    f = librosa.fft_frequencies(sr=SR, n_fft=2048)
    low = S[(f > 30) & (f < 150)].sum(0)
    tl = librosa.frames_to_time(np.arange(S.shape[1]), sr=SR, hop_length=256)
    lowat = lambda t: np.interp(t, tl, low)
    scores = []
    for r in range(4):
        t = ph + r * P + np.arange(0, 80) * 4 * P
        t = t[(t > 33) & (t < 180)]
        scores.append(lowat(t).mean())
    r = int(np.argmax(scores))
    bar0 = ph + r * P
    while bar0 - 4 * P > 0:
        bar0 -= 4 * P
    # name bar 0 as the first downbeat at/after 11 s (pulse entry), like the classic analysis
    k = np.ceil((11.0 - bar0) / (4 * P))
    bar0 = bar0 + k * 4 * P
    BAR = 4 * P
    print(f'downbeat residue scores {np.round(np.array(scores) / max(scores), 3)} -> bar 0 at {bar0:.3f} s, bar {BAR:.4f} s')

    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
    trms = librosa.times_like(rms, sr=SR, hop_length=512)
    cen = librosa.feature.spectral_centroid(y=y, sr=SR, hop_length=512)[0]
    chroma = librosa.feature.chroma_cqt(y=y, sr=SR, hop_length=512)
    bars = []
    nb = int((len(y) / SR - bar0) / BAR)
    for b in range(-5, nb):
        t0 = bar0 + b * BAR
        m = (trms >= t0) & (trms < t0 + BAR)
        if not m.any():
            continue
        ch = chroma[:, m].mean(1)
        bars.append({'bar': b, 't': round(t0, 3), 'db': round(float(20 * np.log10(rms[m].mean() + 1e-9)), 1),
                     'centroid': round(float(cen[m].mean()), 0),
                     'chroma': [round(float(c), 3) for c in ch / (ch.max() + 1e-9)]})
    notes = 'C C# D D# E F F# G G# A A# B'.split()
    print(' bar     t     dB   centroid  top chroma')
    for B in bars:
        ch = np.array(B['chroma'])
        top = ' '.join(notes[i] for i in np.argsort(-ch)[:3])
        print(f"{B['bar']:4d} {B['t']:7.2f} {B['db']:6.1f} {B['centroid']:8.0f}   {top}")

    res = {'bpm': bpm, 'beat': P, 'bar': BAR, 'bar0': bar0, 'bars': bars}

    if ref:
        yr = load(ref)
        hop = 256
        env = lambda x: np.log(np.sqrt(np.convolve(x ** 2, np.ones(hop) / hop, 'valid')[::hop]) + 1e-4)
        er, ef = env(yr), env(y)
        ht = hop / SR
        from numpy.lib.stride_tricks import sliding_window_view as sw
        L = int(2.0 / ht)
        W = sw(ef, L)
        Wn = (W - W.mean(1, keepdims=True)) / (W.std(1, keepdims=True) + 1e-9)
        segs = []
        for t in np.arange(0, len(yr) / SR - 2.0, 0.5):
            a = er[int(t / ht):int(t / ht) + L]
            a = (a - a.mean()) / (a.std() + 1e-9)
            c = Wn @ a / L
            o = int(c.argmax())
            segs.append((t, o * ht - t, c[o]))
        print('\nreference -> source offset (s), in source bars:')
        for t, off, c in segs:
            sb = (t + off - bar0) / BAR
            print(f'  ref {t:5.1f}s  off {off:7.2f}  src bar {sb:6.2f}  corr {c:.2f}')
        res['reference'] = [{'t': float(t), 'offset': float(o), 'corr': float(c)} for t, o, c in segs]

    if out:
        with open(out, 'w') as fh:
            json.dump(res, fh, indent=1)


if __name__ == '__main__':
    main()
