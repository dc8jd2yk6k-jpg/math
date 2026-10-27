// The story clock: where the head is (arc length s) at every bar, which
// milestone owns the header, and what the date reads.
import { Pchip, N_BARS, wrap, clamp } from './time.js';
import { S_OF, S_END, yearAtS } from './curve.js';
import { MILESTONES, BY_ID } from './data.js';

const S = S_OF;

// [bar, s]. Short gaps between keys are the dashes from one object to the next;
// long gaps are dwells where the head drifts slowly through an object.
export const HEAD_KEYS = [
  [0, S_END], [1.0, S_END],
  [1.4, S.erdos], [1.75, S.alphago - 40], [2.0, 0], [2.5, 0.3],   // the rewind lands on the drums: 1950
  [3.85, S.deepblue - 7], [6.0, S.deepblue + 6],             // across the chessboard
  [6.2, S.alphago - 7], [9.0, S.alphago + 6],                // over the Go board
  [10.0, S.imo24 - 2], [13.8, S.imo24 - 1.2],                // parked in the Lean card's input line
  [14.05, S.imo25 - 1.5], [17.8, S.imo25 + 3],               // point A of the IMO 2025 figure
  [18.05, S.erdos - 3], [19.8, S.erdos + 4],
  [20.05, S.jacobian - 3], [21.8, S.jacobian + 4],
  [22.2, S.percolation - 45], [25.6, S.percolation - 22],     // rising into the island
  [26.0, S.percolation - 16], [29.0, S.percolation + 10], [29.5, S.percolation + 48],
  [29.85, S.navier - 2], [31.5, S.navier + 3],
  [31.95, S.papers - 3], [32.9, S.papers + 4],
  [33.1, S.yangmills - 2], [33.9, S.yangmills + 3],
  [34.0, S.yangmills + 8], [34.5, S.yangmills + 30], [36.0, S_END - 12], [36.25, S_END],
  [N_BARS, S_END],
];

const headP = new Pchip(HEAD_KEYS.map((k) => k[0]), HEAD_KEYS.map((k) => k[1]));
export const headSAt = (b) => clamp(headP.at(wrap(b)), 0, S_END);

// which milestone holds the header, by bar; between windows the date rolls
export const WINDOWS = {
  shannon: [2.0, 3.0], deepblue: [3.875, 6.0], alphago: [6.125, 9.0], imo24: [10.0, 13.9], imo25: [14.0, 17.95],
  erdos: [18.0, 19.95], jacobian: [20.0, 21.95], percolation: [22.0, 29.4375], navier: [29.6875, 31.875],
  papers: [31.9375, 32.9375], yangmills: [33.0, 33.9375], eth: [34.0, 37.5],
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
  if (b < 1.0) return '2026';
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
