# Mechanic lab: Raid/Heat, Compound and Glass Cannon

## Current playable checkpoint: candidate v4

The three frozen files in `candidate-v4/` are shipped unchanged as
`data/game.json`, `data/compound.json`, and `data/pact.json`. The older hypotheses
below explain where exploration started; they are not the current result.

The [diary](DIARY.md) records the rejected easy-clear variants, repaired bot
maze/saving mistakes, upgrade/offer/pressure sweeps, and independent judge loops.
The [driver/judge protocol](LOOP.md) is reusable without an external LLM service.

### Shape and knobs

- 18 waves, 12 core, 120 starting gold. A small first wave; armor joins wave2.
- Enemy budget grows geometrically by18% per wave; base HP by7% in Raid/Pact,
  6% in Compound. Spawn count caps at18 and ordinary bounty stays3 per enemy,
  so the later budget goes into stronger enemies without proportional income.
  There is no special wave12 difficulty jump.
- Easy/Medium/Hard change defense prices to70/100/125%; boards and enemies match.
- First drop afterwave2, then every3 waves; choose one of two. Weighted rarity,
  modest duplicate status bonuses and gold rerolls (25,40,64; max3 per offer).
- Six-level Ember upgrades now grow damage2.2× instead of2.4×. Supports have
  three levels and prefer fresh coating targets. Water boosts Arc and Frost;
  oil is consumed by Ember to ignite a burn. Poison, Black Ice, Mutiny and
  death bursts stack with explicit duration, strength and cap rules.
- Compound and Glass Cannon omit the Raid jackpot/explosion shortcut. Investment
  and low-core play are opportunities, not mandatory classes: other coherent
  builds may win. All lab tunables live in their JSON, not renderer constants.

### Validation, not a subjective fun certificate

The frozen v4 test ran1512 games on unseen boards201–240 plus board7 with
loot offsets10001–10024. Every replay verified with zero rejected commands or
timeouts; source/config hashes remained unchanged. Full P5/P50/P95 distributions,
confidence intervals, early leaks and fingerprints are tracked in
[heldout-v4-summary.json](heldout-v4-summary.json).

| Expert/oracle-assisted | Easy wins/40 | Medium wins/40 | Hard wins/40 |
|---|---:|---:|---:|
| Raid/Heat |39|33|16|
| Compound |39|31|8|
| Glass Cannon |40|25|12|

The same strategic family at four-second cadence won Medium29/29/24 and
Hard12/4/11 respectively. Prepared reroll budgeting won Medium32/27/26: saving
is not automatically better. Neutralized Arc/Ember drop controls won1/240;
their median cleared waves were9–10. This is not an exhaustive no-combo solver.

On a fixed board, varied loot gave prepared wins22/24 Raid,16/24 Compound,
8/24 Pact. Loot matters, but the favorable Raid board is not a rare-win scenario.
The old apprentice remained too myopic to stand in for a reasonable novice;
a separate offer-led learner was evaluated on fresh301–340 boards without
changing frozen game rules. Its360 verified games won Easy/Medium/Hard
38/27/12 Raid,34/12/2 Compound,33/14/3 Pact. See
[LEARNER-V1.md](LEARNER-V1.md) and the final judge assessment.

The [current keeper directory](keepers/v4/README.md) preserves positive and
negative exact causal witnesses, including a paid-reroll rescue. The judge
supports poison/Ember, Conductive/Arc, death bursts, investment, low-core recovery
and sacrifice for human trials. It does not independently establish Mutiny or
coating necessity, repeated Compound god-runs, or actual human enjoyment.
Historical keepers in the parent directory retain their embedded older rules.

### Reproduce

```sh
pnpm validate:balance
pnpm exec tsx experiments/0004-raid-heat/validate-engines.ts experiments/0004-raid-heat/candidate-v4 201 40 repeat-v4
pnpm exec tsx experiments/0004-raid-heat/v4-witnesses.ts
pnpm balance replay --file experiments/0004-raid-heat/keepers/v4/FILE.replay.json
```

For the prepared/loot subset use `validate-engines.ts`'s explicit profile and
loot options; invocation metadata is embedded in the aggregate's batch files.
Use a new output label when reproducing—never overwrite earlier evidence.
Bulk per-run output is ignored; compact summaries and selected embedded-rules
replays are tracked. Source commit before this work was
`3993cdebe83cf83f7dbb1d0b5cd1ea36b083a342`; final checkpoint tags capture the
implementation, while the validation manifest pins exact source hashes.

## Original hypotheses (historical starting point)


1. A small tutorial wave followed by denser, faster-scaling encounters should
   eliminate the seed-7 human opening's long unattended survival.
2. Trading removal of one enemy type and an immediate jackpot for permanent
   pressure creates a purchase/timing decision missing from demo-1.
3. Ordinary no-patch/no-raid play should typically stop around waves 12–15 on
   Medium; deliberate synergy policies should demonstrate passage beyond that
   wall and at least one reproducible full clear. Easy/Medium/Hard remain ordered
   by affordability. A perfect first wave should be reliable with a sensible build.
4. Frequent strong patches, especially cold damage and death explosions, should
   reward deliberate build identity. Raiding every hideout should not be assumed
   better: compare no raids, immediate raids, and selective/timed raids.

Targets are provisional: Medium ordinary P50 10–15 waves cleared, full-clear
rate at most 20%; no-action-after-opening human witness fails by wave 4; frozen
midgame defenses cannot routinely coast to a perfect clear. Measure P5/P50/P95
over tuning seeds and disjoint validation seeds; replay-check every reported run.
Failure rates alone cannot establish fun or a solved minimum defense margin.

Base sim commit `3993cdebe83cf83f7dbb1d0b5cd1ea36b083a342` plus uncommitted demo
and raid-heat implementation; original human data `demo-1/medium`. Explore
candidate overrides here before updating `data/game.json`. See
[[ADR-0016-raid-heat-prototype]] for the bounded mechanic change.
