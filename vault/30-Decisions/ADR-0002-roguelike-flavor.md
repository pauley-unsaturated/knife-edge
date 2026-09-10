---
id: BEEBAB0A-8338-4363-9D1E-2DE8D21267DF
created: 2026-09-10T05:41:56Z
modified: 2026-09-10T05:41:56Z
tags: [adr, decision, stratum-3]
---
# ADR-0002 Roguelike means run-based with meta unlocks

- **Status:** accepted (2026-09-10)
- **Closes branch:** [[Branch Register]] B1 (roguelike flavor)
- **Decision:** A run is a procedurally generated map (or map sequence) with randomized tower/relic offers. Losing ends the run. Between runs the player unlocks new towers, relics, and modifiers that widen the offer pool without raising raw power.
- **Guardrail:** Meta progression must widen the *option space*, not inflate *stats*. Otherwise knife-edge balance is impossible: the balance point would move with every unlock. (See [[Research - Balancing Tooling]] on why this matters.)
- **Alternatives:** (a) Pure permadeath, no meta (Spelunky): cleanest to balance, harshest onboarding on mobile. (b) Procedural map only: keeps a fixed tower set; loses the offer-tension that makes roguelike TDs replayable.
- **Rewind:** Moderate. Concepts are written so the meta layer is a removable module; dropping it yields alternative (a) without touching in-run mechanics.
