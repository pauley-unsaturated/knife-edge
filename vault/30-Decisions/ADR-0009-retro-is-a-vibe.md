---
id: C921E0A5-AAD0-4F66-9EE4-9163DDE90079
created: 2026-09-11T01:28:06Z
modified: 2026-09-11T01:28:06Z
tags: [adr, decision, stratum-3, art]
---
# ADR-0009 Retro is a vibe, not a hardware constraint

- **Status:** accepted (2026-09-11)
- **Amends:** constraint C2 in [[Constraints]]. Resolves Q5 in [[Open Questions]]. Narrows B12 (art pipeline).
- **Decision:** "8-bit" means the look and feel (low resolution, chunky pixels, limited palettes, chiptune), **not** strict NES hardware limits. Fun comes first. Sprite-per-scanline limits, 4-color sprite palettes and 8x8 attribute rules are references for the art direction, not rules the engine enforces.
- **Consequences:** The renderer can draw as many enemies and projectiles as real-time mazing produces ([[ADR-0007-real-time-with-speed-control]]). Pixellab prompts can use a curated retro palette (NES- or SNES-derived) without forcing per-sprite 3+1 sub-palettes. The research on hardware limits in [[Research - TD Mechanics Taxonomy]] stays as flavor guidance.
- **Rewind:** Free. Tightening toward strict NES later is an art-direction choice with no engine impact.
