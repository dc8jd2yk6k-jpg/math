# Sources and fact-check

Every on-screen claim was checked on **2026-10-27**, the date the film is set. The 2026 results are
shown with the review status they had on that day. Most were announced by the labs themselves and
had not yet been independently verified.

| On screen | Date | What the film says | Status shown | Sources |
|---|---|---|---|---|
| Claude Shannon | 1950-03 | *Programming a Computer for Playing Chess*: about 10^120 possible games | — | C. E. Shannon, *Philosophical Magazine* 41 (314), 1950 |
| Deep Blue | 1997-05-11 | Beats Kasparov 3½–2½ with brute-force search at 200 million positions per second. The board shows the final position of Game 6 (after 19.c4, Kasparov resigned), replayed from the game score with python-chess | — | [IBM: Deep Blue](https://www.ibm.com/history/deep-blue) |
| AlphaGo | 2016-03 | Beats Lee Sedol 4–1. The board replays Game 2, moves 1–37. Move 37 is the fifth-line shoulder hit that AlphaGo itself estimated a human would play about 1 time in 10,000 | — | [Google DeepMind: AlphaGo](https://deepmind.google/research/breakthroughs/alphago/) |
| IMO · Silver | 2024-07 | AlphaProof + AlphaGeometry 2: P1 P2 P4 P6 solved, 28/42, one point below the gold threshold. The problems were hand-translated into Lean, and some took up to three days. The card types the Lean 4 statement of Problem 1 | — | [Google DeepMind, 25 Jul 2024](https://deepmind.google/discover/blog/ai-solves-imo-problems-at-silver-medal-level/) |
| IMO · Gold | 2025-07 | Gemini Deep Think: 35/42 (P1–P5), end to end in natural language, within the 4.5-hour limit. The figure is Problem 2, constructed exactly; the tangency holds to ~1e-15 | — | [Google DeepMind, 21 Jul 2025](https://deepmind.google/discover/blog/advanced-version-of-gemini-with-deep-think-officially-achieves-gold-medal-standard-at-the-international-mathematical-olympiad/), [AoPS: 2025 IMO P2](https://artofproblemsolving.com/wiki/index.php/2025_IMO_Problems/Problem_2) |
| Erdős unit distances | 2026-05-20 | An OpenAI model disproves Erdős's 1946 unit distance conjecture: infinitely many n with n^{1+δ} unit distances. The figure shows Erdős's own grid construction, which the new family beats | Checked by external mathematicians | [OpenAI](https://openai.com/index/model-disproves-discrete-geometry-conjecture/), [AIhub](https://aihub.org/2026/06/02/an-ai-solution-to-an-80-year-old-problem-has-shocked-mathematicians/) |
| Jacobian conjecture | 2026-07-20 | Found with Claude (L. Alpöge): a polynomial map of ℂ³ with Jacobian determinant −2 that sends three points to one, so the conjecture fails in dimension 3 and up. **The film uses the real map**: F(0,0,−1/4) = F(1,−3/2,13/2) = F(−1,3/2,13/2) = (−1/4,0,0), det J ≡ −2 (checked in this repo) | Identities checked by many people; not yet peer-reviewed | [arXiv 2608.00222](https://arxiv.org/pdf/2608.00222), [Mezha](https://mezha.ua/en/news/shi-proti-87-rokiv-matematiki-claude-fable-5-dopomig-sprostuvati-matematichnu-gipotezu-z-1939-roku-313451/), [Win-Vector](https://win-vector.com/2026/07/23/maybe-jacobian-conjecture-counterexamples-are-not-rare/) |
| Critical percolation | 2026-08-28 | A Claude-written, Lean-formalized proof that θ(p_c) = 0 (no infinite cluster at criticality) in dimensions 3 to 10, posted by an Anthropic researcher | Awaiting independent review | [Quanta](https://www.quantamagazine.org/update/167555/), [Pillitteri](https://pasqualepillitteri.it/en/news/19787/claude-solves-percolation-conjecture) |
| Navier–Stokes | 2026-09-08 | OpenAI claims smooth 3D flow can blow up in finite time, for the forced equations, with a Lean formalization (about 10,000 agents, 88 hours) | Under expert review; disputed | [Unite.AI](https://unite.ai/openai-says-internal-ai-system-resolved-the-navier-stokes-problem), [Let's Data Science](https://letsdatascience.com/news/openai-publishes-proposed-navier-stokes-singularity-proof-83719c42) |
| 722 manuscripts | 2026-10-06 | OpenAI releases 722 mathematics manuscripts from an unreleased model, from about 4,000 problems posed | Being vetted; three were withdrawn on Oct 7 | [Interesting Engineering](https://interestingengineering.com/ai-robotics/openai-largest-math-release-lean-proofs), [AI Weekly](https://aiweekly.co/alerts/openai-publishes-722-ai-generated-math-manuscripts-on-github) |
| 4D Yang–Mills | 2026-10-26 | OpenAI claims existence of 4D Yang–Mills (and QCD). The mass gap is **not** claimed | Private review (group led by D. Gross) | [MindStudio](https://www.mindstudio.ai/blog/openai-ai-discoveries-math-physics-cs), [Tech Insider](https://tech-insider.org/openai-three-science-discoveries-eth-kakeya-qcd-2026/) |
| Exponential Time Hypothesis | 2026-10-26 / 27 | OpenAI (Oct 26) and Anthropic (*A 2^{o(n)} Time Algorithm for 3-SAT*, Oct 27) refute ETH independently, hours apart. Both say the algorithm was found on Oct 16; both are Lean-checked | Under expert review | [OfficeChai](https://officechai.com/ai/anthropic-says-claude-too-independently-disproved-exponential-time-hypothesis-on-the-same-day-as-openai/), [anthropics/formal-math/eth](https://github.com/anthropics/formal-math/tree/16a5ce41304fcdaea4e0be7c132e1c361dc26da5/eth), [FourWeekMBA](https://fourweekmba.com/ai-openai-says-its-ai-refuted-the-exponential-time-hypothesis/) |

## Notes on choices

* **Yang–Mills date.** The brief said 10.27. OpenAI's post went out on Oct 26 (US time), so the film
  uses 2026.10.26. Anthropic's ETH paper followed on Oct 27, so the climax lands on 2026.10.27.
* **The curve.** x is linear calendar time. y is a stylized "capability" axis: one step per
  milestone, growing geometrically, joined by monotone PCHIP. No y values are shown. The bend from
  flat to vertical comes from the dates themselves: 47 years between the first two milestones, five
  months between the last seven.
* **Percolation island.** The terrain is a stage (value noise). The "trees" are the real thing:
  site percolation on ℤ³ at p_c ≈ 0.3116 in a 16-voxel slab, with clusters found by union-find.
  Only clusters rooted on the ground are kept, and the largest is lit gold. Every cluster ends.
* **Erdős figure.** The figure is Erdős's 1946 grid construction (a 15 × 15 grid, unit = 5, which is
  3-4-5 in four ways), not the 2026 construction, which lifts the same idea to higher-degree
  number fields. The caption says the grid was beaten.
* **Jacobian figure.** The grid flows from p to F(p) under the real map. It is drawn through a radial
  squash so the map's degree-7 growth stays on screen. The three points meet exactly.
* **Navier–Stokes, Yang–Mills, ETH tree.** These are illustrations of the objects involved: a
  vortex tube that concentrates and bursts, a 4D hypercubic lattice, and a 2^n search tree. They
  are not depictions of the proofs.
