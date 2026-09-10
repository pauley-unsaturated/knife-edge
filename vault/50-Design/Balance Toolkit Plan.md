---
id: 17B8AECD-3A20-461D-B7E4-4D59BEB13610
created: 2026-09-10T05:50:46Z
modified: 2026-09-10T05:50:46Z
tags: [design, stratum-5, balancing, tooling]
---
# Balance Toolkit Plan

*Stratum 5. Living document. The concrete plan for the "knife edge" tooling, derived from [[Research - Balancing Tooling]] and shaped to fit whichever of [[Concept A]] / [[Concept B]] / [[Concept C]] wins branch B4.*

## Principle

**Difficulty is a measured fraction of a solver's ceiling, not a feeling.** Every wave has two computable curves: what a par player *can* afford, and the *cheapest* defense that clears the wave. The design sets the gap between them. The toolkit computes both, sweeps the tunables that move them, and pins the result in CI.

## Core invariants (checked per wave, per seed batch)

```
Budget(n)         = start + sum_{k<n} (bounties_k + wave_bonus_k + interest_k + early_call_k)
MinDefenseCost(n) = min cost of a placement whose integral(DPS * time_in_range) >= EHP(n) * (1 + leak_tolerance)
Margin(n)         = Budget(n) / MinDefenseCost(n) - 1
```

Targets are a **band** per wave, e.g. margin 10-15% on waves 1-5, narrowing to 3-6% by wave 20, and negative-but-recoverable on boss waves (you take leaks but the run survives). The band *is* the difficulty setting; mutators and difficulty tiers move the band, never the enemy stats directly.

## Bot ladder (difficulty ruler)

| Policy | Purpose |
|---|---|
| `random` | Floor. Must lose early (<5% clear at wave 8). |
| `greedy` | DPS-per-gold with range weighting; buys at wave start. The par player. |
| `greedy-k` | Greedy with k forced suboptimal purchases. Calibrates forgiveness: "wave 12 clears with k<=3 at >=95% of seeds." |
| `beam` | Beam search over build orders (btd6-farm-optimizer pattern). Estimates the ceiling. |
| `interest-greedy` | Delays purchases to compound; the knife-edge exploit finder. Must not dominate `greedy` by more than the designed edge. |
| `fuzzer` | Evolutionary search over policy genomes for overpowered lines (spirefall pattern). Finds become pinned regression seeds. |

## Sweeps and reports

- Two-parameter grids (HP growth x interest; tower cost multiplier x wave bonus; for Concept C, heat rate x jackpot) with clear-rate heatmaps and an acceptance band; look for cliffs (boundary discovery, Mukai et al. 2026).
- Per-wave chart: Budget vs MinDefenseCost with the margin band shaded.
- Distribution, not mean: P5 / P50 / P95 wave reached per 200-seed batch; the P5 must satisfy the invariant.
- Sensitivity: each tunable perturbed +-5% must not flip a wave's pass/fail; if it does, that tunable is a knife edge by accident and gets documented or damped.

## Data model

- All tunables live in versioned data files (`data/towers.csv`, `data/enemies.csv`, `data/economy.json`, `data/waves.json`), schema-validated on load. A sheet can export to them; the repo is the source of truth.
- A run is `(data version, seed, command list)`. Replays, saves, bots and tests are one mechanism.

## CI gates

1. Determinism: same seed twice yields identical state hashes across Node versions.
2. Golden runs: hash per (map, seed, policy) must match unless a data file changed in the same commit.
3. Invariant suite: margin bands hold for every wave in the shipped wave tables.
4. Pinned exploits: every fuzzer find keeps failing.
5. Nightly sweep artifact: heatmaps and P5/P50/P95 tables published as CI artifacts.

## Milestones

- **M0 (next pass):** sim skeleton, PRNG, fixed-point, one tower, one enemy, one map generator, `random` and `greedy` bots, determinism + golden tests. No renderer.
- **M1:** full tower/enemy tables for the chosen concept, `greedy-k`, `interest-greedy`, per-wave invariant report, first sweep.
- **M2:** `beam` ceiling estimate, fuzzer, pinned exploits, nightly CI.
- **M3:** placeholder renderer wired to the same sim; humans play what the bots play; telemetry from playtests compared to bot ladder (Slay the Spire style pick-rate and damage-taken logs).

## Concept-specific notes

- Concept A: the solver must model wall-piece draws and enclosure; income is area, so `Budget(n)` depends on the bot's building skill. Use `greedy-enclosure` as the par policy.
- Concept B: cleanest fit. Interest math is closed-form; mazing bots are well-studied (Desktop TD lineage).
- Concept C: no discrete waves. Simulate whole blocks; the policy is a raid schedule; invariants are expressed over time windows instead of wave indices.
