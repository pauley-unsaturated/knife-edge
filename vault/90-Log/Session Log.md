---
id: 421D0607-4AE9-4822-A0FB-6E5A67194E27
created: 2026-09-10T05:42:42Z
modified: 2026-09-10T05:42:42Z
tags: [log, stratum-log]
---
# Session Log

*Append-only. Newest at the bottom.*

## 2026-09-10 — Session 1: kickoff

- Received the brief; captured it in [[Brief]] and [[Constraints]].
- Clarified: dedicated repo, run-based roguelike with meta unlocks, concepts-only pass, no stack bias. Recorded as ADR-0001..0004.
- User added the vault requirement mid-session; this vault structure is the response.
- GitHub connector could not create the repo (403); user created `pauley-unsaturated/knife-edge` by hand.
- Launched three research threads: TD mechanics taxonomy, balancing tooling prior art, engines + Pixellab API.
- Research landed as three stratum-1 notes. Wrote Concepts A (Bulwark), B (ICE), C (Block Party).
- Recorded ADR-0005 (stack: TS sim + Phaser 4 + Capacitor) as a delegated pick pending ratification.
- Wrote [[Balance Toolkit Plan]] and [[Concept Evaluation]] (recommendation: B's economy, A's phase model, theme deferred).
- **Hand-off:** user ratifies ADR-0005, answers Q2-Q5 in [[Open Questions]], picks a direction from [[Concept Evaluation]]; next pass is M0 of the toolkit plan.

## 2026-09-11 — Session 1 continued: open questions answered

- User answered Q1-Q7. Recorded as ADR-0006 (web primary, cursor-first), ADR-0007 (real-time with speed control; headless fast-forward), ADR-0008 (25-30 min runs), ADR-0009 (retro is a vibe), ADR-0010 (premium), ADR-0011 (audio).
- ADR-0005 (stack) ratified via ADR-0006. Constraints amended (C2 relaxed, C1/C4 sharpened, C9 added: human-validated pipeline).
- Balance Toolkit Plan gained the fast-forward / replay / human-calibration / experiment-manifest section.
- **Still open:** B2 theme, B4 spatial mechanic, B6 mob generator, B7 economy signature, B8 weapon system, B12 art pipeline, B13 tooling depth ADR.
- **Hand-off:** next is an ADR closing B4/B7 (recommendation in [[Concept Evaluation]]), then M0 of the toolkit plan.
- User accepted the B4/B7 recommendation (ADR-0012), deferred theme (B2), asked for a B6/B8 recommendation: drafted as ADR-0013 (proposed).
- User accepted ADR-0013: B6 as proposed; B8 amended (hyperparameters to sweep, stacking relics, god runs). Toolkit plan gained the hyperparameter table and god-run metric.
- User: per-type curves decide the upgrade/build-out crossover; some types scale late, some synergize on build-out. Recorded as ADR-0013 amendment 4 and as data fields (`costGrowthBp`, `damageGrowthBp`, `adjacencyBonusBp`).
- ADR-0014: started M0. Built `packages/sim`, `tools/balance`, `data/game.json`, tests (13 passing, golden hash pinned), CI, and experiment 0001 (HP-growth cliff found; budget growth lengthens rather than hardens; interest currently irrelevant).
- **Hand-off:** M1 next: cap enemies per wave, budget buys tiers, interest x bounty sweep with the per-wave Margin invariant, then more tower types and the damage-tag matrix.
- Added `CLAUDE.md` (durable agent instructions) and `HANDOFF.md` (state + M1 task list) at the repo root for a local coding agent.

## 2026-09-10 local / 2026-09-11 UTC — Playable demo and validation

- Continued from M0 at the user's request; recorded [[ADR-0015-playable-demo-validation]].
- Built the web demo with placeholder Phaser 4 shapes, seven tower roles, five
  enemy archetypes, capped/tiered waves, targeting, patch choices, previews,
  pause/speeds/instant mode, recovery, exports with notes and verified playback.
- Added economy/preset/sensitivity sweeps, watchable isolated-wave defense probes,
  bad-purchase and patch policies, and explicit slower/missed-action profiles in
  response to the user's question about player intelligence/dexterity simulation.
- Experiment 0002 contains 6,930 replay-verified runs and compact tracked reports.
  No-patch greedy clears 93% / 77% / 40% on Easy/Medium/Hard across 200 seeds.
  Human calibration, true solver margins and sustained god-run rates remain open.
- Added deterministic mechanics/clock/profile tests, browser interaction and full
  replay parity checks, demo difficulty gates and scheduled sweep artifacts.
  Typecheck, tests, production build, demo gates and browser checks passed locally.
- Fixed final-leak victory, cooldown off-by-one, reroute progress resets, replay
  data portability and incomplete state hashing. Golden updated with these sim/data
  changes; no commit/push or remote CI claim.
- Added `PLAYTEST.md`, in-game checklist and bundled example replay; refreshed
  `README.md`, `HANDOFF.md` and living design status. Art/theme remain deferred.
- **Hand-off:** user plays seed 7 across the three difficulties, then seeds 19/42,
  exports notes/replays; use `pnpm balance compare --file ...` to calibrate the
  policy ladder and address transition-cost/riddle-wave/saving-incentive gaps.

## 2026-09-10 local / 2026-09-11 UTC — Safari play-area sizing fix

- User reported the game playing acceptably but the Safari board growing
  vertically and pushing down the controls. Reproduced on a cold WebKit load:
  the board grew from ~1,170 to ~1,280 pixels while idle.
- Traced the cause to Phaser's default parent expansion: a zero-height initial
  measurement while font CSS loads writes inline `height:100%`, overriding the
  CSS height limit. Disabled `expandParent` and took the canvas out of normal
  layout flow inside the bounded board container.
- Added WebKit alongside Chromium to browser tests and CI installation. The new
  regression first failed with the unwanted inline height, then passed after
  the fix across delayed CSS, idle checks, five viewport sizes and pointer input.
- All 12 browser checks, typecheck and production build passed. Gameplay and
  balance data were unchanged. Actual Safari confirmation remains the user's
  playtest; automated coverage uses WebKit.
- **Hand-off:** reload the demo in Safari and continue playtesting; preserve
  `expandParent:false` and independent parent/canvas sizing in future UI edits.

### Follow-up — canvas too small inside the bounded frame

- User screenshot showed a small canvas centered in a large frame. Added an
  explicit parent-size refit on readiness and container resize, including the
  parent binding Phaser can skip when boot measures a zero-height container.
- Deferred observer-triggered writes to the next animation frame after WebKit
  testing caught a ResizeObserver notification-loop error with direct writes.
- Strengthened layout assertions to require canvas fill, added a larger desktop
  viewport and parent-only resize coverage. Verified pointer mapping afterward.
- All 12 Chromium/WebKit browser checks, typecheck and production build pass.
  Fresh Retina WebKit inspection also showed the canvas filling the frame height.
  Actual Safari confirmation remains with the user. No gameplay/balance changes.

## 2026-09-10 local / 2026-09-11 UTC — First human difficulty calibration

- Read the user's Medium seed-7 replay from Downloads and verified its embedded
  data/final hash. Perfect clear, 720 kills, 718 unspent gold; user reports no
  interesting choices. Reference greedy also perfect-clears this seed.
- Added experiment 0003 with a reproducible diagnostic script and recorded
  hypothesis before running command-prefix/no-patch counterfactuals. All 31
  generated replays verify. No actions after wave 17 still wins with 7 lives;
  no actions after wave 21 still wins with all 20. Removing all patches also
  perfect-clears, with five rejected early calls from changed wave timing.
- Documented the failure of decision pressure and the limits of bot win-rate
  bands; no gameplay defaults, balance gates or golden hashes were changed.
- **Hand-off:** use this replay as the human calibration witness. Evaluate
  frozen-defense horizons and actual purchase alternatives while retuning
  encounter pacing/composition and economy; do not equate higher losses with fun.

## 2026-09-11 — Drop-dependent mechanic lab, driver/judge convergence

- Implemented nine-tower18-wave Raid/Heat, Compound and Glass Cannon labs with
  rare stacking poison/slow/confusion/death bursts, water→Arc/Frost and oil→Ember
  support combinations, paid escalating rerolls and Easy/Medium/Hard prices.
  Status arithmetic is bounded integer math; replay hashes include future state.
- Repeated driver/judge loops rejected universally dominant upgrades and weak
  bank/risk choices. Repaired bot maze self-sabotage and expensive-tower starvation
  before retuning. Selected gentler Ember upgrades, two-card drafts, armorwave2
  and geometric late pressure against capped ordinary bounty income.
- Froze three v4 configs before1512 unseen-board/profile/control/loot runs;
  added360 fresh reasonable-learner runs without retuning. Every run replays
  exactly, zero rejected commands/timeouts. Expert difficulty and affordable
  learner drop-following are measured; neither is human intelligence or fun.
- Independent judge retained six causal avenues plus a real paid-reroll rescue.
  Saved14 win/loss checkpoints with embedded data, provenance and verifier,
  compact cohort reports, the exploration diary and reusable driver/judge prompts.
  Local annotated tags index those mechanics; no remote push/deployment.
- Updated playable defaults, example replay, combo/status feedback, offer guards,
  controls and playtest checklist. The frontend-design skill guided readable
  feedback and responsive controls; no art assets were commissioned. Preserved
  Safari bounded-canvas/refit fixes and verified Chromium plus WebKit.
- Verification:109 unit tests, typecheck, production build,16 browser checks,
  120-case CI regression and600-case scheduled command,14 keeper checks all pass.
  Original human demo1 replay and7 prior keepers remain compatible. Vite's known
  large-chunk advisory remains; remote CI has not run.
- Current undefended seed99 golden is wave2/tick927/hash40312270: the free first
  wave's six leaks are survivable with12core, then armoredwave2 kills. The commit
  includes this data/simulation rationale; generated build caches stay ignored.
- ADR0018 records the user-directed shift from a zero-drop all-wave margin gate
  to earned drop-dependent wins. True minimum-cost margins, repeated Compound
  god-stacking, coating/Mutiny necessity and subjective fun remain unproved.
- **Hand-off:** use New run for the v4 rules; Easy to learn, Medium to find a
  groove, Hard for stronger planning. Follow `PLAYTEST.md`, save a win and loss
  with debated choices and turning points. Boring wins/opaque deaths trigger
  the next explicit hypothesis and fresh-seed judge loop, not more art.
