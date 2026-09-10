---
id: 9B7D4553-B5DD-4AEA-84BF-48B9774DBD45
created: 2026-09-10T05:46:48Z
modified: 2026-09-10T05:46:48Z
tags: [concept, stratum-2, mazing, cyberpunk]
---
# Concept B — ICE (working title)

- **status:** alive
- **theme lane:** cyberpunk / Japanese futurism, neon on black (the Vector TD look, made diegetic)
- **one line:** You are the sysop of a mainframe under intrusion. Towers are ICE programs, the maze is the circuit board you route packets through, and the only real decision is whether to spend now or let your credits compound.

## Chassis (B4 spatial, B5 time)

- **Open-grid mazing** (Desktop TD / Vector TD): the board is a 20x14 grid of 12x12 cells (240x168 play area inside 256x224). Packets enter at an input port and path by shortest route to the core. ICE nodes are solid; you build the maze out of your own defenses. Full-block is illegal (the classic rule), so juggling is the expert move.
- **Real-time with pause and 1x/2x/4x speed.** Building during a wave is allowed; that is where the skill ceiling lives. On touch, tap-to-place with a confirm; on pad, a cursor.
- Each **floor** (run stage) is a procedurally generated board: fixed input/core positions, random obstacle blocks and "conduits" (cells that boost adjacent ICE), so mazes cannot be memorised across runs.

## What generates the mobs (B6)

- **The Net** sends waves from a **budget-driven wave composer**: each wave has a budget that grows geometrically by a tuned rate; the composer spends it on packet types subject to floor rules (no flyers before wave 8, at most one boss per 10, etc.).
- **Overclock (call early)**: the player can trigger the next wave at any time; doing so pays a **credit bonus proportional to the seconds skipped** (Kingdom Rush) *and* those credits arrive before the interest tick. This is the second knife edge: greed on time, not just on money.
- Packet tags: **encrypted** (ignores slow), **fragmenting** (splits on death), **airborne** (ignores maze), **shielded** (flat armor), **stealth** (invisible to ICE without a scanner in range), **worm** (heals nearby packets). Bosses are each tag's exaggeration.

## What defeats them (B8)

- ICE programs with **flat 10-level upgrades** (Vector TD's linear ladder, which makes cost curves legible and balance tractable) plus one **overclock slot** each for a relic-like "patch."
- Damage types vs. tags rather than an element wheel: kinetic, thermal, logic (slow), scanner (reveal), burst (AoE), chain (jumps). Seven ICE at launch; meta unlocks widen to ~15.
- **Targeting priority** is a first-class control: first, last, strongest, weakest, and *most-upgraded-ICE-in-range* handoffs.
- Sell refund is 75% and **selling during a wave is allowed**, which makes juggling and re-mazing an economic act.

## Economy and the knife edge (B7)

- Kill bounties: `base + wave` credits (Vector TD's `$4 + wave`).
- **Interest on banked credits at the start of every wave**, starting low and purchasable upward through rare offers. The entire run is a tug between compounding and defending. This is the single most-cited source of the "knife edge" feel in [[Research - TD Mechanics Taxonomy]].
- Explicit tuning invariant: at wave N, the *cheapest* ICE set that clears wave N with zero leaks must cost within a small band of the credits a par player has at wave N. The band is the difficulty setting. The toolkit computes both sides.

## Run structure (B11)

- A run is **3-4 floors of 12-15 waves**, ~30 minutes. Between floors: pick 1 of 3 offers (new ICE, patch, interest charter, board modifier). Losing the core ends the run.
- Daily seed mode falls out for free from the seeded generator.

## Meta progression (B9)

- Unlocks widen the ICE pool, the patch pool, and floor archetypes (board generators). Difficulty tiers add **mutators** (Thronefall) rather than raising enemy stats: e.g., "no selling", "interest halved", "input port moves every 5 waves."

## NES feasibility

Medium. Dozens of packets plus projectiles will exceed sprite-per-scanline limits on a true NES; the throwback has to cheat: flicker, or cap simultaneous packets (~24) and make projectiles instant "beam" tiles. Neon-on-black actually suits a 4-color palette. This is closer to a SNES title than an NES one.

## Risks

- Mazing on touch is fiddly; the grid must be coarse and placement forgiving.
- Interest economies are famously solvable once a community writes the guide; procedural boards and offers are the countermeasure, and the toolkit must verify that no single dominant line exists.

## Balance tooling it needs

The cleanest fit for the toolkit: fixed path per maze state means the sim is cheap, and interest math is closed-form. Needs a **greedy maze-builder bot** and a **placement search** to estimate the par-player ceiling per wave; a parameter sweep over interest rate x wave growth x bounty to find the narrow band where runs are winnable but not comfortable.

## Branch choices implied

B2 cyberpunk · B4 open-grid mazing · B5 real-time with speed · B6 budget composer + overclock · B7 bounties + interest + early-call bonus · B8 flat ladder + patches · B10 touch and cursor both, with coarse grid · B11 ~30 min.
