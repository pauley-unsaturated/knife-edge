---
id: 8F5F4962-D2F4-4D1C-9946-A124E65F58CE
created: 2026-09-10T05:46:48Z
modified: 2026-09-10T05:46:48Z
tags: [concept, stratum-2, rampart, fantasy]
---
# Concept A — Bulwark (working title)

- **status:** alive
- **theme lane:** fantasy (castle siege), NES-authentic
- **one line:** Rampart's build/battle/repair loop rebuilt as a roguelike island chain, where enclosed territory is your income and every hole in the wall is money bleeding out.

## Chassis (B4 spatial, B5 time)

- **Phase-based**, not real-time. Each wave is a fixed cycle: **Draw and Build** (timed) → **Siege** (auto-resolving battle, ~15 s) → **Repair** (timed, same piece draw). Phases fit a small screen and touch: no hover, no frantic real-time placement.
- **Grid: 16x16 tiles on a 16x12 play field** (256x192 plus a 32-px HUD strip = 256x224). Walls and towers are background tiles; only enemies and shots are sprites, which respects the NES 8-per-scanline budget.
- **Walls come from a piece draw** (1x1 through plus and U shapes, Rampart-style). Enclosing a keep captures territory. Towers can only be placed inside enclosed territory. **Territory area is capacity**: you cannot out-build your walls.

## What generates the mobs (B6)

Two generators layered:
1. **The Fleet**: an authored-but-parameterised siege escalation per island. Each wave is a *budget* (see [[Research - Balancing Tooling]]) spent by a wave composer on ships (ranged, punch holes in walls), landers (deliver grunts), and rams (walk to the wall and chew).
2. **Grunts persist.** Landed grunts stay on the field across phases, block piece placement during Build, and walk toward the keep. They are the roguelike's "damage that carries over": a bad Siege does not just cost HP, it costs *build space next phase*.

Enemy tags for counter-play: **armored** (halves ballista damage), **swift** (crosses open ground in one phase), **sapper** (breaks walls from inside if not killed), **carrier** (spawns grunts on death), **flying** (ignores walls; only towers with anti-air can hit).

## What defeats them (B8)

Towers are placed inside walls and fire automatically during Siege. Six base towers at launch, flat 3-level upgrades, plus **targeting priority** (near, far, strongest, sapper-first) as the free strategic lever:

| Tower | Role | Counter to |
|---|---|---|
| Ballista | single-target, long range | ships |
| Cauldron | short AoE, ignores armor | grunt clumps |
| Archer post | fast, weak, anti-air | flying, swift |
| Catapult | slow, wall-piercing arc | rams, carriers |
| Bell tower | slow aura, no damage | everything (support) |
| Mason's lodge | +1 draw piece per phase, no damage | economy |

Relics (roguelike offers) modify towers: "Ballista bolts pierce", "Walls regrow 1 tile per phase", "Grunts drop gold."

## Economy and the knife edge (B7)

- **Income = enclosed tiles at end of Siege** (Thronefall's houses, made spatial). Not kill bounties. This makes wall damage directly economic: a breach shrinks next phase's income until repaired.
- **Repair competes with expansion** for the same piece draw and the same clock.
- **Interest**: unspent gold earns a rate at the start of each Build phase. The rate is upgradable with rare *charter* offers, which is the Vector TD tension: bank or build.
- Knife edge target: at par play, income minus minimal-viable-defense cost sits at a small positive margin every wave (a tunable percentage), with the margin narrowing on boss islands. The balance toolkit sets this from a solver baseline rather than by feel.

## Run structure (B11)

- A run is a **chain of 5-7 islands** (Bad North map), each 6-10 waves, ~25-35 minutes total. Between islands: pick 1 of 3 offers (tower, relic, charter, or piece-pool change).
- Losing the last keep ends the run. Keeps you captured on other islands do not save you; the roguelike stakes are real.

## Meta progression (B9)

- Unlocks widen pools only: new tower types, new relics, new piece shapes, new island biomes with different generators (e.g., a swamp island where rams are replaced by sappers). No stat inflation, per [[ADR-0002-roguelike-flavor]].
- **Guilds** (Isle of Arrows) as run modifiers that change the rules: e.g., Masons (bigger draws, no interest), Bankers (double interest, walls cost gold).

## NES feasibility

Very high. Rampart shipped on the NES. Walls/towers are tiles; sprite count is bounded by the wave budget; phases mean no scroll during battle. Audio: 2 pulse + triangle + noise chiptune, one DPCM hit for wall-breach.

## Risks

- Draw luck can feel unfair; mitigate with Isle of Arrows-style guaranteed ratios and a pay-to-reroll.
- Phase-based can feel slow on desktop; a 2x/skip control for Siege fixes most of it.
- Rampart is a known quantity; the roguelike layer must add real decisions (offers, grunt persistence, interest) or it reads as a remake.

## Balance tooling it needs

Territory-based income makes the wave budget interact with map geometry. The sim must run **build policies** (greedy enclosure bots) against generated islands to find the achievable-income ceiling per wave, then set wave budgets as a fraction of that. Piece-draw RNG must be seedable and the draw pool an explicit table.

## Branch choices implied

B2 fantasy · B4 wall-building · B5 phase-based · B6 budgeted fleet + persistent grunts · B7 territory income + interest · B8 flat towers + relics · B10 cursor-first works for both touch and pad · B11 25-35 min.
