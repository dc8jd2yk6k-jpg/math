"""Check the soundtrack's joins: the loop seam and every splice.

Usage: python3 -I audio/check_loop.py [assets/audio/soundtrack_music.wav]

Checks the music-only stem by default: the full mix deliberately lands hits
(booms, the blow-up impact) on some joins.

For each join it reports the sample step across the join, the short-term level
on either side, and the spectral flux at the join relative to the track's
typical flux at beat onsets. A seamless join has a step no larger than the
signal's ordinary sample-to-sample change and flux no larger than a normal
beat. The loop seam is checked by rolling the file so the end meets the start.
"""
import sys, os, json
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def flux_curve(m, sr, hop=256, win=1024):
    n = (len(m) - win) // hop
    idx = np.arange(win)[None, :] + hop * np.arange(n)[:, None]
    sp = np.log1p(np.abs(np.fft.rfft(m[idx] * np.hanning(win), axis=1)) * 10)
    return np.r_[0, np.maximum(0, np.diff(sp, axis=0)).mean(1)], hop


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets/audio/soundtrack_music.wav')
    score = json.load(open(os.path.join(ROOT, 'web/score.json')))
    y, sr = sf.read(path)
    n = len(y)
    bar = n / sr / score['bars']
    joins = [('loop seam', 0.0)] + [(f'splice @ bar {s[0]}', s[0]) for s in score['edit']['segments'][1:]]
    m = y.mean(1)
    typical_step = np.percentile(np.abs(np.diff(m)), 99.9)
    ok = True
    for name, b in joins:
        at = int(round(b * bar * sr))
        r = np.roll(m, -at + sr)                     # join sits at 1 s
        step = abs(r[sr] - r[sr - 1])
        lvl = lambda a, z: 20 * np.log10(np.sqrt((r[a:z] ** 2).mean()) + 1e-9)
        pre, post = lvl(sr - sr // 4, sr), lvl(sr, sr + sr // 4)
        fl, hop = flux_curve(r[:2 * sr], sr)
        j = sr // hop
        local = fl[j - 2:j + 3].max()
        ref = np.percentile(flux_curve(m, sr)[0], 95)
        flag = step <= typical_step and local <= 2.0 * ref
        ok &= flag
        print(f'{name:18s} step {step:.4f} (p99.9 {typical_step:.4f})  level {pre:6.1f} -> {post:6.1f} dB  '
              f'flux {local / ref:4.2f}x p95  {"OK" if flag else "CHECK"}')
    print('all joins clean' if ok else 'some joins need a listen')


if __name__ == '__main__':
    main()
