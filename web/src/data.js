// The story. Every date, number and status below was checked on 2026-10-27
// (see SOURCES.md). Results from 2026 carry the review status they had then.

export function decimalYear(y, m = 7, d = 1) {
  const a = Date.UTC(y, 0, 1), z = Date.UTC(y + 1, 0, 1);
  return y + (Date.UTC(y, m - 1, d, 12) - a) / (z - a);
}

// y: height of the milestone on the curve (world units). x is linear calendar
// time; y is a stylized capability axis that grows roughly geometrically with
// each landmark, so the 2026 results stack up a near-vertical wall.
// date: the date shown in the header (precision = what is shown).
export const MILESTONES = [
  {
    id: 'shannon', at: [1950, 3, 1], date: '1950', y: 0, lab: 'Shannon',
    title: 'Claude Shannon', caption: 'Programming a Computer for Playing Chess: about 10^{120} games.',
  },
  {
    id: 'deepblue', at: [1997, 5, 11], date: '1997', y: 12, lab: 'IBM',
    title: 'Deep Blue', caption: 'Beats Kasparov 3½–2½ by brute force: 200 million positions a second.',
  },
  {
    id: 'alphago', at: [2016, 3, 10], date: '2016', y: 40, lab: 'Google DeepMind',
    title: 'AlphaGo', caption: 'Beats Lee Sedol 4–1. Move 37 was a move no human would play.',
  },
  {
    id: 'imo24', at: [2024, 7, 25], date: '2024.07', y: 85, lab: 'Google DeepMind',
    title: 'IMO · Silver', caption: 'AlphaProof: 28/42. Hand-translated into Lean, up to 3 days a problem.',
  },
  {
    id: 'imo25', at: [2025, 7, 21], date: '2025.07', y: 150, lab: 'Google DeepMind',
    title: 'IMO · Gold', caption: 'Gemini Deep Think: 35/42 in plain language, inside the 4.5-hour limit.',
  },
  {
    id: 'erdos', at: [2026, 5, 20], date: '2026.05', y: 215, lab: 'OpenAI',
    title: 'Erdős Unit Distances', caption: 'An OpenAI model disproves the 1946 conjecture: n^{1+δ} unit distances.',
  },
  {
    id: 'jacobian', at: [2026, 7, 20], date: '2026.07', y: 300, lab: 'Claude · L. Alpöge',
    title: 'Jacobian Conjecture', caption: 'Found with Claude: det J = −2, yet three points map to one.',
  },
  {
    id: 'percolation', at: [2026, 8, 28], date: '2026.08', y: 410, lab: 'Claude',
    title: 'Critical Percolation', caption: 'A Claude-written Lean proof: no infinite cluster at p_{c}, in 3 to 10 dimensions.',
  },
  {
    id: 'navier', at: [2026, 9, 8], date: '2026.09.08', y: 550, lab: 'OpenAI',
    title: 'Navier–Stokes', caption: 'OpenAI: smooth 3D flow can blow up in finite time. Under review.',
  },
  {
    id: 'papers', at: [2026, 10, 6], date: '2026.10.06', y: 730, lab: 'OpenAI',
    title: '722 Manuscripts', caption: 'Released at once by OpenAI, from about 4,000 problems posed.',
  },
  {
    id: 'yangmills', at: [2026, 10, 26], date: '2026.10.26', y: 960, lab: 'OpenAI',
    title: '4D Yang–Mills', caption: 'OpenAI claims the theory exists. The mass gap is not claimed.',
  },
  {
    id: 'eth', at: [2026, 10, 27], date: '2026.10.27', y: 1250, lab: 'OpenAI · Anthropic',
    title: 'Exponential Time Hypothesis', caption: 'OpenAI and Anthropic refute it independently, hours apart.',
  },
];

export const BY_ID = Object.fromEntries(MILESTONES.map((m, i) => [m.id, Object.assign(m, { i })]));
for (const m of MILESTONES) m.year = decimalYear(...m.at);

// Deep Blue vs Kasparov, Game 6, 1997-05-11: final position after 19.c4, 1-0.
// (Replayed from the game score with python-chess; see SOURCES.md.)
export const CHESS_FEN = 'r1k4r/p2nb1p1/2b4p/1p1n1p2/2PP4/3Q1NB1/1P3PPP/R5K1';

// AlphaGo (Black) vs Lee Sedol (White), Game 2, 2016-03-10, moves 1-37
// [colour, column 0-18 from the left, row 0-18 from the top]. Move 37 is the
// fifth-line shoulder hit.
export const GO_MOVES = [['B',15,3],['W',3,15],['B',2,3],['W',16,15],['B',14,15],['W',14,16],['B',13,16],['W',15,16],['B',2,13],['W',5,16],['B',12,15],['W',16,13],['B',8,2],['W',3,9],['B',15,14],['W',16,14],['B',2,15],['W',2,16],['B',1,16],['W',2,14],['B',1,15],['W',1,14],['B',3,14],['W',1,13],['B',3,16],['W',4,15],['B',3,17],['W',2,12],['B',9,15],['W',2,6],['B',4,3],['W',16,5],['B',16,4],['W',15,5],['B',13,3],['W',15,8],['B',14,9]];

// IMO 2024 P1 (solved by AlphaProof). Lean 4 statement; answer: α is an even integer.
export const LEAN_P1 = [
  'theorem imo2024_p1 (α : ℝ) :',
  '    (∀ n : ℕ, 0 < n →',
  '      (n : ℤ) ∣ ∑ i ∈ Finset.Icc 1 n, ⌊i * α⌋)',
  '    ↔ ∃ k : ℤ, Even k ∧ α = k := by',
];
// per-problem points: 2024 (AlphaProof + AlphaGeometry 2) and 2025 (Gemini Deep Think)
export const IMO24 = [7, 7, 0, 7, 0, 7];
export const IMO25 = [7, 7, 7, 7, 7, 0];

// Alpöge's counterexample to the Jacobian conjecture (dimension 3).
// det J ≡ −2, and F(0,0,−1/4) = F(1,−3/2,13/2) = F(−1,3/2,13/2) = (−1/4,0,0).
export function jacobianF(x, y, z) {
  const u = 1 + x * y, v = 4 + 3 * x * y;
  return [u * u * u * z + y * y * u * v, y + 3 * x * u * u * z + 3 * x * y * y * v, 2 * x - 3 * x * x * y - x * x * x * z];
}
export const JACOBIAN_COLLIDE = [[0, 0, -0.25], [1, -1.5, 6.5], [-1, 1.5, 6.5]];
