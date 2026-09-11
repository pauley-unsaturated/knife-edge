---
id: 1AE17D3F-C977-42B7-8A46-2E1CED086E40
created: 2026-09-11T01:39:27Z
modified: 2026-09-11T01:39:27Z
tags: [adr, decision, stratum-3, mechanics, economy]
---
# ADR-0012 Open-grid mazing with a bounty-interest-early-call economy

- **Status:** accepted (2026-09-11)
- **Closes branches:** [[Branch Register]] B4 (core spatial mechanic) and B7 (economy signature). Adopts the recommendation in [[Concept Evaluation]].
- **Decision:**
  - **Spatial (B4):** open-grid mazing in the Desktop TD / Vector TD lineage. Towers are solid; enemies path by shortest route from entry to core through whatever the player builds; fully blocking the path is illegal. Boards are procedurally generated per floor (fixed entry/core, random obstacles and bonus cells) so mazes cannot be memorised across runs. Grid is coarse enough for cursor play per [[ADR-0006-web-primary-cursor-first]].
  - **Economy (B7):** three levers, all from [[Concept B]]:
    1. Kill bounties of `base + wave`.
    2. **Interest on banked gold at the start of every wave**, starting low, raised only through rare in-run offers.
    3. **Early-call bonus** proportional to seconds skipped, paid before the interest tick.
    Sell refund 75%, selling allowed mid-wave (real-time model, [[ADR-0007-real-time-with-speed-control]]).
  - The knife edge is defined by the per-wave invariant in [[Balance Toolkit Plan]]: par budget vs minimum viable defense within a designed margin band. Interest rate, wave growth rate and bounty base are the three tunables that move it and are the first sweep.
- **Alternatives:** wall-piece territory income ([[Concept A]]) stays the rewind target if mazing tests badly on touch; spawner buildings with heat ([[Concept C]]) parked as a possible mode.
- **Consequences:** [[Concept B]] becomes the base design; Concept A and C notes get `status: parked`. Theme stays open (B2), deferred until a placeholder renderer exists.
- **Rewind:** High after M1 of the toolkit plan. Mitigation: pathing, economy and offers are separate sim modules; swapping the spatial module for wall pieces keeps the economy and toolkit intact.
