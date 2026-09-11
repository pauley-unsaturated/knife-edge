# Experiment 0002: capped waves and playable affordability bands

Starting sim commit: `3993cdebe83cf83f7dbb1d0b5cd1ea36b083a342` (M0).
Working simulation/data revision: `demo-1` (this experiment's source changes).

## Hypothesis (before the sweep)

Cap waves at 24 enemies and spend excess budget on proportionally priced HP tiers.
Use a 30-wave run with a two-second spawn interval; a winning greedy run should
have P50 duration 25–30 minutes at 1x. Flat kill bounties, bounded interest and a
short early-call window should remove the M0 runaway economy. Difficulty changes
defense prices, leaving seeded boards and enemies identical for direct comparison.

Explore interest rate × bounty × starting gold first, then enemy budget growth
and defense prices to find the useful boundary. Desired ordering: easy permits
mistakes, medium rewards coverage and counters, hard demands efficiency. Greedy
should beat random; a reserve policy should compete without dominating. These
are provisional bot targets pending human calibration, not proof of fun.

Measure P5/P50/P95 waves and duration, Wilson win-rate intervals, economy shares,
and per-wave affordable budget / cheapest found zero-leak greedy defense minus 1.
The latter is a heuristic upper bound on minimum defense cost, not a solved
optimum. Replay every reported run with its embedded data and final hash.

## Selected demo knobs

Data version `demo-1`. These are provisional playtest settings, not launch balance.

| Control | Selected value | Purpose |
|---|---:|---|
| Enemy cap | 24 | Bound wave length; excess budget buys HP tiers |
| Spawn spacing | 40 ticks / 2 seconds | Winning greedy runs around 25–28 minutes |
| Waves | 30 | Complete run with five patch offers |
| Budget base / growth | 240 / 1.10 per wave | Rising threat without unbounded enemy counts |
| Independent HP growth | 1.00 | Remove the second exponential difficulty knob |
| Starting gold / bounty | 120 / 2 per kill | Useful affordability boundary in economy sweep |
| Interest / bank cap | 3% / 200 gold | Saving helps without unlimited compounding |
| Early call | 1 gold per second, up to 8 | Keep timing rewards bounded |
| Defense prices | Easy 80%, Medium 100%, Hard 125% | Move the affordability margin; enemies and seeds stay identical |
| Relic response | 0% | Let stacked patches create advantage |

The 27-case economy grid used start gold 90/120/150 × bounty 1/2/3 ×
interest 0/3/6%, ten seeds and three policies: **810 replay-verified runs**.
At 120 starting gold and 3% interest, greedy cleared 0/10, 8/10, and 10/10
as bounty moved from 1 to 2 to 3. The reserve policy also cleared 8/10 at
bounty 2. Keep 3% rather than making the saving benefit dominate this first demo.
Full distributions and Wilson 95% intervals are in `economy-report.json`.

## Difficulty validation: seeds 1–200

Every row is 200 runs on the same boards, with every replay independently
re-simulated to its recorded final hash. The strategy sweep is **3,600 runs**;
execution profiles add **1,800**. No timeouts occurred.

| Strategy (no patches unless marked) | Easy clears | Medium clears | Hard clears |
|---|---:|---:|---:|
| Random | 18.5% | 4% | 0% |
| Greedy | 93% | 77% | 40% |
| Greedy, one poor opening buy | 91% | 79% | 43% |
| Greedy, three poor opening buys | 91.5% | 74.5% | 0% |
| Greedy, reserve 60 gold | 92.5% | 73.5% | 36.5% |
| Greedy with patch selection | 100% | 91.5% | 77% |
| Same greedy strategy, one action / 4 seconds | 92.5% | 72.5% | 39.5% |
| One action / 6 seconds, 25% missed opportunities | 87% | 70% | 37.5% |
| One action / 16 simulated seconds (4-second decisions at 4×) | 88% | 66.5% | 36.5% |

Greedy clear-rate Wilson 95% intervals: Easy **88.6–95.8%**, Medium
**70.7–82.3%**, Hard **33.5–46.9%**. Greedy waves-cleared P5/P50/P95:
Easy **27/30/30**, Medium **22/30/30**, Hard **15/27/30**.
All-run duration P5/P50/P95, minutes at 1×: Easy **24.2/25.5/27.3**,
Medium **19.7/26.1/27.8**, Hard **13.6/25.3/28.0**. Losses shorten these
distributions; the CI duration gate uses winners only.

One deliberately bad buy can improve a run by changing its later maze. The
strategy ladder is therefore not strictly monotonic and must not be described
as an IQ scale. The profiles model execution cadence, not cursor accuracy,
perception, learning, or planning while paused. Players can pause at any time.

`presets-report.json` and `profiles-report.json` contain the full tables.

## Per-wave margin: an honest bound

`probeDefense` finds the first zero-leak prefix along a greedy build order on
the exact seed, with no in-wave buying, interest, early bonuses or bounties.
The successful layout is an **upper bound on minimum defense cost**; the
derived margin is a **lower bound**, not a solved optimum. Each probe is a
watchable replay with an explicit `initialWave` and solver gold allowance.
This costs the entire layout afresh, so it also does not capture the cost of
transitioning an existing maze to a different counter lineup.

| Medium seed 7 wave | Earned budget at start | Cheapest found defense | Margin lower bound |
|---|---:|---:|---:|
| 1 | 120 | 30 | 300% |
| 19 | 1,125 | 960 | 17.2% |
| 24 | 1,403 | 1,260 | 11.3% |
| 29 | 1,682 | 1,551 | 8.4% |

Also measured all reached waves on seeds 19 and 42. Seed 42's wave 29 bound
is 13.4%, but seed 19's ordinary greedy run dies at wave 20 despite an isolated
wave-20 layout costing only 210 gold out of a 1,176 budget. That discrepancy is
evidence of a limited build-order heuristic and/or transition costs, not proof
of unavoidable difficulty. Single-type riddle waves often have very large
margins. **The original 3–6% band across all seeds/waves is not established.**

The demo's regression gate pins three seed-7 late mixed waves to a deliberately
broad 0–50% lower-bound band, and explicitly labels that scope. It does not
silently claim the stronger design invariant has passed.

## Sensitivity and limits

An additional **720 replay-verified runs** perturb starting gold, interest,
interest cap and initial wave budget by ±5%, on 30 seeds and three policies.
Greedy clears range from 70% to 80%; median reaches wave 30 in every case.
This does not prove individual-seed invariance: layouts can change abruptly,
and integer bounty 2 cannot be perturbed by 5% without changing its units.
Budget *growth* sensitivity and per-type upgrade crossovers still need a deeper
sweep. See `sensitivity-report.json`.

Interest remains modest (about 1.3% of income for Medium greedy; 4.4% for the
60-gold reserve policy). The demo establishes a useful testing surface, not yet
the intended dramatic saving dilemma. The bot does not value slow, splash or
auras with a full combat search. Relic power is reported as a type multiplier
proxy; **the sustained-margin god-run rate has not been validated**. No beam
ceiling, evolutionary fuzzer, airborne pathing, healers, fragment spawning,
boss behavior, meta progression, audio or iOS shell is claimed complete.

## Reproduce

```sh
pnpm install
pnpm exec tsx tools/balance/src/sweep.ts economy 10
pnpm exec tsx tools/balance/src/sweep.ts presets 200
pnpm exec tsx tools/balance/src/sweep.ts profiles 200
pnpm exec tsx tools/balance/src/sweep.ts sensitivity 30
pnpm exec tsx tools/balance/src/margins.ts 7 medium
pnpm exec tsx tools/balance/src/margins.ts 19 medium
pnpm exec tsx tools/balance/src/margins.ts 42 medium
pnpm validate:balance
pnpm test
pnpm test:browser
pnpm balance replay --file apps/web/public/example.replay.json
pnpm balance compare --file path/to/your.replay.json
```

Sweep output is under `out/<mode>-<seed count>/`, with a report, per-policy
JSONL and every replay. Regenerating the same case replaces its reports rather
than appending duplicate runs. Compact reports are tracked alongside this README;
bulky replays are regenerated from the source and command, with a bundled Easy
example in the web app. Local validation used Node 26.7; CI is configured for
Node 22. No remote CI result is claimed for this uncommitted change.

Golden hash deliberately changed with the capped-wave simulation, new data and
complete state hashing. The undefended seed-99 baseline now loses on wave 1,
tick 1064, hash 3688803523. A future commit containing this change should say why.
