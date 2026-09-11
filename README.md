# Knife Edge

Codename for a roguelike tower defense with an NES/SNES throwback presentation, whose signature is razor-thin balance between enemy power, tower power, and income.

## Layout

- `vault/` — the design vault. Start at `vault/Index.md`. PunkRecords-compatible markdown (YAML frontmatter + `[[wikilinks]]`), stratified brief → research → concepts → decisions → converged design. Every decision is an ADR with a rewind note.
- `packages/sim/` — the headless simulation core. Pure TypeScript, fixed 20 Hz tick, integer fixed-point math, seeded PRNG, no I/O. A run is `(data version, seed, command list)`.
- `tools/balance/` — the balance CLI: bot policies, batch runner, replay files, `--set` parameter overrides.
- `data/game.json` — every tunable. Rates are basis points, distances are cells.
- `experiments/` — versioned experiments: hypothesis, method, results, reproduce command.
- `Scripts/new-note.sh` — frontmatter header for a new vault note.

## Commands

```
pnpm install
pnpm test                       # vitest: determinism, golden hash, pathing, economy
pnpm typecheck
pnpm balance run --policy random,greedy --seeds 1..20 --verbose
pnpm balance run --policy greedy --seeds 1..50 --set "composer.hpGrowthBp=11200" --out experiments/x/out
pnpm balance replay --file experiments/x/out/greedy-7.replay.json
```

Renderer, relics, the damage-type matrix and further bot policies land in later milestones; see `vault/50-Design/Balance Toolkit Plan.md`.
