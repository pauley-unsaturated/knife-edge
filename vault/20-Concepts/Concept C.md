---
id: 14773078-D151-45C9-B519-EFE8BD6464BD
created: 2026-09-10T05:46:48Z
modified: 2026-09-10T05:46:48Z
tags: [concept, stratum-2, spawners, 80s-action]
---
# Concept C — Block Party (working title)

- **status:** alive
- **theme lane:** 80s action, *Bad Dudes* / *River City Ransom* / *Double Dragon* street brawler
- **one line:** Gangs pour out of hideouts across a scrolling city block. You post your crew on the street corners, and every hideout you raid for cash makes the rest of them angrier.

## Chassis (B4 spatial, B5 time)

- **Fixed paths with build slots**: the city block is a side-scrolling map of streets (a 3-4 screen wide strip, 256x224 per screen). Enemies walk the streets toward your **hangout** at the far end. Crew members (the towers) are placed on **corners and rooftops**, fixed slots like Kingdom Rush, so touch and pad both work trivially.
- **Real-time with a hero.** You also control a **dude** who walks the street and punches. The hero is a mobile, weak tower that can *also* raid hideouts. This is the *Protect Me Knight* / *Gotta Protectors* chassis, which is the most NES-native TD hybrid that exists.
- The block is **procedurally assembled from screen-sized chunks** (each chunk has slots, a street segment, and 0-1 hideout), Spelunky-style, so layouts are new per run but always well-formed.

## What generates the mobs (B6)

- **Spawner buildings.** Each **hideout** produces enemies continuously on its own clock and type table (a dojo emits ninjas, a garage emits bikers, a nightclub emits bouncers). Waves are not scripted; the map's hideout set *is* the wave design.
- **Raid or contain.** The hero can raid a hideout (a short timed mini-fight). Raiding shuts it down and pays a jackpot. But every remaining hideout gains **heat** (spawn rate and tier up). This is the run's central push-your-luck: shut down early for safety, or keep the income flowing and let the block get hotter. Dome Keeper's "waves scale with what you mined" made into geography.
- **Boss bosses:** clearing enough hideouts summons the block's boss from the end of the street, walking the full path.

Enemy tags: **biker** (fast, skips slots' short range), **suit** (armored), **ninja** (dodges the first hit from each crew member), **DJ** (buffs nearby), **truck** (carrier, spawns on death).

## What defeats them (B8)

- **Crew members** in slots, each with **two upgrade branches** (Kingdom Rush style, kept to 3 tiers) so there is build identity without a combinatorial explosion:
  - Bouncer (block and slow) · Boombox (AoE stun) · Skater (fast, weak) · Sharpshooter on rooftop (long range) · Mechanic (drops oil, chain-slow) · Promoter (income per enemy that passes, no damage; the greed tower).
- **Hero moves** are bought like towers: dash, spinning kick, thrown trash can. The hero's damage stays low so slots matter.
- Slots have **cover quality**: a rooftop slot gives range, a corner slot gives AoE bonus, so slot choice is the mazing-equivalent decision.

## Economy and the knife edge (B7)

- Income: kill bounties (small) + **hideout jackpots** (large, once) + **protection money** per screen you keep clean over a time window (an interest-like reward for holding).
- The knife edge is **heat**: the toolkit tunes the heat curve so that the "raid everything now" and "raid nothing" policies both lose, and the winning band is a specific, narrow raid schedule that shifts per generated block.

## Run structure (B11)

- A run is **4 blocks** of a city (neighbourhoods as biomes), ~25 minutes. Between blocks: recruit 1 of 3 crew, buy a move, or take a "favor" (relic). Hangout destroyed = run over.

## Meta progression (B9)

- Unlocks widen the crew roster, hero moves, hideout types (which changes what the generator can produce), and neighbourhoods. Mutators for difficulty.

## NES feasibility

High for the presentation (it is literally the NES brawler look) but the sprite budget is the tightest of the three: hero + crew shots + enemies on a scrolling screen. Crew members can be background tiles with a sprite only when they attack. Scrolling means the player sees one screen at a time; a minimap strip on the HUD shows the whole block, which is itself very NES.

## Risks

- Two control loops (hero + placement) can split attention badly on touch. Mitigation: the hero auto-walks along the street; touch only chooses where.
- Spawner-based generation is harder to tune than scripted waves; the toolkit must simulate whole blocks, not single waves.
- The 80s theme is the most charming and the least like other TDs on the market, which is either the strongest hook or the weakest genre signal.

## Balance tooling it needs

The most demanding: a **block generator**, a **raid-schedule policy bot** (when to raid which hideout), and a hero movement model. Sweeps over heat rate x jackpot size x protection-money window. This concept most needs the "solver ceiling" approach because there are no discrete waves to balance one at a time.

## Branch choices implied

B2 80s action · B4 fixed slots on scrolling streets · B5 real-time + hero · B6 spawner buildings + heat · B7 jackpots + protection money + heat · B8 branching crew upgrades · B10 touch needs auto-walk hero · B11 ~25 min.
