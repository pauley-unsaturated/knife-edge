# Fresh learner-v1 validation

Frozen candidate-v4, seeds301–340, all three mechanics and difficulties: 360
games. Controller fingerprint `2963884217`. No controller or game retuning
during the run. All 360 saved replays reproduce their exact final state;
zero rejected commands. Inputs, dependency fingerprints, per-run/per-wave
records and exact replays are under `out/learner-v1-validation-301-340`.

Tracked compact results, frozen source configurations, controller source and
fingerprints are in [learner-v1-summary.json](learner-v1-summary.json); the large
per-run replay population remains generated output. Reproduce with:

```sh
pnpm exec vitest run tools/balance/test/learner-experiment.test.ts
pnpm exec tsx experiments/0004-raid-heat/learner-smoke.ts
pnpm exec tsx experiments/0004-raid-heat/learner-validation.ts
```

The validation script refuses a changed controller fingerprint and conflicting
existing frozen inputs. Use the retained matching source checkpoint to reproduce
results after future dependency changes; the manifest fingerprints the planner
dependencies as well as the controller. Rerunning the identical population is
reproduction, not a new held-out sample.

| Mechanic | Easy wins /40 | Medium wins /40 | Hard wins /40 |
| --- | ---: | ---: | ---: |
| Raid | 38 | 27 | 12 |
| Compound | 34 | 12 | 2 |
| Pact | 33 | 14 | 3 |

These are paired difficulty comparisons within a mechanic, not calibrated
human win probabilities. Reports include Wilson intervals: e.g. Raid Easy95%
has a95% interval83.5–98.6%, and Raid Medium67.5% has52.0–79.9%.

## Behavior: the affordability repair works

Across Easy, 208 of209 typed/Cold picks with no existing matching investment
receive a matching build or upgrade; every successful activation occurs within
two waves. Median delay is160ticks/eight seconds in each mechanic; P95 is320
ticks/16seconds. The single unactivated Easy card is Raid seed338's Cold Front
after17 on an already-winning run, not multi-wave starvation.

Medium converts208/212 new avenues, again all successful cases within two
waves. Median delay is280ticks/14seconds and P95 is440ticks/22seconds. Hard
converts151/171; the larger missing fraction includes runs that die shortly
after the offer, and its median delay is14–18seconds. The complete per-pick
records distinguish already-enabled effects from new activation requirements.

This is substantially more credible card-following behavior than historical
apprentice, which could buy zero matching towers after two typed drops. The
learner can respond to later off-lane boosts without permanently binding to
its first card. This does not establish that every pivot is optimal, nor that
successfully making a matching purchase makes the decision interesting.

The controller was selected before these fresh seeds using only three tuning
smoke witnesses: seed1 Hot Wire1880→Ember2080; seed4 Hot Wire600→Ember680 and
Cold Front1720→Frost1920; seed5 Conductive840→Arc1000. Those checks targeted the
known starvation defect, not a desired held-out win rate. It was then frozen;
two smoke wins and one loss were not grounds for further parameter changes.

## Difficulty shape

Failure-only waves-cleared P5/P50/P95 (death occurs in the following wave):

| Mechanic | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Raid | 15/15/17 | 7/14/17 | 2/9/16 |
| Compound | 15/15/16 | 11/15/17 | 3/12/17 |
| Pact | 15/16/17 | 7/15/17 | 2/12/16 |

Easy Raid has only two failures, so its failure quantiles are descriptive, not
a stable estimate of the shape of losing runs. All-run survival quantiles and
full failure-wave histograms are retained in the compact JSON.

All120 Easy games clear waves1/2/3 without a leak. Easy failures occur only
during16–18; median failed clear is15 Raid/Compound and16 Pact. Easy is a
forgiving place to learn an engine and see the ending, not knife-edge play.
This is appropriate as an onramp, provided it is advertised that way.

All360 games clear wave1 without leakage. Medium leaks on wave2 in20/40 runs
per mechanic (38 total core across each40-run arm); wave3 causes only one Raid
leak and none in Compound/Pact. Medium Compound fails most often during16/17
(18 of28 losses), and Pact likewise during16/17 (15 of26 losses). The median
failed clear is15 for both. Their late pressure generally arrives after enough
time to assemble and try a groove. Raid is substantially more accessible:
27/40 wins, with failure median clear14 and a wider failure spread.

Hard learner survival median is12 in every mechanic; wins range5–30%. Most
Hard runs leak in wave2 (36/40 per mechanic), and some die in3/4. These results
are not a demand to make Hard easier: its intended expert/oracle-assisted
profiles are validated separately. They show a real price/planning burden on
this limited-knowledge learner, rather than spatial or affordability deadlock.

## Independent judge and limitations

The judge accepted the controller as a useful low-knowledge diagnostic repair
and the fresh results as support for an Easy onramp and Medium/Hard separation.
No retuning was requested. Preserve the frozen inputs and bands separately
from the original oracle-assisted held-out profiles and old apprentice control.

The learner uses machine-precise geometric route scoring and public numerical
matchup information. It does not understand several rare engines or coating
combinations and does not use exact combat forecasts, future offers, raids or
rerolls. Its failures are not human skill percentiles. These simulations
validate operational choices and difficulty differences; only human playtests
can validate subjective fun, readability and the emotional feel of a narrow
escape or overwhelmingly powerful loadout.
