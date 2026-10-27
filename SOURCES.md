# Sources and fact-check

Every on-screen claim was checked before it went into the film (research cut-off: 2026-10-27).
Results from 2026 are shown with the verification status they had at that date. Most were
announced by the labs themselves and were still under independent review.

| # | On screen | Date used | Status shown | Sources |
|---|-----------|-----------|--------------|---------|
| 0 | Shannon, *Programming a Computer for Playing Chess*: ~10^120 games | 1950 | n/a | Shannon, Phil. Mag. 41 (1950) |
| 1 | IBM Deep Blue defeats Kasparov, 3½–2½; ~200M positions/s; board = final position of Game 6 after 19.c4 (score replayed with python-chess) | 1997-05-11 | n/a | IBM; game score of Deep Blue–Kasparov 1997, Game 6 |
| 2 | Google DeepMind AlphaGo defeats Lee Sedol 4–1. The board replays moves 1–37 of Game 2; Move 37 is the fifth-line shoulder hit AlphaGo rated at roughly 1 in 10,000 for a human | 2016-03-15 | n/a | [BGA match report & SGF](https://britgo.org/node/5458) |
| 3 | AlphaProof + AlphaGeometry 2: IMO 2024 silver standard, 28/42 (P1 P2 P4 P6), one point below gold. Problems were hand-translated into Lean, and some took up to 3 days | 2024-07-25 | n/a | Google DeepMind blog, July 2024 |
| 4 | Gemini Deep Think: IMO 2025 gold standard, 35/42, 5 of 6, end-to-end natural language within the 4.5 h limit, graded by IMO coordinators | 2025-07-21 | n/a | Google DeepMind blog, July 2025 |
| 5 | OpenAI internal model disproves the Erdős unit distance conjecture (n^{1+ε} unit distances). Companion paper by external mathematicians (incl. N. Alon, T. Gowers) | 2026-05-20 | Verified by mathematicians | [DAIR summary](https://academy.dair.ai/papers/openai-disproves-the-unit-distance-conjecture), [arXiv 2605.20695](https://arxiv.org/abs/2605.20695), [Quanta](https://www.quantamagazine.org/why-the-legendary-erdos-problems-are-falling-to-ai-20260803/) |
| 6 | Counterexample to the Jacobian conjecture found with Claude (L. Alpöge, Anthropic); dimension 3 and above | 2026-07-19 | Checkable by computer algebra | [ForkLog](https://forklog.com/en/anthropics-claude-fable-5-finds-counterexample-to-1939-jacobian-conjecture/), [Wikipedia](https://en.wikipedia.org/wiki/Jacobian_conjecture), [arXiv 2608.00222](https://arxiv.org/pdf/2608.00222) |
| 7 | Claude-written, Lean-formalized proof that θ(p_c) = 0 for critical percolation in dimensions 3–10 (posted by an Anthropic researcher) | 2026-08-28 | Awaiting human review | [anthropics/formal-math](https://github.com/anthropics/formal-math/tree/795efb86f191735c5481675763537cfb4ff37e55/percolation), [Quanta](https://www.quantamagazine.org/updates/transformation/) |
| 8 | OpenAI announces finite-time blow-up for 3D Navier–Stokes (analytic proof + Lean; ~10,000 agents, 88 h) | 2026-09-08 | Under expert review | [OpenAI on X](https://x.com/OpenAI/status/2097374646148481532), [Tufts Daily](https://www.tuftsdaily.com/article/2026/09/mathematicians-still-checking-the-navier-stokes-proof-that-openai-claims-to-have-solved), [Interesting Engineering](https://interestingengineering.com/ai-robotics/openai-navier-stokes-mystery-solved) |
| 9 | OpenAI releases 722 mathematics manuscripts from an unreleased internal model (~4,000 problems posed) | 2026-10-06 | Still being vetted | [OpenAI community post](https://community.openai.com/t/first-look-at-mathematics-manuscripts-from-an-internal-frontier-model-at-openai/1403886), [Unite.AI](https://www.unite.ai/openai-releases-722-math-manuscripts-from-an-unreleased-ai-model/), [Quanta](https://www.quantamagazine.org/updates/transformation/) |
| 10 | OpenAI claims existence of 4D Yang–Mills / QCD (Balaban program). The mass gap is **not** claimed | 2026-10-26 | Under review | [The Next Web](https://thenextweb.com/news/openai-exponential-time-hypothesis-false-kakeya-yang-mills), [Unite.AI](https://www.unite.ai/openai-says-its-models-produced-three-proofs-in-math-cs-and-physics/) |
| 11 | The Exponential Time Hypothesis is false: OpenAI (announced Oct 26) and Anthropic (*A 2^{o(n)} Time Algorithm for 3-SAT*, Oct 27) independently. Both labs found it on Oct 16; both are Lean-verified | found 2026-10-16 | Independent review underway | [The Next Web](https://thenextweb.com/news/openai-exponential-time-hypothesis-false-kakeya-yang-mills), [OfficeChai](https://officechai.com/ai/anthropic-says-claude-too-independently-disproved-exponential-time-hypothesis-on-the-same-day-as-openai/), [anthropics/formal-math/eth](https://github.com/anthropics/formal-math/tree/16a5ce41304fcdaea4e0be7c132e1c361dc26da5/eth) |

## Notes on choices

* **Yang–Mills date.** The brief said 10.27. OpenAI's post went out on Monday, Oct 26 (US time),
  which is Oct 27 in Asia. The film uses Oct 26.
* **ETH date.** The film shows the discovery date (Oct 16) for both labs as a photo-finish "replay",
  with the announcement dates (Oct 26 / Oct 27) on the card.
* **The curve.** The spine is real data, not an illustration. x is linear calendar time and y is the
  cumulative count of the landmarks above, joined with monotone (PCHIP) interpolation. The hockey stick
  appears because the dates are what they are.
* **The Lean code walls** show the Lean 4 statement of IMO 2024 P1. The tactic lines under it are
  decorative texture, not a checked proof.
* **The Jacobian warp** is an illustrative polynomial deformation. It is not the published counterexample.
* **Percolation** is a real simulation: bond percolation on an 11³ lattice at p = 0.2488 ≈ p_c(ℤ³),
  with clusters found by union-find and coloured by size.
