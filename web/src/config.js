// Global constants. Everything in the film is a pure function of time t
// (seconds) or, more conveniently, of the musical position b (bars).

export const W = 1080;    // 9:16 portrait
export const H = 1920;
export const FPS = 60;

export const BPM = 110;                 // measured: the F1 theme is locked to 110 BPM
export const BEAT = 60 / BPM;           // 0.5454 s
export const BAR = 4 * BEAT;            // 2.1818 s
export const N_BARS = 36;               // the edit: 36 bars, loops seamlessly
export const FRAMES = 4713;             // ceil(36 bars * 60 fps)
export const DURATION = FRAMES / FPS;   // 78.55 s (audio is exactly this long)
export const LOOP_BARS = DURATION / BAR;

export const toBar = (t) => t / BAR;
export const toTime = (b) => b * BAR;

// Output-bar positions of musical landmarks (see audio/build_soundtrack.py)
export const CUE = {
  ignition: 0,      // pulse ostinato starts (loop seam): the rewind
  shannon: 1,
  drums: 10,        // drums enter  -> Phase II
  gold: 14,         // full theme drop
  frontier: 16,     // chord change -> Phase III
  build: 22,        // groove build (splice)
  eth: 26,          // climax drop
  reveal: 30,
  dive: 34,
  end: 36,
};

export const PALETTE = {
  bg: [0.004, 0.006, 0.011],
  ice: '#9fdcff',
  jade: '#43ffd2',
  silver: '#cfd8e6',
  gold: '#ffc54a',
  purple: '#b56cff',
  hot: '#ff4b6e',
  red: '#ff3f3f',
  green: '#34f28a',
  yellow: '#ffd23f',
  white: '#f4f7ff',
  head: '#ff3b2e',      // the only accent colour: the head of the line
};

export const TEAM = {
  SHANNON: { name: 'C. E. SHANNON', color: '#8fa3bf' },
  IBM: { name: 'IBM', color: '#5b8def' },
  GDM: { name: 'GOOGLE DEEPMIND', color: '#3ea6ff' },
  OAI: { name: 'OPENAI', color: '#e9edf5' },
  ANT: { name: 'ANTHROPIC', color: '#e07a55' },
};
