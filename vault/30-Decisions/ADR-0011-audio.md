---
id: ED6D4832-FEA7-48EC-AEB3-32CF0051243E
created: 2026-09-11T01:28:06Z
modified: 2026-09-11T01:28:06Z
tags: [adr, decision, stratum-3, audio]
---
# ADR-0011 Tracker-authored music, synthesized sound effects

- **Status:** accepted (2026-09-11)
- **Closes branch:** [[Branch Register]] B15 (audio). Resolves Q7 in [[Open Questions]].
- **Decision:** Music is authored in a chiptune tracker (FamiTracker or Furnace) and exported; sound effects are synthesized at runtime (Web Audio oscillators/noise, jsfxr-style) so they can react to sim events (pitch by enemy tier, tempo by wave pressure).
- **Priority:** lowest of the answered questions. No audio work before the toolkit milestones M0-M2 in [[Balance Toolkit Plan]].
- **Rewind:** Free.
