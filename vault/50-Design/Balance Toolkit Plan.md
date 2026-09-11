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

## Fast-forward and the human-validated pipeline (added 2026-09-11)

Per [[ADR-0007-real-time-with-speed-control]] and constraint C9 in [[Constraints]]:

- **One step function, three clocks.** The sim exposes `step(state, commands)` for one fixed tick. Node runs it in a tight loop at unbounded speed for the agent swarm. The browser runs it at 1x/2x/4x for play and at an "instant" setting (step until wave end, then render) for human validation. Nothing in the sim reads wall-clock time.
- **Bot claims are replays.** Every bot run writes `(data version, seed, command list)`. A human loads that file in the browser and watches it at 1x, or scrubs it. If the replay does not match the bot's reported outcome, the pipeline is broken, not the design. This is the acceptance test for the toolkit itself.
- **Human calibration of the ruler.** Before the bot ladder is trusted, the human plays a fixed set of seeds and the toolkit records their command lists. The `greedy` policy is tuned until its wave-reached distribution brackets the human's, so "par" is anchored to a real player, not to a heuristic.
- **Scientific hygiene.** Every sweep is a versioned experiment: data version, sim commit, seed batch, policy set, and hypothesis recorded in `experiments/` with the results JSONL. Reports show confidence intervals, never bare means. A change to the design must state which invariant it expects to move and by how much before the sweep runs.
- **Swarm-friendly.** Sweeps shard by seed range; each shard is a stateless CLI invocation, so many agents can run partitions in parallel and a reducer merges JSONL. Results are reproducible from the manifest alone.

## Weapon-system hyperparameters and the god-run metric (added 2026-09-11)

Per [[ADR-0013-wave-composer-and-towers]], these are the M1 sweep targets. Each is a field in `data/economy.json` or `data/towers.csv`, never a literal in code.

| Symbol | Meaning | First sweep range |
|---|---|---|
| `g` | wave budget growth per wave | 1.06 - 1.14 |
| `i0`, `i_step` | starting interest rate and per-offer increment | 0 - 5%, 1 - 3% |
| `L` | ladder length (levels per tower) | 4 - 10 |
| `u` | upgrade-vs-spread efficiency premium | -10% to +25% |
| `m` | damage-type matrix strength (match multiplier, mismatch divisor) | 1.0 - 2.5 |
| `r` | range-vs-damage exchange rate on the cost curve | to be derived from Doucet's range-dominance observation |
| `relic_response` | how much the composer counters relic power | 0 - 1 |
| per type: `costGrowthBp`, `damageGrowthBp`, `rangeGrowthBp` | the ladder curves; their shapes set each type's upgrade-vs-build-out crossover | 1.3x - 1.8x per level |
| per type: `adjacencyBonusBp` | build-out synergy: damage bonus per adjacent same-type tower | 0 - 25% |

**God-run metric.** For each run, relic power `P = product of stacked relic multipliers, normalised`. A run is a god run when `Margin(n)` exceeds a threshold (start at +40%) for at least 25% of remaining waves. Report the god-run rate per seed batch and per policy. Target band at par play: 5-10%. Below the band, relics are too weak to be exciting; above it, the knife edge is fiction. The zero-relic baseline must still satisfy the per-wave invariant on its own.

## Bot ladder (difficulty ruler)

| Policy | Purpose |
|---|---|
| `random` | Floor. Must lose early (<5% clear at wave 8). |
| `greedy` | DPS-per-gold with range weighting; acts at wave start and at fixed mid-wave checkpoints (real-time model). The par player, calibrated against human runs. |
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

- **M0 (done 2026-09-11, [[ADR-0014-begin-m0]]):** sim skeleton, PRNG, fixed-point, one tower, two enemies, map generator, `random` and `greedy` bots, determinism + golden tests, CLI with `--set` overrides and replay files, CI. First experiment recorded in `experiments/0001-m0-cliff`. No renderer.
- **M1:** full tower/enemy tables for the chosen concept, `greedy-k`, `interest-greedy`, per-wave invariant report, first sweep.
- **M2:** `beam` ceiling estimate, fuzzer, pinned exploits, nightly CI.
- **M3:** placeholder renderer wired to the same sim; humans play what the bots play; telemetry from playtests compared to bot ladder (Slay the Spire style pick-rate and damage-taken logs).

## Concept-specific notes

- Concept A: the solver must model wall-piece draws and enclosure; income is area, so `Budget(n)` depends on the bot's building skill. Use `greedy-enclosure` as the par policy.
- Concept B: cleanest fit. Interest math is closed-form; mazing bots are well-studied (Desktop TD lineage).
- Concept C: no discrete waves. Simulate whole blocks; the policy is a raid schedule; invariants are expressed over time windows instead of wave indices.

## Lessons from experiment 0001 (2026-09-11)

- Run length must be an invariant, not just a report: budget growth lengthened waves to hours before it made them hard. M1 caps enemies per wave and lets the budget buy HP tiers and tags.
- HP growth is a 600-bp-wide cliff between "random bot wins" and "random bot loses". Sweeps must be fine-grained around it.
- With the placeholder economy, early-call gold dwarfs interest, so the knife edge from ADR-0012 does not exist yet. The first M1 sweep is interest rate x bounty base x start gold, with the invariant `Margin(n)` computed per wave.

## Playable demo checkpoint (2026-09-10 local / 2026-09-11 UTC)

Per [[ADR-0015-playable-demo-validation]], M3's human-testing surface is now
available before the full M2 ceiling/fuzzer. M1 has capped HP-tier composition,
seven tower roles, five archetypes, matrix/slow/splash/chain/reveal/aura behavior,
stacking patches and a provisional difficulty spread. Full enemy behavior and
per-type curve calibration are not complete.

Experiment 0002 records 6,930 replay-verified sweep runs and 200-seed strategy /
execution ladders. Presets scale defense prices (80%/100%/125%); no-patch greedy
clears 93%/77%/40%. `player-deliberate`, `player-hesitant` and `player-rushed4x`
separate action cadence/missed opportunities from strategy. They do not model
perception, motor accuracy or the benefit of paused planning.

`probeDefense` searches one greedy prefix at a time on an exact seed and writes
an isolated-wave replay for each successful defense. Its result is an **upper
bound on MinDefenseCost**, giving a **lower bound on Margin**. It ignores costs
of transitioning an existing defense to the found layout. The original all-wave
3–6% band and god-run-rate gate have not passed and must not be claimed complete.
CI currently enforces broader demo rates, winning-run duration, replay parity
and three explicitly named late-wave witnesses. The next input is the user's
replays and notes via `balance compare`, followed by a stronger build-order oracle.

## Drop-dependent lab checkpoint (2026-09-11, supersedes demo-1 targets)

The human Medium7 run falsified the old provisional rates as a measure of
interesting play. Per [[ADR-0018-drop-dependent-playtest-checkpoint]], v4 now
ships three18-wave labs with nine towers, status/support combinations and
paid rerolls. Easy prices70%, Medium100%, Hard125%. Geometric budget/HP growth
overtakes ordinary capped bounty income without a discrete late-wall multiplier.

1512 untouched-seed profile/control/loot runs and360 fresh offer-led learner
runs all replay exactly, with no illegal commands. Six causal avenues and a
reroll rescue retain positive/negative replay pairs. The reasonable learner
now saves for matching towers; the old cheapest-tower apprentice remains only
a myopic diagnostic. Exact-next-wave Engineer forecasts are oracle-assisted.

The zero-drop all-wave margin above is historical, not this trial's acceptance
gate: drop-dependent late wins are now intentional. No claim of a solved
minimum-defense cost, 3–6% invariant, calibrated intelligence/dexterity, actual
bot enjoyment or measured sustained god-run rate is made. CI now protects broad
lab regression behavior, geometry, economy and replay parity. Next input is
human fun/choice/pacing feedback on new runs; retain the diary and git checkpoints.
