---
id: c2eb0691-e64b-4796-a836-fb672748f071
created: 2026-09-11T08:25:00Z
tags: [adr, decision, stratum-3, playtest, balance]
supersedes: [ADR-0015-playable-demo-validation]
---
# ADR-0018 Drop-dependent playtest checkpoint

- **Status:** accepted for the next human trial, not final balance certification.
- **Amends:** B8's provisional validation criterion; B13's ruler remains open.
  The user rejected the old no-decision Medium win and explicitly requested
  drop-led engines that must become overpowered to beat a geometric late wall.
- **Decision:** promote frozen candidate-v4 Raid/Heat, Compound and Glass Cannon
  into the playable lab. Easy is a learning onramp, Medium rewards learning a
  drop-led groove, Hard is for stronger planners. The same board/enemies use
  different defense prices. No new assets or meta progression are required.
- **Important target change:** the historical requirement that a zero-relic
  baseline satisfy a razor-thin margin on every wave is not the acceptance gate
  for this trial. Ordinary defenses are deliberately overtaken; assembled
  engines should win. Keep neutralized-drop controls as diagnostics, not a
  promise that every seed is winnable without a build. The old 3–6% minimum-cost
  margin and sustained 5–10% god-run rate remain unproved, not silently passed.
- **Evidence:** 1512 frozen held-out profile/control/loot runs and360 fresh
  repaired-learner runs, all exact-replay verified with no rejected commands.
  Retain six named causal avenues and one paid-reroll rescue with losing
  alternatives in experiment0004. Judge conclusions are structured evidence for
  human testing, never claims of simulated enjoyment or calibrated human IQ.
- **Limits:** strong oracle-assisted policies often win Medium; favorable Raid
  loot on board7 wins22/24. Pact is more volatile. Easy's first three waves are
  forgiving for the learner. Coating and Mutiny necessity, repeated Compound
  god-stacking, solver ceilings and actual human fun remain open.
- **Alternatives:** retain old global win bands despite the user's boring-run
  evidence; force all modes into rare wins even for expert forecasts; make each
  lab's named engine mandatory. These would respectively preserve slack,
  conflate strong planning with excessive generosity, or remove useful pivots.
- **Consequences:** CI checks mechanics, replay parity, geometric pressure and
  broad regression bands. Human win/loss notes decide the next tuning target.
  Historical reports retain their original configs; no held-out retuning.
- **Rewind:** choose an older embedded-rules replay or frozen candidate. Keep
  annotated mechanic checkpoint tags and the exploration diary; do not overwrite
  failed experiments or claim every retained prototype is equally mature.
