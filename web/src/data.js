// The narrative payload. Every date and number here was checked against
// primary or major secondary sources (see SOURCES.md). Frontier results from
// 2026 are labelled with their verification status, because most were still
// under independent review when this film was made (2026-10-27).

export function decimalYear(y, m, d) {
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return y + (Date.UTC(y, m - 1, d, 12) - start) / (end - start);
}

export function daysBetween(a, b) {
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
}

// bar:  output bar at which the milestone "hits" (beat-locked reveal)
// n:    cumulative index -> y coordinate of the line (honest: the curve is
//       literally "landmark results vs. linear calendar time")
// head: the three-line header — date shown, title, one-line caption
export const MILESTONES = [
  {
    id: 'shannon', bar: 1, n: 0, date: [1950, 3, 1], team: 'SHANNON', short: 'Shannon',
    head: { date: '1950', title: 'Claude Shannon', caption: 'Chess has about 10^{120} possible games. Far too many to search.' },
  },
  {
    id: 'deepblue', bar: 2, n: 1, date: [1997, 5, 11], team: 'IBM', short: 'Deep Blue',
    head: { date: '1997', title: 'Deep Blue', caption: 'A computer beats the world chess champion, by brute-force search.' },
  },
  {
    id: 'alphago', bar: 6, n: 2, date: [2016, 3, 15], team: 'GDM', short: 'AlphaGo',
    head: { date: '2016', title: 'AlphaGo', caption: 'Beats Lee Sedol 4–1. Move 37 stuns the Go world.' },
  },
  {
    id: 'imo24', bar: 10, n: 3, date: [2024, 7, 25], team: 'GDM', short: 'IMO Silver',
    head: { date: '2024.07', title: 'IMO · Silver', caption: '4 of 6 solved, hand-translated into Lean, up to 3 days each.' },
  },
  {
    id: 'imo25', bar: 14, n: 4, date: [2025, 7, 21], team: 'GDM', short: 'IMO Gold',
    head: { date: '2025.07', title: 'IMO · Gold', caption: 'Gemini Deep Think: 35/42 in natural language, within 4.5 hours.' },
  },
  {
    id: 'erdos', bar: 16, n: 5, date: [2026, 5, 20], team: 'OAI', short: 'Erdős',
    head: { date: '2026.05', title: 'Erdős Unit Distances', caption: 'An OpenAI model disproves an 80-year-old conjecture.' },
  },
  {
    id: 'jacobian', bar: 18, n: 6, date: [2026, 7, 19], team: 'ANT', short: 'Jacobian',
    head: { date: '2026.07', title: 'Jacobian Conjecture', caption: 'Claude helps find a counterexample, in 3 dimensions and up.' },
  },
  {
    id: 'percolation', bar: 20, n: 7, date: [2026, 8, 28], team: 'ANT', short: 'Percolation',
    head: { date: '2026.08', title: 'Critical Percolation', caption: 'A Claude-written Lean proof: θ(p_{c}) = 0 in dimensions 3 to 10.' },
  },
  {
    id: 'navier', bar: 22, n: 8, date: [2026, 9, 8], team: 'OAI', short: 'Navier–Stokes',
    head: { date: '2026.09.08', title: 'Navier–Stokes', caption: 'OpenAI claims a finite-time blow-up. Under expert review.' },
  },
  {
    id: 'papers', bar: 23, n: 9, date: [2026, 10, 6], team: 'OAI', short: '722 papers',
    head: { date: '2026.10.06', title: '722 Manuscripts', caption: 'Released at once by OpenAI, from an unreleased model.' },
  },
  {
    id: 'yangmills', bar: 24, n: 10, date: [2026, 10, 26], team: 'OAI', short: 'Yang–Mills',
    head: { date: '2026.10.26', title: '4D Yang–Mills', caption: 'OpenAI claims existence. The mass gap is not claimed.' },
  },
  {
    id: 'eth', bar: 26, n: 11, date: [2026, 10, 27], team: 'OAI', team2: 'ANT', short: 'ETH',
    found: [2026, 10, 16],
    head: { date: '2026.10.16', title: 'Exponential Time Hypothesis', caption: 'Refuted by two labs, independently, on the same day.' },
  },
];

export const BY_ID = Object.fromEntries(MILESTONES.map((m) => [m.id, m]));

// Gap to the previous milestone (Δt) — the quantity the film is about.
for (let i = 1; i < MILESTONES.length; i++) {
  const m = MILESTONES[i];
  const prev = MILESTONES[i - 1];
  m.gapDays = m.found ? 0 : daysBetween(prev.date, m.date);   // ETH: both labs found it the same day
}
MILESTONES[0].gapDays = null;

export function fmtDate(d) {
  return `${d[0]}.${String(d[1]).padStart(2, '0')}.${String(d[2]).padStart(2, '0')}`;
}

// Deep Blue vs Kasparov, Game 6 (1997-05-11), position after 19.c4 1-0.
// Verified by replaying the score with python-chess.
export const CHESS_FEN = 'r1k4r/p2nb1p1/2b4p/1p1n1p2/2PP4/3Q1NB1/1P3PPP/R5K1';

// AlphaGo (B) vs Lee Sedol (W), Game 2 (2016-03-10), moves 1-37.
// From the British Go Association record. Move 37 = the 5th-line shoulder hit.
export const GO_MOVES = [['B',15,3],['W',3,15],['B',2,3],['W',16,15],['B',14,15],['W',14,16],['B',13,16],['W',15,16],['B',2,13],['W',5,16],['B',12,15],['W',16,13],['B',8,2],['W',3,9],['B',15,14],['W',16,14],['B',2,15],['W',2,16],['B',1,16],['W',2,14],['B',1,15],['W',1,14],['B',3,14],['W',1,13],['B',3,16],['W',4,15],['B',3,17],['W',2,12],['B',9,15],['W',2,6],['B',4,3],['W',16,5],['B',16,4],['W',15,5],['B',13,3],['W',15,8],['B',14,9]];

// IMO 2024 (AlphaProof/AlphaGeometry 2) and 2025 (Gemini Deep Think) per-problem results
export const IMO24 = [7, 7, 0, 7, 0, 7];   // P1 P2 P4 P6 solved (P3, P5 combinatorics unsolved)
export const IMO25 = [7, 7, 7, 7, 7, 0];   // P1-P5 solved

// Lean 4 statement of IMO 2024 Problem 1 (answer: α is an even integer).
// The tactic lines below the statement are decorative texture for the code walls, not a checked proof.
export const LEAN_SNIPPET = [
  'theorem imo2024_p1 :',
  '    {α : ℝ | ∀ n : ℕ, 0 < n →',
  '      (n : ℤ) ∣ ∑ i ∈ Finset.Icc 1 n, ⌊i * α⌋}',
  '    = {α : ℝ | ∃ k : ℤ, Even k ∧ α = k} := by',
  '  ext α',
  '  constructor',
  '  · intro h',
  '    obtain ⟨m, hm⟩ := h 1 one_pos',
  '    have h2 := h 2 two_pos',
  '    simp [Finset.sum_Icc_succ_top] at h2',
  '    rcases Int.even_or_odd ⌊α⌋ with he | ho',
  '    · refine ⟨⌊α⌋, he, ?_⟩',
  '      nlinarith [Int.floor_le α, Int.lt_floor_add_one α]',
  '    · exfalso',
  '      omega',
  '  · rintro ⟨k, ⟨j, rfl⟩, rfl⟩ n hn',
  '    induction n with',
  '    | zero => simp',
  '    | succ n ih =>',
  '      rw [Finset.sum_Icc_succ_top (by omega)]',
  '      push_cast',
  '      ring_nf',
  '      exact dvd_add ih (by norm_num)',
];
