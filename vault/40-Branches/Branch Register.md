---
id: F8F49F78-E674-4922-BCDB-0B9F5492FD5D
created: 2026-09-10T05:42:42Z
modified: 2026-09-10T05:42:42Z
tags: [branches, register, stratum-4]
---
# Branch Register

*Stratum 4. Every fork in the road. A branch is `open`, `chosen` (link the ADR), or `parked`. Rewind cost is an estimate of how much downstream work a reversal invalidates: free / low / moderate / high.*

| ID | Fork | Options | State | Rewind cost |
|---|---|---|---|---|
| B0 | Project home | dedicated repo / PunkRecords docs folder / artifact only | chosen: [[ADR-0001-project-home]] | free |
| B1 | Roguelike flavor | run-based + meta / pure permadeath / procedural map only | chosen: [[ADR-0002-roguelike-flavor]] | moderate |
| B2 | Theme | fantasy / cyberpunk-Japan futurism / 80s Bad Dudes action / other | **deferred** (user, 2026-09-11) until a placeholder renderer exists | low until art starts, high after |
| B3 | Engine and stack | TS sim + Phaser 4 + Capacitor / Go + Ebitengine / Godot 4 GDScript | chosen: [[ADR-0005-stack]], ratified by [[ADR-0006-web-primary-cursor-first]] | high once sim exists; bounded by engine-free sim |
| B4 | Core spatial mechanic | mazing on open grid / fixed path with build slots / Rampart-style wall building / lane defense | chosen: [[ADR-0012-mazing-and-economy]] | high |
| B5 | Time model | real-time with speed control / phase-based build then battle / turn-based ticks | chosen: [[ADR-0007-real-time-with-speed-control]] | high |
| B6 | Mob generator | scripted waves / procedural wave budget / player-sent enemies / spawner buildings | chosen: [[ADR-0013-wave-composer-and-towers]] | moderate |
| B7 | Economy signature | interest on banked gold / kill bounties / wave-clear bonus / early-send bonus | chosen: [[ADR-0012-mazing-and-economy]] | moderate (this is the knife edge itself) |
| B8 | Weapon system | flat upgrades / element combination / gem socketing / synergy tags | chosen: [[ADR-0013-wave-composer-and-towers]]; numbers are M1 sweep targets | moderate |
| B9 | Meta progression | unlock pool widening / stat inflation (forbidden by ADR-0002) / cosmetic only | narrowed by ADR-0002 | low |
| B10 | Input model | touch-first / cursor-first (NES feel) / both | chosen: [[ADR-0006-web-primary-cursor-first]] | moderate |
| B11 | Session length | 10-min mobile runs / 25-30-min runs / 30-45-min desktop runs | chosen: [[ADR-0008-run-length]] | moderate |
| B12 | Art pipeline | Pixellab API automated / Pixellab manual + Aseprite / hand-drawn | open; deferred by C5; palette rules relaxed by [[ADR-0009-retro-is-a-vibe]] | low |
| B14 | Monetization | premium / F2P / demo + premium | chosen: [[ADR-0010-premium]] | free |
| B15 | Audio | tracker music + synth SFX / all synth / all sampled | chosen: [[ADR-0011-audio]] | free |
| B13 | Balance tooling depth | spreadsheet only / headless Monte Carlo / solver-based difficulty ceiling | narrowed to solver-based ceiling; plan in [[Balance Toolkit Plan]]; ADR pending | moderate |

## Parked directions

- Concept C's spawner-and-heat generator: parked as a possible mode, not the base chassis. See [[Concept Evaluation]].
- Concept A's wall-piece territory income: parked; designated rewind target for B4 per [[ADR-0012-mazing-and-economy]].
- Element/gem combination towers: parked for a post-launch expansion per [[ADR-0013-wave-composer-and-towers]].

## How to rewind a chosen branch

1. Read the ADR's **Rewind** section.
2. Write a new ADR with `supersedes:` the old one. Do not edit the old one.
3. Flip the row above and add a line in [[Session Log]].
