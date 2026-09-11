---
id: 16B91F12-126E-4D14-AD76-615CFE4BB6B8
created: 2026-09-11T02:00:09Z
modified: 2026-09-11T02:00:09Z
tags: [adr, decision, stratum-3, process]
---
# ADR-0014 Begin M0: the headless sim exists before any renderer

- **Status:** accepted (2026-09-11). Supersedes the "no code" scope of [[ADR-0003-scope-of-first-pass]].
- **Context:** All design branches that the sim depends on are closed (ADR-0005 through ADR-0013). The user asked for hyperparameter exploration, which needs the sim.
- **Decision:** Build milestone M0 of the [[Balance Toolkit Plan]] on `main`: `packages/sim` (TypeScript, fixed 20 Hz tick, integer fixed-point, sfc32 seeded PRNG, no I/O), `tools/balance` (policies, runner, CLI with `--set` overrides and replay output), `data/game.json` as the single source of tunables, vitest determinism and golden-hash tests, GitHub Actions CI, and `experiments/` as the log of versioned experiments.
- **What M0 deliberately leaves out:** renderer, relics, damage-type matrix, multiple tower types, enemy tags with effects, the beam and fuzzer policies. Those are M1-M3.
- **Rewind:** Free at the design level; the sim is data-driven and engine-free.
