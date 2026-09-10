---
id: 7E4C3E66-F99B-46AA-932D-8D1DC0EA614F
created: 2026-09-10T05:50:46Z
modified: 2026-09-10T05:50:46Z
tags: [adr, decision, stratum-3, stack]
---
# ADR-0005 Stack: TypeScript sim core, Phaser 4 renderer, Capacitor iOS shell

- **Status:** accepted (2026-09-10). The user delegated the pick ("no preference, choose for iOS + web + headless"); this ADR records the choice made under [[ADR-0004-stack-selection-rubric]]. Ratify or rewind after reading [[Research - Engines and Art Pipeline]].
- **Closes branch:** [[Branch Register]] B3
- **Decision:**
  - `packages/sim`: pure TypeScript, no DOM, no engine imports. Fixed timestep, integer/fixed-point math, injected seeded PRNG (PCG32). Exposes `step(state, commands)` and an event stream of render intents.
  - `packages/render-phaser`: Phaser 4 adapter. 256x224 virtual canvas, nearest filtering, integer zoom. Placeholder atlas (colored rectangles + text) until the Pixellab pass.
  - `apps/web`: Vite shell. `apps/ios`: Capacitor shell, built only on the Mac mini.
  - `tools/balance`: Node CLI importing the same `sim` package; runs seeds x policies x parameter sweeps; emits JSONL/CSV; vitest snapshot and invariant tests in CI on Linux.
- **Why over the alternatives:**
  - Go + Ebitengine (rank 2) is a near-equal on every criterion except web payload and UI/IAP ecosystem; it remains the designated rewind target.
  - Godot 4.7 GDScript (rank 3) has the best editor and pixel-perfect defaults, but the sim would live inside the engine, making thousands-of-runs sweeps slow and tests engine-hosted, which conflicts with C4.
  - Everything else fails a hard requirement (web, agent/CI friendliness, or maturity).
- **Accepted costs:** iOS ships as a WKWebView app; integer scaling and letterboxing are hand-written; WebGL perf in WKWebView must be checked early on a real device.
- **Rewind:** High once the sim exists, but *bounded*: the sim is engine-free, so a rewind to Go/Ebitengine is a port of one package plus a new adapter, not a rewrite of game logic. A rewind to Godot would keep the sim as a reference implementation for golden-run parity tests.
