# Knife Edge

A playable roguelike tower-defense mechanic lab. Build a maze, follow the drops,
engineer combinations, and assemble enough power to survive 18 escalating waves.
Art and audio are deliberately deferred until the game earns them.

## Play

```sh
pnpm install
pnpm dev
```

Open http://127.0.0.1:5173. Choose a lab, difficulty and seed, then **New run**.
Start with **Raid/Heat, Easy, seed 7**, then Medium; try Glass Cannon for a more
volatile run. Resume uses a save's embedded old rules, so start fresh after an update.

The demo has nine towers, upgrades and targeting, water→lightning/freeze and
oil→fire combinations, stacking rare status drops, paid rerolls, speed controls,
local recovery and exact replay export/import. Read [PLAYTEST.md](PLAYTEST.md)
for six focused experiments and what to include with a saved win or loss.

| Lab | Distinctive gamble |
|---|---|
| Raid/Heat | Close enemy sources for cash, but permanently strengthen the survivors; build poison, lightning or death-explosion engines. |
| Compound | Spend enough to survive while growing an investment engine; decide when to cash in through defense. |
| Glass Cannon | Trade core for damage, or recover at low core through Last Stand. Missing the connector can be fatal. |

## What validation establishes

The current `demo-4` configs were frozen before **1,512 fresh runs**: all exact
replays verified, no rejected commands or timeouts. Expert/oracle-assisted wins
out of 40 boards were:

| Lab | Easy | Medium | Hard |
|---|---:|---:|---:|
| Raid/Heat | 39 | 33 | 16 |
| Compound | 39 | 31 | 8 |
| Glass Cannon | 40 | 25 | 12 |

These are heuristic policy results, **not human win-rate promises**. The repaired
non-oracle learner completed another360 fresh games. Easy/Medium/Hard wins out
of40 were38/27/12 Raid,34/12/2 Compound and33/14/3 Glass Cannon. It followed
416/421 new matching drops with matching purchases within two waves on
Easy/Medium. See its [behavior review](experiments/0004-raid-heat/LEARNER-V1.md).
The old cheapest-tower apprentice remains a myopic diagnostic, not a reasonable
human proxy. Decision cadence is not dexterity.

The independent judge retained six causal strategy witnesses for human trials.
Matched choices and adaptive effect removals demonstrate consequences; ordinary
Arc/Ember controls with neutralized drops won only 1/240. Geometric enemy growth
outpaces capped ordinary bounty income. None of this proves subjective fun,
a universal wave-12 wall, or a solved minimum-defense margin. A favorable Raid
board still wins frequently; Glass Cannon has stronger loot-dependent variance.

See the [experiment](experiments/0004-raid-heat/README.md),
[exploration diary](experiments/0004-raid-heat/DIARY.md),
[held-out distributions and source fingerprints](experiments/0004-raid-heat/heldout-v4-summary.json),
and [judge checkpoints](experiments/0004-raid-heat/keepers/v4/README.md).
The old 30-wave demo and its obsolete success rates are historical in experiment0002.

## Commands

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm validate:balance
pnpm exec playwright install chromium webkit
pnpm test:browser
pnpm balance run --policy engineer --difficulty medium --seeds 1..20
pnpm balance compare --file path/to/your.replay.json
pnpm balance replay --file path/to/saved.replay.json
```

## Layout

- `packages/sim/`: deterministic engine-free 20Hz integer simulation.
- `packages/render-phaser/`: placeholder board, tested session/replay clock.
- `apps/web/`: controls, saves, notes and Chromium/WebKit checks.
- `tools/balance/`: policies, replay-checked experiments and regression gate.
- `data/game.json`, `compound.json`, `pact.json`: three tunable lab rulesets.
- `experiments/`: frozen candidates, positive/negative witnesses and iteration diary.
- `vault/`: design history, ADRs and living branch register; begin at `vault/Index.md`.

See [HANDOFF.md](HANDOFF.md) for technical continuity and remaining limitations.
