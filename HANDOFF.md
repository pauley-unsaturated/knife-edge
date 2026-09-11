# Hand-off

Point-in-time state for the next agent or human. Last updated 2026-09-11 after M0. When you finish a session, update this file and append to `vault/90-Log/Session Log.md`.

## Where things stand

- **Design:** branches B0-B15 are all decided except theme (B2, deferred until a placeholder renderer exists) and art pipeline (B12, deferred until graphics matter). See `vault/40-Branches/Branch Register.md`. The converged design is: open-grid mazing, real-time with speed control, bounty + interest + early-call economy, budget-driven wave composer, seven damage types on flat per-type ladders with a small damage-vs-tag matrix, stacking relics that can produce god runs, 25-30 minute runs, web first, cursor-first input, premium.
- **Code (M0, done):** `packages/sim` and `tools/balance` exist and pass 13 tests including a pinned golden hash. CI is green on push. One tower type (`bolt`), two enemy types (`grunt`, `swift`), no relics, no damage matrix, no renderer.
- **Experiment 0001** (`experiments/0001-m0-cliff/README.md`): HP growth is a 600-bp-wide cliff; wave-budget growth lengthens waves rather than hardening them; the placeholder economy is far too rich; early-call gold dwarfs interest, so the intended knife edge does not exist yet.

## M1 tasks, in order

1. **Cap and tier the composer.** Add `maxEnemiesPerWave` and let the budget buy HP tiers or tags instead of only count (e.g., a per-type `tier` multiplier priced into `budgetCost`). Make run length (`minutesAt1x`) an invariant: P50 in 25-30 min for the greedy bot per ADR-0008.
2. **Implement the per-wave margin invariant** from the Toolkit Plan: `Budget(n)`, `MinDefenseCost(n)`, `Margin(n)`. A first `MinDefenseCost` can be the cheapest greedy placement that clears wave n with zero leaks on the median board; refine later with beam search.
3. **First real sweep:** `economy.interestBp` x `economy.bountyBase` x `economy.startGold` against the margin band. Goal: a band where `greedy` wins, `random` loses, `greedy-reserve*` (interest greed) is competitive but not dominant. Record as `experiments/0002-*`.
4. **Add the bot ladder rungs:** `greedy-k` (k forced suboptimal buys) and a `beam` search over build orders. Calibrate "par" against the human's recorded runs once a renderer exists.
5. **Widen the tables:** seven tower types with distinct `costGrowthBp`/`damageGrowthBp`/`adjacencyBonusBp` so upgrade-vs-build-out crossovers differ per type; enemy tags with effects; the damage-type vs tag matrix (`m` tunable). Sweep the per-type curves.
6. **Relics** as a stacking, multiplicative layer; implement the god-run metric and `relic_response`.
7. **Renderer (M3):** Phaser 4 adapter over the same sim, 256x224 virtual canvas, placeholder rectangles, replay viewer, speed control, instant-to-wave-end. This is when the human validates the pipeline by watching bot replays at 1x.

## Known rough edges

- `greedy` scores builds by path-cell coverage times DPS per gold, which ignores enemy speed and tower overkill; good enough as a par baseline, not as a ceiling.
- `canBuild` runs a full BFS per candidate cell; fine at 20x14, revisit if boards grow.
- The composer's `riddleEvery` currently picks one random type for the whole wave; with two enemy types it is not yet meaningful.
- `outcome: "timeout"` in batch reports means the 400k-tick cap was hit, which only happens when waves are absurdly long; treat it as a run-length failure, not a draw.

## Environment notes

- Node 22 and pnpm 10. No native dependencies. Everything runs headless on Linux or macOS.
- iOS builds need the Mac with Xcode; nothing in M0-M2 needs a Mac.
- Pixellab is not needed until the art pass; its API is plain HTTPS with a bearer token (`vault/10-Research/Research - Engines and Art Pipeline.md`, Part B).
