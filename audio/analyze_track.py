"""Measure the musical grid of the source track (tempo, bar phase, sections).

Usage: python3 -I audio/analyze_track.py <source audio> [spectrogram.png]

How the numbers in build_soundtrack.py were found:
  1. Onset strength envelope (librosa), hop 64 @ 44.1 kHz.
  2. Exhaustive search over beat period (0.520-0.560 s, 0.2 ms steps) and
     phase, maximizing mean onset strength on the grid -> exactly 110.0 BPM.
  3. Phase refined to 2 ms over bars 10-210. The bar phase is fixed by the
     section downbeats (drums 33.43 s, theme 42.15 s, build 77.07 s, climax
     85.80 s), which all land on the same beat-of-bar -> bar 0 = 11.611 s.
  4. RMS / band energies per bar to find the sections.
"""
import sys
import numpy as np
import librosa


def main():
    path = sys.argv[1]
    y, sr = librosa.load(path, sr=44100, mono=True)
    hop = 64
    on = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop, n_fft=1024)
    fps = sr / hop

    def score(P, ph, lo, hi):
        ks = np.arange(np.ceil((lo - ph) / P), np.floor((hi - ph) / P))
        t = ph + ks * P
        return on[np.round(t * fps).astype(int)].mean()

    best = None
    for P in np.arange(0.520, 0.560, 0.0002):
        for ph in np.arange(0, P, 0.004):
            s = score(P, 16 + ph, 16, 130)
            if best is None or s > best[0]:
                best = (s, P, 16 + ph)
    _, P, ph = best
    print(f"tempo: {60 / P:.3f} BPM (period {P:.5f} s)")

    beat = 60 / 110.0
    # downbeat candidates: section entries measured from the spectrogram
    entries = [33.43, 42.15, 77.07, 85.80]
    k = [(e - ph) / beat for e in entries]
    print("section entries in beats from phase:", np.round(k, 2), "(all same residue mod 4 -> downbeats)")
    bar0 = entries[1] - 14 * 4 * beat
    best = None
    for d in np.arange(-0.06, 0.06, 0.002):
        t = bar0 + d + np.arange(40, 840) * beat / 4
        s = on[np.round(t * fps).astype(int)].mean()
        if best is None or s > best[0]:
            best = (s, d)
    bar0 += best[1]
    print(f"bar 0 downbeat: {bar0:.3f} s   bar length {4 * beat:.4f} s")

    rms = librosa.feature.rms(y=y, frame_length=4096, hop_length=512)[0]
    t = librosa.times_like(rms, sr=sr, hop_length=512)
    print("bar  time    rms dB")
    for b in range(-5, 82):
        t0 = bar0 + b * 4 * beat
        m = (t >= t0) & (t < t0 + 4 * beat)
        if m.any():
            print(f"{b:4d} {t0:7.2f} {20 * np.log10(rms[m].mean() + 1e-9):7.1f}")

    if len(sys.argv) > 2:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        D = librosa.amplitude_to_db(np.abs(librosa.stft(y, n_fft=2048, hop_length=512)), ref=np.max)
        plt.figure(figsize=(30, 6))
        plt.imshow(D[:300], origin='lower', aspect='auto', cmap='magma', vmin=-80,
                   extent=[0, len(y) / sr, 0, 300 * sr / 2048])
        for b in range(0, 82, 2):
            plt.axvline(bar0 + b * 4 * beat, color='w', lw=0.4, alpha=0.5)
        plt.tight_layout()
        plt.savefig(sys.argv[2], dpi=60)


if __name__ == '__main__':
    main()
