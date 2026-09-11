---
id: ED36204F-2368-4675-81A1-7314BAEAAF36
created: 2026-09-11T01:28:06Z
modified: 2026-09-11T01:28:06Z
tags: [adr, decision, stratum-3, platform, input]
---
# ADR-0006 Web is the primary target; cursor-first input with no hover dependency

- **Status:** accepted (2026-09-11)
- **Closes branch:** [[Branch Register]] B10 (input model). Also resolves Q1 and Q3 in [[Open Questions]] and **ratifies [[ADR-0005-stack]]**.
- **Decision:**
  - Web is required, not optional. It is the primary development and iteration target because the agent can build, run and test it fastest. iOS and other ports follow once the game is proven fun.
  - Input is **cursor-first**. One control scheme (pointer, keyboard, gamepad d-pad) drives a cursor over a coarse grid. No mechanic may depend on hover. If a hover affordance is ever used (range preview, tooltip), its touch equivalent is touch-down to show, touch-up outside the target to dismiss without acting.
- **Alternatives:** touch-first design (rejected: web is primary and a cursor ports cleanly to touch, the reverse does not); dual input schemes (rejected: doubles UI testing surface).
- **Consequences:** ADR-0005's accepted cost (iOS as a WKWebView app) is now the plan of record, not a compromise. Range previews and tower info must work on tap/click, with hover as an enhancement only.
- **Rewind:** Low for the input rule; high for the web-primary choice once the renderer exists.
