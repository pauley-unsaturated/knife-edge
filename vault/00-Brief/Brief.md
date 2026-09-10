---
id: A22488A1-6CB7-4A3A-B8B6-46683D318EFD
created: 2026-09-10T05:41:23Z
modified: 2026-09-10T05:41:23Z
tags: [brief, stratum-0]
---
# Brief

*Stratum 0. Frozen. The user's original ask, lightly structured. Amend via ADRs, not edits.*

## The ask (2026-09-10)

Design a **rogue-like tower defense** game as an **8-bit throwback**, something that could plausibly have existed on the NES or SNES.

**Theme is open.** Candidates named: fantasy; cyberpunk / Japanese futurism; "Bad Dudes" 80s action.

**Deliverable for this pass:** a few concepts, each specifying
1. what generates the mobs,
2. what weapons/towers defeat them,
3. what the progression strategy looks like.

**Research asks:**
- Survey the main tower defense mechanisms. Reference point: *Vector Defense* (Vector TD), a labyrinth game where towers sit along maze walls and the fun came from **razor-thin margins**: enemy power, resource gains, and tower upgrade power balanced on a knife edge.
- Look up prior art on **tools for very tight game balancing**, since we may need to build such tools.

**Art:** user has a Pixellab subscription and can furnish an API key. During development, **cheap out on graphics** so mechanics and balance get worked out first.

**Platform:** any dev environment, but we need a plan for **iOS** and possibly **web**, so the engine must allow plugging in that way.

**Process (added mid-session):** keep a **vault** for explorations, segmented and stratified as design directions narrow, tracking major decisions and the branch points where we could rewind and do things differently.

## Clarifications answered

| Question | Answer |
|---|---|
| Where does work live? | New private GitHub repo `pauley-unsaturated/knife-edge` |
| Which "roguelike"? | Run-based with meta unlocks: procedurally generated map per run, randomized tower/relic offers, loss ends the run, unlocks between runs |
| Scope of this pass | Concepts + research + stack recommendation; no code yet |
| Stack bias | None; choose for iOS + web + headless balance simulation |

See [[Constraints]] for the hard constraints derived from this, and [[Branch Register]] for what remains open.
