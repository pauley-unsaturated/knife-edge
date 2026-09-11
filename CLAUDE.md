# CLAUDE.md

Guidance for coding agents working in this repository. Read `HANDOFF.md` for the current state and next tasks.

## What this is

Knife Edge: a roguelike tower defense with a retro (NES/SNES vibe) presentation whose signature is razor-thin balance between enemy power, tower power, and income. Web is the primary target, iOS follows via Capacitor. The design lives in `vault/`; the code includes a headless simulation, balance toolkit and playable placeholder web renderer. Difficulty is provisionally measured, not yet human-calibrated; read `HANDOFF.md` for the limits.

## Commands

```sh
pnpm install                 # Node 22, pnpm 10
pnpm test                    # vitest: determinism, golden hash, pathing, economy
pnpm typecheck               # tsc -b across packages
pnpm dev                     # playable demo at http://127.0.0.1:5173
pnpm build                   # production web build
pnpm validate:balance        # current mechanic-lab regression and replay gates
pnpm test:browser             # requires pnpm exec playwright install chromium webkit
pnpm balance compare --file path/to/human.replay.json
pnpm balance run --policy random,greedy --seeds 1..20 --verbose
pnpm balance run --policy greedy --seeds 1..50 --set "composer.hpGrowthBp=11200;economy.interestBp=500" --out experiments/NNNN-name/out
pnpm balance replay --file experiments/NNNN-name/out/greedy-7.replay.json
pnpm vitest run -u           # only when a golden snapshot must legitimately change (see rules)
```

CI (`.github/workflows/ci.yml`) runs typecheck, tests, and a smoke batch on every push to `main`.

## Layout

| Path | Role |
|---|---|
| `vault/` | Design vault (PunkRecords-compatible markdown: YAML frontmatter + `[[wikilinks]]`). Start at `vault/Index.md`. |
| `packages/sim/` | Simulation core. Pure TypeScript, no DOM, no engine, no I/O, no floats, no `Math.random`, no wall-clock. |
| `tools/balance/` | Bot policies, batch runner, CLI. Imports the sim; never the other way round. |
| `packages/render-phaser/` | Placeholder board and engine-independent Session clock/replay transport. |
| `apps/web/` | Vite shell, DOM controls, save/recovery and browser tests. |
| `data/game.json`, `data/compound.json`, `data/pact.json` | Raid/Heat, Compound and Glass Cannon lab tunables. Rates in basis points (10000 = 1.0), distances in cells, speeds in fixed-point units per tick. |
| `experiments/NNNN-name/` | One folder per experiment: `README.md` with hypothesis, method, results table, findings, reproduce command. `out/` is gitignored. |
| `Scripts/new-note.sh` | Emits a frontmatter header for a new vault note. |

## Architecture rules (do not break)

1. **The sim is a library; everything else is a client.** `packages/sim` must not import from `tools/`, a renderer, Node APIs, or the DOM. Tests load `data/game.json` through `fs` in the test helper, not the sim.
2. **Determinism is a hard requirement.** Fixed 20 Hz tick. Integer math only (`fixed.ts`: `SCALE` = 1024 per cell, `BP` = 10000). RNG is `rng.ts` (sfc32 via `Math.imul`), injected through state. Bots use their own RNG so bot randomness never perturbs the world stream. Same `(data version, seed, commands)` must produce the same `hashState` on every machine.
3. **A run is a replay.** Every bot command is recorded as `TimedCommand`; every claim about balance must be reproducible from a replay file a human can watch (constraint C9 in the vault).
4. **Tunables live in `data/game.json`, never as literals in code.** Add a field there and to `RawGameData` in `data.ts`; document units in the interface comment.
5. **Golden snapshots change only with a data or sim-logic change in the same commit**, and the commit message says why. Never `-u` to make a red test green.
6. **Cursor-first, no hover dependency** for any future UI (ADR-0006). **Real-time with speed control** (ADR-0007). **Retro is a vibe, not a hardware limit** (ADR-0009).

## Vault discipline

- Strata: `00-Brief` (frozen; amend via ADRs) → `10-Research` (append-only) → `20-Concepts` (append-only, `status:` line) → `30-Decisions` (ADRs, append-only; supersede, never edit) → `40-Branches` (living register of forks) → `50-Design` (living converged design) → `90-Log` (append-only session log).
- **Any decision that closes or reopens a fork gets an ADR** (`vault/30-Decisions/ADR-NNNN-*.md`) with Status, Closes branch, Decision, Alternatives, Consequences, Rewind. Add a row to `Decision Log.md` and flip the row in `Branch Register.md`.
- To rewind: write a new ADR with `supersedes:` the old one. Do not edit the old ADR.
- Append a dated entry to `vault/90-Log/Session Log.md` at the end of every session with what changed and a hand-off line.
- New notes: `Scripts/new-note.sh x "tag1, tag2" > "vault/.../Name.md"` then append the body. Wikilink targets are file stems; verify with:
  `grep -oh "\[\[[^]]*\]\]" -r vault | sort -u | sed 's/\[\[\(.*\)\]\]/\1/' | while read t; do find vault -name "$t.md" | grep -q . || echo "MISSING: $t"; done`

## Experiment discipline

Before a sweep, write the hypothesis and which invariant it should move. Use `--set` overrides rather than editing `data/game.json` for exploration; commit a data change only after the experiment README justifies it. Report distributions (P5/P50/P95), not bare means. Record the sim commit and data version in the README.

## Design anchors (read these first)

- `vault/50-Design/Balance Toolkit Plan.md` — invariants, bot ladder, hyperparameter table, god-run metric, milestones M0-M3.
- `vault/30-Decisions/ADR-0012-mazing-and-economy.md` and `ADR-0013-wave-composer-and-towers.md` — the mechanics the sim implements.
- `vault/40-Branches/Branch Register.md` — what is decided, what is open (theme B2 is deliberately deferred).
