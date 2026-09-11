---
id: 7CD9F141-F7D1-4DF9-AD4E-815F69CC6F40
created: 2026-09-10T05:41:30Z
modified: 2026-09-10T05:41:30Z
tags: [questions, stratum-0]
---
# Open Questions

*Stratum 0/1. Questions not yet answered by the brief or research. Promote to the [[Branch Register]] when they become a real fork.*

**All seven answered on 2026-09-11.** Answers are recorded as ADR-0006 through ADR-0011; the original questions stay below for history.

- Q1. **Answered: web is required and primary** ([[ADR-0006-web-primary-cursor-first]]). Is web a must-ship or a nice-to-have? Affects engine choice weight. (Currently: strongly desired, not required.)
- Q2. **Answered: 25-30 min, with headless fast-forward for validation** ([[ADR-0008-run-length]], [[ADR-0007-real-time-with-speed-control]]). Session length target: 10-minute runs (mobile) or 45-minute runs (desktop roguelike)? Drives wave count and economy pacing.
- Q3. **Answered: cursor-first, no hover dependency** ([[ADR-0006-web-primary-cursor-first]]). Input model: touch-first (tap to place, no hover) constrains tower UI and mazing ergonomics. Does the NES feel imply a cursor/d-pad UI even on touch?
- Q4. **Answered: real-time with speed control** ([[ADR-0007-real-time-with-speed-control]]). Real-time with speed control, or phase-based (build phase / battle phase like Rampart)? Phase-based is easier to balance and reads better on a small screen.
- Q5. **Answered: vibe, not a hard limit** ([[ADR-0009-retro-is-a-vibe]]). Does "8-bit" mean strict NES palette compliance (Pixellab palette constraints) or just the vibe?
- Q6. **Answered: premium, sold once** ([[ADR-0010-premium]]). Monetization: premium one-time purchase is assumed. Confirm.
- Q7. **Answered: tracker music, synthesized SFX, lowest priority** ([[ADR-0011-audio]]). Audio: chiptune tracker (FamiTracker/Furnace exports) or synthesized at runtime?
