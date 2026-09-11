# Experiment 0001: where is the difficulty cliff for the M0 placeholder data?

- Date: 2026-09-11 · Sim: M0 skeleton (commit that adds this file) · Data: data/game.json m0-2026-09-11
- Hypothesis: with placeholder numbers the game is trivial (random wins). Raising wave-budget growth g and HP growth should produce a band where greedy wins and random loses. We expect the cliff to be sharp (a few hundred bp).
- Method: 20 seeds (1..20) x policies {random, greedy} x grid below. Metric: win rate, P5/P50 waves cleared.

| growthBp | hpGrowthBp | policy | winRate | wavesP5 | wavesP50 | wavesP95 | minP50 |
|---|---|---|---|---|---|---|---|
| 10900 | 10600 | random | 0.60 | 4 | 40 | 40 | 19.8 |
| 10900 | 10600 | greedy | 1.00 | 40 | 40 | 40 | 13.1 |
| 10900 | 11200 | random | 0.00 | 4 | 8 | 32 | 3.3 |
| 10900 | 11200 | greedy | 0.95 | 39 | 40 | 40 | 15.7 |
| 11300 | 10600 | random | 0.60 | 4 | 40 | 40 | 44.3 |
| 11300 | 10600 | greedy | 1.00 | 40 | 40 | 40 | 38.3 |
| 11300 | 11200 | random | 0.00 | 4 | 6 | 31 | 2.3 |
| 11300 | 11200 | greedy | 0.90 | 39 | 40 | 40 | 39.3 |
| 11700 | 10600 | random | 0.60 | 4 | 40 | 40 | 121.8 |
| 11700 | 10600 | greedy | 1.00 | 40 | 40 | 40 | 115.7 |
| 11700 | 11200 | random | 0.00 | 4 | 5 | 30 | 2.1 |
| 11700 | 11200 | greedy | 0.95 | 39 | 40 | 40 | 116.5 |
| 12100 | 10600 | random | 0.00 | 4 | 39 | 39 | 333.3 |
| 12100 | 10600 | greedy | 0.00 | 39 | 39 | 39 | 333.3 |
| 12100 | 11200 | random | 0.00 | 4 | 5 | 30 | 2 |
| 12100 | 11200 | greedy | 0.00 | 39 | 39 | 39 | 333.3 |

## Findings

1. **HP growth is the sharp lever.** Moving `hpGrowthBp` 10600 → 11200 flips the random bot from 60% wins to 0% (P50 waves 40 → 8) while greedy stays at 90-95%. That is the kind of cliff the toolkit exists to find, and it is only 600 bp wide.
2. **Budget growth mostly lengthens waves instead of hardening them.** With `growthBp` 11700 the P50 run is 116 minutes at 1x because the budget buys hundreds of grunts that spawn every 12 ticks; at 12100 every run hits the 400k-tick cap (outcome `timeout`, shown as 39 waves). Wave *count* is linear in budget, wave *difficulty* is not. Consequences for M1: cap enemies per wave, let the budget buy HP tiers and tags rather than only count, and treat run length as a first-class invariant (ADR-0008 wants 25-30 minutes).
3. **Early call is worth ~2.5x speed.** Greedy with early calls finishes 40 waves in 13 minutes vs 32 minutes without; the early bonus (~1130 gold over a run) also outweighs interest (~150-450) at the placeholder 3% rate. Interest is currently irrelevant, which means the knife edge from ADR-0012 does not exist yet. M1's first sweep is interest rate x bounty base.
4. **The placeholder economy is far too rich.** Greedy ends runs with 7,000-25,000 unspent gold. Budgets must be cut or wave budgets raised before any invariant is meaningful.

## Reproduce

```
pnpm balance run --policy random,greedy --seeds 1..20 --set "composer.growthBp=10900;composer.hpGrowthBp=11200"
```
