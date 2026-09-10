---
id: AFD58E42-177F-48A4-8559-7CF2EDA64522
created: 2026-09-10T05:41:56Z
modified: 2026-09-10T05:41:56Z
tags: [adr, decision, stratum-3]
---
# ADR-0004 Stack is chosen by criteria, not preference

- **Status:** accepted (2026-09-10)
- **Closes branch:** none; sets the rubric for B3 (engine/stack), which a later ADR closes
- **Decision:** No language or engine bias. Rank candidates by, in order: (1) iOS export maturity, (2) headless deterministic simulation on Linux for the balance loop, (3) web export maturity, (4) AI-agent friendliness (text project files, CLI build, unit tests), (5) pixel-perfect low-res rendering, (6) licensing.
- **Rewind:** Free until B3 is closed.
