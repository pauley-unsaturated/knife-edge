---
id: 3E221692-183D-4B47-9EF9-C5E4A678925A
created: 2026-09-11T02:40:00Z
modified: 2026-09-11T02:40:00Z
tags: [adr, decision, stratum-3, demo, balance]
---
# ADR-0015 Playable demo and provisional validation bands

- **Status:** accepted for the first human playtest (2026-09-10 local time).
- **Closes branch:** none. B13's full solver ceiling remains pending. Theme B2
  and art B12 remain deferred until the user finds the game fun.
- **Decision:** follow the user's request to reach a playable web demo before
  completing every M2 optimizer or launch enemy behavior. Deliver seven tower
  roles, five enemy archetypes, 30 capped/tiered waves, stacking patch offers,
  previews, speed controls, a placeholder Phaser renderer, portable replays and
  Easy/Medium/Hard presets that change defense affordability only.
- **Validation:** retain a zero-patch baseline; measure strategy, forced bad buys,
  banking, patch use and separate execution cadence/miss profiles across seeds.
  Replay every batch result. Isolated-wave greedy defenses are explicitly upper
  bounds on minimum cost, not solver optima. CI gates are provisional demo bands;
  the 3–6% margin invariant and sustained god-run rate are not certified.
- **Alternatives:** complete beam search/fuzzing before human play, or label bot
  wins as proof of a finished knife edge. The former delays the user's requested
  feedback; the latter is unsupported by the measurements.
- **Consequences:** human replay comparison is the next calibration input. Use
  [[Balance Toolkit Plan]] and experiment 0002 to refine the ruler, transition
  costs, riddle-wave difficulty, saving incentives and per-type crossovers.
  Pause is intended, so execution pressure is measured separately from strategy.
- **Rewind:** low. Presets, enemy budgets, economy and execution profiles are
  data. The renderer consumes the unchanged fixed-step library boundary.
