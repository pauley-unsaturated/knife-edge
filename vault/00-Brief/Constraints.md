---
id: 07546349-6218-4640-B093-6F23999D626A
created: 2026-09-10T05:41:23Z
modified: 2026-09-10T05:41:23Z
tags: [constraints, stratum-0]
---
# Constraints

*Stratum 0. Hard constraints derived from the [[Brief]]. Each is either a goal we optimize for (G) or a rule we cannot break (R).*

| # | Kind | Constraint | Why |
|---|---|---|---|
| C1 | R | Ships on iOS. Web is strongly desired. | Brief |
| C2 | R | 8-bit/16-bit throwback: low native resolution, limited palette, tile-based, chiptune. | Brief |
| C3 | G | Knife-edge balance is the signature feeling. | Brief, Vector TD reference |
| C4 | R | Balance must be tunable by tooling, not only by feel. Simulation core must run headless, deterministic, and fast. | Brief; also the AI-agent dev loop runs on Linux without a GPU |
| C5 | R | Placeholder graphics until mechanics and balance are proven. | Brief |
| C6 | G | Run-based roguelike with meta unlocks. | Clarification |
| C7 | R | Design history is preserved in this vault; decisions are ADRs with rewind notes. | Mid-session ask |
| C8 | G | Small team (one developer + AI agent). Prefer text-based project files, CLI builds, and unit-testable logic. | Practical |

## Derived architectural rule

**The simulation is a library; the game is a client of it.** Renderer, input, audio, and platform shells depend on the sim; the sim depends on nothing. The balance CLI is a second client of the same sim. This is the same "lift logic out of views" discipline PunkRecords uses, applied to a game.

## Amendments (via ADR, newest last)

- 2026-09-11 [[ADR-0009-retro-is-a-vibe]] amends **C2**: retro is the look and feel, not enforced hardware limits.
- 2026-09-11 [[ADR-0006-web-primary-cursor-first]] sharpens **C1**: web is required and is the primary iteration target; iOS follows.
- 2026-09-11 [[ADR-0007-real-time-with-speed-control]] sharpens **C4**: the sim must fast-forward headlessly at unbounded speed for the agent swarm, and in-browser for humans, on one code path. Add **C9 (R):** the human validates the balance pipeline, not only its outputs: every bot claim must be reproducible as a watchable replay.
