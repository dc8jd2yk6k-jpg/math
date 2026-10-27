// The story clock: where the head is (arc length s) at every bar, which
// milestone owns the header, and what the date reads.
import { Pchip, N_BARS, wrap, clamp } from './time.js';
import { S_OF, S_END, yearAtS } from './curve.js';
import { MILESTONES, BY_ID } from './data.js';

const S = S_OF;

// Where the head parks at each milestone (arc length on the curve). The island
// node sits just above the forest canopy where the line pierces it; ETH has a
// root (where the 2^n tree starts) and the top (today).
export const NODE = {
  shannon: 0, deepblue: S.deepblue, alphago: S.alphago, imo24: S.imo24, imo25: S.imo25,
  erdos: S.erdos, jacobian: S.jacobian, percolation: S.percolation + 22, navier: S.navier,
  papers: S.papers, yangmills: S.yangmills, eth: S.yangmills + 36, top: S_END,
};

// Stop-and-orbit: the head eases in and stops exactly on the node on the
// downbeat, holds perfectly still while the camera works, then accelerates
// away. [node, arrive, depart] in bars.
export const HOLDS = [
  ['shannon', 2.0, 2.5], ['deepblue', 4.0, 5.75], ['alphago', 6.0, 8.875], ['imo24', 10.0, 13.75],
  ['imo25', 14.0, 17.75], ['erdos', 18.0, 19.75], ['jacobian', 20.0, 21.75], ['percolation', 22.0, 28.75],
  ['navier', 29.5, 31.625], ['papers', 32.0, 32.75], ['yangmills', 33.0, 33.75], ['eth', 34.0, 34.4],
];
export const HOLD = Object.fromEntries(HOLDS.map(([id, a, d]) => [id, [a, d]]));

// [bar, s]: equal neighbouring values give the monotone cubic zero slope, so the
// head decelerates into each node, stays put, and accelerates out of it.
export const HEAD_KEYS = [
  [0, S_END], [0.62, S_END],
  // the rewind: as the camera yanks back to the island the head streaks down the
  // wall into it (1.0), then on down through the knee and along the flat to 1950
  [0.88, S.navier], [1.0, NODE.percolation], [1.12, S.jacobian], [1.22, S.erdos], [1.3, S.imo25],
  [1.38, S.imo24], [1.5, S.alphago], [1.68, S.deepblue],
  ...HOLDS.flatMap(([id, a, d]) => [[a, NODE[id]], [d, NODE[id]]]),
  // ETH: the main head waits at the root while the two lab heads race; it reappears at the top
  [36.25, S_END], [N_BARS, S_END],
];

const headP = new Pchip(HEAD_KEYS.map((k) => k[0]), HEAD_KEYS.map((k) => k[1]));
export const headSAt = (b) => clamp(headP.at(wrap(b)), 0, S_END);
export const isParked = (b) => { b = wrap(b); return HOLDS.some(([, a, d]) => b >= a && b <= d) || b >= 36.25 || b < 0.62; };

// which milestone holds the header, by bar; between windows the date rolls
export const WINDOWS = {
  shannon: [2.0, 3.0], deepblue: [4.0, 5.75], alphago: [6.0, 8.875], imo24: [10.0, 13.75], imo25: [14.0, 17.75],
  erdos: [18.0, 19.75], jacobian: [20.0, 21.75], percolation: [22.0, 28.75], navier: [29.5, 31.625],
  papers: [32.0, 32.75], yangmills: [33.0, 33.75], eth: [34.0, 37.5],
};
export const CREDIT = [37.5, 38.65];

export function activeMilestone(b) {
  b = wrap(b);
  for (const m of MILESTONES) {
    const w = WINDOWS[m.id];
    if (b >= w[0] && b < w[1]) return m;
  }
  return null;
}

const pad = (n) => String(n).padStart(2, '0');
export function formatYear(yr, precision) {
  const y = Math.floor(yr);
  if (precision === 'Y') return String(y);
  const start = Date.UTC(y, 0, 1), end = Date.UTC(y + 1, 0, 1);
  const d = new Date(start + (yr - y) * (end - start));
  if (precision === 'YM') return `${y}.${pad(d.getUTCMonth() + 1)}`;
  return `${y}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
}

// the date shown in the header at bar b
export function dateAt(b) {
  b = wrap(b);
  if (b < 0.62) return '2026';
  if (b >= CREDIT[0]) return '2026.10.27';
  const yr = yearAtS(headSAt(b));
  if (b < 2.0) return formatYear(yr, 'Y');            // the rewind rolls years only
  const m = activeMilestone(b);
  if (m && m.id === 'eth') return b < 36.25 ? '2026.10.26' : m.date;   // OpenAI's day, then Anthropic's
  if (m) return m.date;
  const precision = yr < 2024 ? 'Y' : yr < BY_ID.navier.year - 0.01 ? 'YM' : 'YMD';
  return formatYear(yr, precision);
}

export const sOfMilestone = (id) => S_OF[id];
