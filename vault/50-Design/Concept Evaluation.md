---
id: 0193C6D7-449E-42AC-9A86-5162C6BF697A
created: 2026-09-10T05:50:46Z
modified: 2026-09-10T05:50:46Z
tags: [design, stratum-5, evaluation, recommendation]
---
# Concept Evaluation

*Stratum 5. Living document. Scores the three concepts against [[Constraints]] and the fun-core hypotheses in [[Research - TD Mechanics Taxonomy]], and recommends a direction for branches B2, B4, B5 in [[Branch Register]]. Nothing here closes a branch; the user does that with an ADR.*

## Summary table

| Criterion | [[Concept A]] Bulwark | [[Concept B]] ICE | [[Concept C]] Block Party |
|---|---|---|---|
| Matches the stated reference (Vector TD knife edge) | partial (interest + territory) | **direct** (interest + bounties + early call) | indirect (heat) |
| NES/SNES authenticity | **highest** (Rampart shipped on NES) | medium (sprite counts; SNES-like) | high look, tightest sprite budget |
| Touch ergonomics | **best** (phase-based, no real-time placement) | medium (coarse grid, pause) | medium (auto-walk hero needed) |
| Balance tooling fit | good (discrete phases) | **best** (closed-form economy) | hardest (continuous spawners) |
| Originality vs market | medium (Rampart + roguelike is rare) | low-medium (mazing roguelikes exist) | **high** (no brawler-TD roguelike on iOS) |
| Run length fit (20-35 min) | yes | yes | yes |
| Fun-core hypotheses hit | authorship, repair under pressure, draw luck, plan holds | economy tension, authorship, counter-puzzle, plan holds | push-your-luck, plan holds, counter-puzzle, spectacle |
| Main risk | reads as a remake | solvable by guides; touch mazing | two control loops; tuning cost |

## Recommendation

**Lead with Concept B's economy and Concept A's time model, and treat theme as a separable skin.**

1. **Economy (B7): Concept B's.** Bounties of `base + wave`, interest on banked gold at wave start, and an early-call bonus are the most direct reproduction of the Vector TD feeling the brief names, and they are the cheapest to balance with the toolkit because the money side is closed-form.
2. **Time model (B5): settled on 2026-09-11 as real-time with speed control ([[ADR-0007-real-time-with-speed-control]]).** The paragraph below is kept for history; the phase-based option is now the rewind target only. Original text: consider Concept A's phase structure even for Concept B. A build phase followed by an auto-resolving wave phase keeps touch play clean, keeps the sprite budget bounded, and makes the invariant per wave exact (no mid-wave building to model). The cost is losing juggling and mid-wave selling, which are expert-only pleasures. A "build during wave allowed, but only in fixed pause windows" hybrid is a candidate compromise and should be prototyped in the sim before deciding.
3. **Spatial mechanic (B4): open-grid mazing (Concept B) with coarse cells.** It has the strongest authorship payoff and the deepest prior art for bots. Concept A's wall-piece draw is the designated rewind if mazing on touch tests badly.
4. **Theme (B2): open, and cheap to defer.** The mechanics above dress equally well as a neon mainframe (Concept B), a besieged castle (A), or a city block (C). Recommend deciding theme only after the M0-M1 sim milestones, when the placeholder renderer exists and the choice can be made against real screens. If forced now: cyberpunk fits the mazing-as-circuit-board metaphor most literally, and neon on black is kind to a 4-color palette.
5. **Concept C's generator is worth keeping as a *mode* or a late-run twist** (spawner buildings that heat up when raided), not as the base chassis. Park it, do not reject it.

## What would change the recommendation

- If the user wants the game to read as *native NES* above everything: pick Concept A wholesale.
- If originality and charm outrank balance tractability: pick Concept C and budget twice the tooling effort.
- If web is dropped as a target: nothing changes for the concept; only ADR-0005's accepted costs shrink.

## Proposed next pass

1. ~~User ratifies or rewinds ADR-0005 (stack) and answers Q2-Q5 in [[Open Questions]].~~ Done 2026-09-11 (ADR-0006..0011).
2. Write an ADR closing B4 (spatial mechanic) and B7 (economy signature) per the recommendation (or the alternative). B5 is closed.
3. Execute M0 of the [[Balance Toolkit Plan]]: sim skeleton with determinism tests and two bots, before any renderer.
