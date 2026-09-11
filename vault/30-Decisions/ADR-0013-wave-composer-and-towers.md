---
id: B8173AA6-0C76-4888-A36E-68E16C7E382A
created: 2026-09-11T01:39:27Z
modified: 2026-09-11T01:39:27Z
tags: [adr, decision, stratum-3, mobs, weapons]
---
# ADR-0013 Budgeted wave composer and flat-ladder towers with a damage-tag matrix

- **Status:** proposed (2026-09-11), awaiting the user's yes
- **Closes branches:** [[Branch Register]] B6 (mob generator) and B8 (weapon system)
- **Decision (proposed):**

  **B6, mob generation: a budget-driven wave composer.**
  - Each wave n has a single scalar **budget** `B(n) = B0 * g^n` (g tuned near 1.08-1.12, per genre norms in [[Research - Balancing Tooling]]). The composer spends it on enemy archetypes priced in budget units, under rules: tags unlock on a schedule (no flyers before wave 8, no stealth before 15), at most one boss per 10 waves, and every fifth wave is a **riddle wave** built from one tag so the counter is legible.
  - Waves are **generated from the floor seed**, so a run is replayable and a daily seed falls out for free, but the composer is a pure function of (seed, n, rules) and the rules are data.
  - **Next-wave preview is mandatory UI.** The knife edge only works if the player can see what is coming and choose to bank or build. Vector TD shows the next wave; so do we.
  - Early-call (from [[ADR-0012-mazing-and-economy]]) is the player's only influence on timing; there is no enemy sending, no spawner buildings in the base mode.
  - Why: a scalar budget makes wave difficulty one number the toolkit can sweep, the composer rules are testable data, and riddle waves give the counter-puzzle fun core without a full element wheel.

  **B8, weapons: flat upgrade ladders plus a small damage-type vs enemy-tag matrix plus patches.**
  - Seven towers at launch, each with a **linear upgrade ladder** (target: 6 levels; Vector TD used 10) on an explicit Schreiber-style cost curve so DPS-per-gold is inspectable. Upgrading is slightly more gold-efficient than buying a second tower, to reward commitment; range and coverage counterbalance it.
  - **Damage types** (kinetic, thermal, logic/slow, burst/AoE, chain, scanner/reveal, support/aura) against **enemy tags** (armored, swift, fragmenting, airborne, stealth, healer, boss) in a small intransitive matrix. No element combination system at launch: GemCraft/Element TD style combinatorics multiply the cost-curve problem and make knife-edge verification intractable for a two-person team. It is the natural expansion once the base is proven.
  - **Targeting priority** is a free, first-class control (first, last, strongest, weakest).
  - **Patches** (relics) are the roguelike offer layer: one slot per tower plus run-wide patches; they modify behaviour, never raw stats (e.g., "bolts pierce", "slow stacks", "sell refund 90%"), so the base cost curve stays valid.
  - Why: linear ladders and a matrix are the two structures the balancing literature knows how to price; the offer layer supplies variety without breaking the invariant.

- **Alternatives considered:** scripted hand-authored waves (rejected: not replayable across procedural boards, and every rebalance is manual); element/gem combination towers (deferred to expansion); branching upgrade trees per tower (rejected for launch: doubles the cost-curve surface).
- **Consequences:** M1 of the [[Balance Toolkit Plan]] builds `data/enemies.csv` with budget prices, `data/composer.json` with the rules, and `data/towers.csv` with ladders; the first sweep is g x interest rate.
- **Rewind:** Moderate. The composer and the tower tables are data; replacing either leaves the sim and toolkit intact.
