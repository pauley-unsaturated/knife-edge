# Human calibration: Medium seed 7

## Hypothesis and method (before counterfactual runs)

The first human Medium seed-7 replay exposes excessive defense slack, not merely
a high win rate. Test the decision-pressure requirement by retaining exact human
command prefixes through each completed wave and then taking no further actions.
Also remove patch picks from the full command schedule to test their necessity.
These are fixed-schedule counterfactuals, not adaptive players or minimum-cost
solutions. Automatic waves continue; rejected commands are reported.

Source: `/Users/markpauley/Downloads/knife-edge-7-wave30.replay.json`.
Embedded data: `demo-1/medium`; original end tick 31860, hash 2474316104.
Sim base commit: `3993cdebe83cf83f7dbb1d0b5cd1ea36b083a342` plus the current
uncommitted playable-demo implementation. Use embedded data, not current defaults.
No gameplay tunables are changed. This is one human run, not a seed distribution.

Reproduce:

```sh
pnpm exec tsx experiments/0003-human-seed7/analyze.ts /Users/markpauley/Downloads/knife-edge-7-wave30.replay.json
```

The script verifies the original and every generated counterfactual replay.
Watchable counterfactuals and the report go into ignored `out/`.

## Results

The original hash verifies. The player wrote: "Way too easy. No interesting
choices made". The run killed all 720 enemies, lost no lives, spent 1,137 gold,
and finished with 718 gold. Interest contributed 229 and early calls 66 of 1,735
earned gold. All 39 commands were accepted. No purchases occurred in waves 10–16.

| Retained human actions | Outcome | Lives left | Total spent |
| --- | --- | ---: | ---: |
| Through wave 1, then no actions | Lost during wave 13 | 0 | 120 |
| Through wave 9, then no actions | Lost during wave 29 | 0 | 506 |
| Through wave 16, then no actions | Lost during wave 30 | 0 | 506 |
| Through wave 17, then no actions | Won | 7 | 550 |
| Through wave 21, then no actions | Won | 20 | 782 |
| Full schedule, remove every patch pick | Won | 20 | 1,137 |
| Original | Won | 20 | 1,137 |

The no-patch variant has five rejected early-call commands because wave timing
changes; all purchases still succeed. It is not an isolated estimate of patch
damage contribution. All 30 prefix variants and the no-patch variant were
replay-verified. These are achievable witnesses, not minimum defense solutions.

During the original replay, the closest surviving enemy sampled after each tick
still had 17.125 path cells to travel. The final route length was 25 cells.
This is a spatial pressure diagnostic, not a mathematical safety margin.

## Findings and next validation

- Decision pressure fails: the last nine waves need no further input even for
  a perfect clear. Winning alone understates how early the run becomes safe.
- Patches are not required for this perfect clear. Blaming a lucky patch roll
  does not explain away this run.
- The player spent ~35% less than the no-patch greedy bot's 1,746 gold, although
  the original has patches. Greedy also perfect-clears this seed. Bot win bands
  did not certify interesting decisions or the intended narrow margin.
- The bank cap is only 200 gold; the player already has 517 at wave 16 end.
  Hundreds of surplus gold are outside the interest decision. Raising interest
  alone would reward the existing surplus without creating defensive pressure.
- All waves contain 24 enemies spaced two simulated seconds apart: spawning
  the last enemy takes 46 seconds per wave, before its travel/kill time. This
  places a long pacing floor under encounters that mostly die near the entrance.
- Next experiments should measure how many waves a frozen defense remains
  viable, spare spending capacity before pressured waves, and the outcome of
  alternative purchases from the same checkpoint. Tune encounter timing and
  composition alongside defense/economy curves. Higher failure rates alone do
  not establish interesting choices. Retain forgiving openings and recovery.

No shipped data or gameplay implementation was changed by this diagnosis.
