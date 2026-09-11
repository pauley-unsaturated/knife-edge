---
id: 1FEF131D-C691-4E6F-BA7D-8091C9DFE795
created: 2026-09-11T01:28:06Z
modified: 2026-09-11T01:28:06Z
tags: [adr, decision, stratum-3, time-model]
---
# ADR-0007 Real-time with speed control, and the sim must fast-forward headlessly

- **Status:** accepted (2026-09-11)
- **Closes branch:** [[Branch Register]] B5 (time model). Resolves Q4 in [[Open Questions]].
- **Decision:**
  - The game is **real-time with player speed control** (pause, 1x, 2x, 4x). Building, selling and re-mazing during a wave are allowed. This is the Vector TD model the brief names; the user wants the hectic feeling it produces.
  - Because balance validation cannot depend on wall-clock play, the simulation core must run **fast-forward and headless**: an unbounded-speed step loop in Node for the agent swarm, and an in-browser fast-forward (8x or instant-to-wave-end) for humans. Same code path, same results, by construction (fixed timestep, seeded RNG, no wall-clock reads).
- **Alternatives:** phase-based build/battle (Rampart, [[Concept A]]): rejected as the base model; it stays the rewind target if real-time mazing tests badly on touch. A hybrid with pause windows was considered and is unnecessary given full pause.
- **Consequences:** the balance invariants in [[Balance Toolkit Plan]] must model mid-wave actions, so bot policies get an `act-during-wave` capability rather than acting only at wave start. Sprite counts are unbounded by phases, so the renderer needs a hard cap or flicker strategy; see [[ADR-0009-retro-is-a-vibe]].
- **Rewind:** High once the sim exists. Mitigation: the sim exposes wave boundaries as events, so a phase-based mode is a policy over the same core rather than a second engine.
