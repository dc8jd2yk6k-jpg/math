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

// bar: output bar at which the milestone "hits" (beat-locked reveal)
// n:   cumulative index -> y coordinate of the spine (honest: the curve is
//      literally "landmark results vs. linear calendar time")
export const MILESTONES = [
  {
    id: 'shannon', bar: 0.0, n: 0, date: [1950, 3, 1], team: 'SHANNON', short: 'SHANNON',
    era: 0,
    card: {
      kicker: '1950 · CLAUDE SHANNON', title: 'PROGRAMMING A COMPUTER FOR PLAYING CHESS',
      sub: 'The game tree is too large to search: about 10^{120} possible games.',
      chips: ['10^{120} GAMES'],
    },
    prelude: true,
  },
  {
    id: 'deepblue', bar: 2, n: 1, date: [1997, 5, 11], team: 'IBM', short: 'DEEP BLUE',
    era: 1,
    card: {
      title: 'DEEP BLUE DEFEATS KASPAROV',
      sub: 'Brute-force search and hand-tuned evaluation. Game 6, final position.',
      chips: ['200,000,000 POSITIONS / S', 'MATCH 3½ – 2½'],
    },
  },
  {
    id: 'alphago', bar: 6, n: 2, date: [2016, 3, 15], team: 'GDM', short: 'ALPHAGO',
    era: 1,
    card: {
      title: 'ALPHAGO DEFEATS LEE SEDOL 4 – 1',
      sub: 'Deep neural networks and reinforcement learning, guiding tree search.',
      chips: ['~10^{170} LEGAL POSITIONS', 'GAME 2 · MOVE 37'],
    },
  },
  {
    id: 'imo24', bar: 10, n: 3, date: [2024, 7, 25], team: 'GDM', short: 'ALPHAPROOF',
    era: 2,
    card: {
      title: 'IMO · SILVER-MEDAL STANDARD',
      sub: 'AlphaProof + AlphaGeometry 2 solve 4 of 6 problems.',
      chips: ['28 / 42', '1 POINT BELOW GOLD'],
      constraints: ['PROBLEMS HAND-TRANSLATED INTO LEAN', 'UP TO 3 DAYS OF COMPUTE PER PROBLEM'],
    },
  },
  {
    id: 'imo25', bar: 14, n: 4, date: [2025, 7, 21], team: 'GDM', short: 'GEMINI DEEP THINK',
    era: 2,
    card: {
      title: 'IMO · GOLD-MEDAL STANDARD',
      sub: 'Gemini Deep Think: end-to-end in natural language, officially graded.',
      chips: ['35 / 42', '5 OF 6 SOLVED', 'WITHIN 4.5 HOURS'],
    },
  },
  {
    id: 'erdos', bar: 16, n: 5, date: [2026, 5, 20], team: 'OAI', short: 'ERDŐS UNIT DIST.',
    era: 3,
    card: {
      title: 'ERDŐS UNIT DISTANCE CONJECTURE DISPROVED',
      sub: 'Point sets with n^{1+ε} unit distances. Open since 1946.',
      formula: 'u(n) ≥ n^{1+ε}',
      chips: ['OPEN 80 YEARS'],
      status: 'VERIFIED BY MATHEMATICIANS · COMPANION PAPER',
    },
  },
  {
    id: 'jacobian', bar: 18, n: 6, date: [2026, 7, 19], team: 'ANT', short: 'JACOBIAN',
    era: 3,
    card: {
      title: 'JACOBIAN CONJECTURE: COUNTEREXAMPLE',
      sub: 'Found with Claude: a polynomial map of ℂ^{3} with constant Jacobian that is not invertible.',
      formula: 'det J_{F} ≡ c ≠ 0,   F(a) = F(b) = F(c)',
      chips: ['OPEN SINCE 1939', 'DIMENSIONS ≥ 3'],
      status: 'CHECKABLE BY COMPUTER ALGEBRA',
    },
  },
  {
    id: 'percolation', bar: 20, n: 7, date: [2026, 8, 28], team: 'ANT', short: 'PERCOLATION',
    era: 3,
    card: {
      title: 'CRITICAL PERCOLATION HAS NO INFINITE CLUSTER',
      sub: 'A Claude-written proof that θ(p_{c}) = 0 in dimensions 3 to 10.',
      formula: 'θ(p_{c}) = 0',
      chips: ['LEAN 4 FORMALIZATION'],
      status: 'AWAITING HUMAN REVIEW',
    },
  },
  {
    id: 'navier', bar: 22, n: 8, date: [2026, 9, 8], team: 'OAI', short: 'NAVIER–STOKES',
    era: 3,
    card: {
      title: 'NAVIER–STOKES: FINITE-TIME BLOW-UP',
      sub: 'Claimed: a smooth 3D incompressible flow that forms a singularity.',
      formula: '∂_{t}u + (u·∇)u = −∇p + νΔu',
      chips: ['10,000 AGENTS · 88 HOURS', 'MILLENNIUM PROBLEM'],
      status: 'LEAN-FORMALIZED · UNDER EXPERT REVIEW',
    },
  },
  {
    id: 'papers', bar: 23, n: 9, date: [2026, 10, 6], team: 'OAI', short: '722 MANUSCRIPTS',
    era: 3,
    card: {
      title: '722 MANUSCRIPTS. ONE RELEASE.',
      sub: 'Research papers from an unreleased internal model, posted at once.',
      chips: ['~4,000 PROBLEMS POSED'],
      status: 'MATHEMATICIANS STILL VETTING',
    },
  },
  {
    id: 'yangmills', bar: 24, n: 10, date: [2026, 10, 26], team: 'OAI', short: 'YANG–MILLS',
    era: 3,
    card: {
      title: '4D YANG–MILLS: EXISTENCE',
      sub: 'Claimed rigorous construction of 4D Yang–Mills and QCD. Mass gap not claimed.',
      formula: 'S = ¼g^{−2} ∫ tr F_{μν}F^{μν} d^{4}x',
      chips: ['MILLENNIUM PROBLEM (PART)'],
      status: 'UNDER REVIEW',
    },
  },
  {
    id: 'eth', bar: 26, n: 11, date: [2026, 10, 27], team: 'OAI', team2: 'ANT', short: 'ETH FALLS',
    era: 4,
    found: [2026, 10, 16],
    card: {
      title: 'THE EXPONENTIAL TIME HYPOTHESIS IS FALSE',
      sub: 'Two rival labs, independently: a 2^{o(n)}-time algorithm for 3-SAT.',
      formula: '3-SAT ∈ TIME(2^{o(n)})',
      chips: ['BOTH FOUND OCT 16', 'OPENAI · OCT 26', 'ANTHROPIC · OCT 27'],
      status: 'LEAN-VERIFIED · INDEPENDENT REVIEW UNDERWAY',
    },
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

export function fmtGap(days) {
  if (days === null || days === undefined) return '';
  if (days === 0) return '+0 DAYS';
  if (days >= 700) return `+${(days / 365.25).toFixed(1)} YRS`;
  return `+${days} DAYS`;
}

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
