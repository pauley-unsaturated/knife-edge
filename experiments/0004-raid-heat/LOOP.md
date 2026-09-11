# Driver / judge loop

This is a reproducible human-and-agent experiment protocol, not an unattended
LLM service. It needs no external API keys and sends no playtest telemetry.

1. Record a hypothesis in DIARY.md before changing candidate rules. Keep rules
   in a separate versioned file/function; never overwrite an earlier witness.
2. Run `iterate.ts START COUNT ROUND` on tuning seeds, persisting exact replays.
   Compare a simple policy, mechanic-aware driver, slower driver and forced lanes.
3. Run `judge-report.ts FOLDER --policy=POLICY --limit=12`. Inspect offers,
   purchase timing, leaks, bank and frozen-defense horizons, not only win rate.
4. A driver agent explains concrete decisions on wins AND losses. Fork real
   choice checkpoints with the same prefix and reoptimizing continuation.
5. A separate judge challenges the evidence using the rubric below. Send its
   objections back to the driver; revise reasoning or mechanics as appropriate.
6. Once promising, validate disjoint seeds and fixed-board varied-loot streams.
   Preserve compact reports, zero-rejection choice witnesses and their rules.
7. Tag tested keepers in git. Keep rejected experiments in the diary. A keeper
   means worth a human trial, not objectively certified fun.

## Driver prompt, revision 2

Use the actual deterministic simulator and legal commands. No extra resources.
Read the next-wave preview, current drops, investments and risk before deciding.
Let drops suggest a lane, but reassess later off-lane offers and permit pivots.
Deploy a real Frost kill zone for cold bonuses; use overlapping support and
appropriate counters. Do not spend every paycheck on the cheapest tower:
compare an attainable future tower or upgrade with buying now. Save deliberately
only when the defense can survive, then convert investment income back into
defense. A sacrifice is wrong when its connector is missing and safety is low.
Explain forced and rejected decisions, not only successes. Exact next-wave
simulation is an oracle-assisted policy, not a human intelligence rating.

Revision history: v1 locked the first identity, sometimes never built Frost and
starved expensive purchases with Bolt spam. v2 repairs all three and labels
perfect-model forecasts explicitly. Cadence and knowledge are separate axes.

## Judge prompt, revision 2

Reject 'wins therefore fun'. Require:

- A forgiving first wave, readable early pressure, geometric enemy growth
  overtaking ordinary resource income, and a meaningful late wall.
- Early offers visibly steering investments; matching drops and continued
  purchases establishing a groove. Alternatives remain legal and pivots possible.
- At least one matched checkpoint where the offered choice changes the outcome
  under adaptive continuation, not only under a broken fixed command schedule.
- Wins that depend on the named engine: ablate the interaction while preserving
  its costs. A renamed universal damage engine is not a new mechanic.
- No routine opening-to-victory coasting. Late coasting after assembling a
  cracked loadout is an intended payoff, not an automatic defect.
- Rarity evaluated for the intended player/profile, not an arbitrary cap on a
  strong oracle. Report distributions and uncertainty on held-out seeds.
- Reasonable driver behavior at multiple knowledge/cadence levels. Diagnose bad
  policies before changing the game. Do not call slower cadence dexterity.
- Actual upgrade decisions before claiming upgrade/build crossover is validated.

Return REVISE, PARK, or KEEP FOR HUMAN TRIAL with exact witness references,
remaining doubts and next falsification test. Neither agent may claim subjective
fun has been established without the user's playtest.
