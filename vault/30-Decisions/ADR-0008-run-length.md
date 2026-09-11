---
id: 4F33D4F3-1CDB-49C1-9C0F-A224DB0C28B8
created: 2026-09-11T01:28:06Z
modified: 2026-09-11T01:28:06Z
tags: [adr, decision, stratum-3, pacing]
---
# ADR-0008 Runs last 25-30 minutes at 1x

- **Status:** accepted (2026-09-11)
- **Closes branch:** [[Branch Register]] B11 (session length). Resolves Q2 in [[Open Questions]].
- **Decision:** A full run is designed for **25-30 minutes at 1x speed**. Wave count, offer cadence and economy curves are tuned to that length. Speed control ([[ADR-0007-real-time-with-speed-control]]) lets experienced players compress it.
- **Consequences:** With ~30 s waves that is roughly 40-50 waves per run, or fewer, longer waves across 3-4 floors as in [[Concept B]]. The toolkit measures run length as a first-class output (P50 minutes at 1x with the `greedy` policy) and flags drift.
- **Rewind:** Moderate; economy curves are data, not code.
