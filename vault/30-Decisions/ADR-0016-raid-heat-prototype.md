---
id: 908c7fa6-2842-4e90-878d-063e4a37571e
created: 2026-09-11T06:00:00Z
tags: [adr, decision, stratum-3, playtest]
supersedes: [ADR-0012-mazing-and-economy, ADR-0013-wave-composer-and-towers, ADR-0008-run-length]
---
# ADR-0016 Raid-and-heat pressure prototype

- **Status:** accepted for an experimental playable iteration, following the
  user's request to try a more flavorful earlier concept and hit a wall around
  waves 12–15 unless an overpowered strategy emerges.
- **Reopens/amends:** B6, B7, B8, B11. The supersession is limited to the prototype;
  B4 mazing and B5 real-time speed control are retained. Theme/art stay deferred.
- **Decision:** borrow [[Concept C]]'s raid-or-contain loop. Three named hideouts
  supply enemy types. Between waves, a one-time raid pays a jackpot and removes
  that type from future composition, but permanently increases the remaining
  enemies' HP and spawn pressure. The basic grunt source cannot be raided.
  No hero, scrolling city or raid minigame in this experiment: the decision is
  exposed directly with its exact consequences before clicking.
- **Pressure curve:** a forgiving first wave, materially pressured second/third,
  ordinary strategies generally failing around 12–15, and powerful patch/build
  synergies creating a route beyond that wall. Eighteen waves make a compact
  prototype; the former 25–30 minute target is suspended for this playtest.
- **Build identity:** earlier, stronger stacking offers and an on-kill explosion
  patch support cold/cluster/chain-reaction builds. Do not fully counter patch
  power. Validate a genuinely playable successful line, not only bot failure.
- **Alternatives:** tune only tower prices (does not create new decisions);
  rebuild full Concept A or C chassis immediately (too many simultaneous changes
  to attribute fun); require fast execution (conflicts with accessible pause).
- **Consequences:** old replays retain their embedded rules and exact hashes.
  New raid state/commands enter deterministic replay and validation. Frozen
  defense survival and strategy comparisons replace the obsolete demo win bands.
  These measurements are regression evidence, not proof that the prototype is fun.
- **Rewind:** remove optional raid/composer/patch fields from new-run data to
  restore the previous mechanic set. Keep the original human replay and reports.
