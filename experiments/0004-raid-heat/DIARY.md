# Mechanic exploration diary

## Final v4 checkpoint — KEEP FOR HUMAN TRIAL, 2026-09-11

The independent judge accepted six causal avenues and a paid-reroll rescue;
14 positive/negative replays, exact embedded rules, provenance and a standalone
verifier are retained in `keepers/v4/`. The current configs ship unchanged in
the three playable labs. This supersedes the work-in-progress status below,
not the historical observations or failed hypotheses.

Final frozen validation:1512 unseen-board/profile/control/loot games plus360
separate reasonable-learner games, all verified, zero illegal inputs/timeouts.
See `heldout-v4-summary.json`, `learner-v1-summary.json`, `LEARNER-V1.md` and
`keepers/v4/JUDGE.md`. Neither game rules nor controller were retuned on their
held-out populations. All future fresh validation must use different seeds.

The old apprentice's low clear rate was not fair novice calibration. After
repairing offer-led saving in an experiment-local learner, Easy became a
forgiving onramp and Medium Compound/Pact produced late failures after real
build commitments. Hard remains for stronger planners. Raid is more generous,
especially fixed-board7; don't disguise that with a universal rare-win claim.

The final readiness standard is consequential choices, coherent investments,
distinct causal engines, late pressure and operationally reasonable drivers.
Actual fun, independent Mutiny/coating necessity, repeated Compound god-stacking
and solver margins remain open. The user now gets `PLAYTEST.md` and a fresh
18-wave demo, not another presentation of the rejected30-wave game.

## Current candidate before held-out review

`candidate-v4/{raid,compound,pact}.json` combines the accepted hypotheses:
Ember2.2×damage/sixlevels, two-card drafts, fresh-target coating delivery,
armored unlock2, geometric HP7%Raid/Pact and6%Compound, Easy70%defense prices.
Medium100% and Hard125% remain. These are frozen candidates, not an accepted
release or a claim of subjective fun. Final validation reserves board seeds
201–240 and fixed-board7 loot offsets10001–10024, untouched by tuning.

The judge accepts alternate winning routes in Compound/Pact: their names are
invitations, not mandatory classes. Each named engine still needs a clean
current-rules opportunity-cost witness. Apprentice preserves routes with limited
drop knowledge; deliberate holds Engineer strategy constant at80tickcadence;
Engineer uses20tickcadence and oracle-assisted planning. Neither is a human IQ.

## 2026-09-11 — Baseline failure

Human Medium seed 7 perfect-clears after stopping all actions at wave 21.
Decision pressure failed. See experiment 0003. User now wants wave 1 welcoming,
2–3 pressured, a geometrically approached wall around 12/18, and occasional
drop-led cracked builds that beat it. Art remains out of scope.

## Loop 0 — Heat / explosion feasibility

Added permanent raid jackpots/type closures/heat, on-kill chain explosions,
stronger cold/type patches. Explored six HP/spacing combinations, then six
budget/growth combinations. Initial feasibility runs are not retained as evidence;
the second 480-run exploration persists exact replay witnesses in `out/explore-*`.
Ordinary builders can be stopped, but strong patches too often solve the run.

## Loop 1 — Three variants, 1,160 games on seeds 1–40

`out/iteration-1-40.json`: raid/heat, compound bank engine, glass-cannon pacts.
Driver policies were heuristics, not calibrated humans. Every run replay-verified.
Judge verdict: **REVISE ALL**.

- Raid: forced blast wins 90%; first-offer adaptive wins 55%. A universal forced
  strategy undercuts drop-led identity. Some cold policies fail to buy Frost.
- Compound: forced blast wins 97.5%, banker 57.5%. Interest is a handicapped
  side activity while ordinary damage engines solve the branch.
- Pact: dedicated pact wins 100%. Core sacrifice buys a universal multiplier
  too cheaply and too reliably. Spectacular does not imply interesting.

Revisions: explicit Frost support purchase, investment-aware pivots (driver-agent
task), drops first at wave 2 then every 3 waves, enemy budget +18% and base HP +4%
per wave while bounty income flattens at the enemy-count cap. No discrete wall
multiplier. Remove explosions from the compound/pact branches; reduce their
general-purpose damage bonuses and blood-price's unconditional damage reward.

## Loop 2 — 870 games on seeds 1–30

`out/round2-1-30.json`: every replay checked. These are tuning seeds, not holdout.

- Raid: basic greedy-with-patches wins 16.7%, P50 wave14; forced blast 26.7%,
  P50 wave16. The unconditional easy-clear exploit is reduced. Existing
  adaptive heuristic 6.7% points to policy weaknesses as well as mechanic risk.
- Compound: banker 0%; its payoff is not viable yet. **Do not ship as a winner.**
- Pact: pact policy 66.7%; conditional jackpot is still too reliably accessible.

Independent driver and judge are now evaluating support placement, actual
bank/raid choices, and matched rule ablations before another tuning decision.
Harness adds alternate picks and frozen-input witnesses at waves4/8/12.
The judge's assessment is evidence for a human-playtest candidate, not a claim
that simulated win rates can certify subjective fun.

### Judge's first keeper witness (round 2, before rarity revision)

`keepers/round2-pact-1.replay.json`: sacrifices move core 9 → 6 → 3.
Wave 8 remains pressured (nearest surviving enemy about 4.93 path cells from
core). First Last Stand after wave 11 converts danger into a late-game engine.
Freeze after wave 8 loses on 13; freeze after 12 wins all 18 with 3 core.
That is earned late dominance, not the old effortless opening. Keep this exact
embedded-rules witness even while changing rarity in later experiments.

`keepers/round2-pact-7.replay.json`: the opposite lesson. Replacing an early
Blood Price with offered Overclock survives through wave 14 instead of 13,
with no rejected follow-up commands. Sacrifice before finding the connector
can be wrong. Judge retains the pair as a promising conditional decision arc,
but rejects calling the whole 66.7%-clear variant a rare dark horse.

## Loop 3 — Improve the driver before moving the goalposts

An independent driver/judge exchange found that affordable-only greedy spends
every small paycheck on Bolt, never waiting for an expensive boosted tower.
Driver revision will compare attainable next purchases and save deliberately,
place overlapping support, and forecast bank/raid danger. No hidden gold is
permitted. This distinguishes agent skill flaws from mechanic weaknesses.

Compound gets more investment runway (geometric budget still +18%, no extra
HP growth) and ×1.8 rate stacks. Pacts offer 2 choices instead of 3 to make
assembling the conditional engine less routine. These are hypotheses awaiting
the revised-driver tests, not accepted outcomes.

### Driver / judge round 2

Adaptive Raid seed 1 now buys Ember after Hot Wire, seed 2 buys Arc after
Conductive, and seed 6 follows Ember but still loses. The original all-Bolt
artifact was a bot starvation bug, not proof that drops failed to steer choices.
Seed 1 reoptimized ablations: normal wins18; no Hot Wire loses after17; no
explosion loses after16. Both pieces matter. Seed 2 can pivot from Arc to cold
when Conductive is neutralized, but still needs explosions; do not count that
as a wholly independent god engine.

Pact seed 1 after-wave-11 reoptimized fork: Last Stand wins18 at3core; offered
Hot Wire instead loses after14. Banker4's late Cold-vs-Compound choice gives two
perfect clears, so it is not evidence of tension at that late checkpoint.

Remaining defect: observed winning policies spread without upgrading. Next
curve experiment will lower Ember/Mortar's first upgrade crossover while
leaving Arc's spread/adjacency identity intact. Success must involve actual
upgrades and investment tradeoffs, not only another target win rate.

## Loop 4 — Status bridges, coating supports, and paid rerolls (pre-run hypothesis)

Freeze `engines.ts` configurations before the sweep. On tuning seeds 1–16,
compare Engineer, no-reroll, aggressive fishing, rookie, forced Ember/Arc,
and Compound's banker. This is an oracle-assisted policy comparison, not
calibrated human intelligence or an assertion that the game is fun.

Expected improvements: stronger Ember upgrades create actual build-versus-
upgrade choices; wet/oil supports earn their cost only when they overlap an
established damage lane; rare statuses bridge otherwise weak offers; paying
for rerolls sometimes rescues a loadout but fishing can consume defense gold.
Keep zero-rejection replay witnesses, actual support purchases, upgrades,
fees and selected drops. Do not equate a scoring heuristic with a demonstrated
opportunity-cost fork. The judge will inspect replay-backed counterfactuals.

Two carrier stress controls test a potential new exploit: pure Sprayer and
a four-Bolt opening followed by Sprayer status carriers. Both prioritize
Mutiny/global status drops without inspecting future seeded offers. A pure
carrier dying before drops become available does not clear the late-game
exploit concern; the mixed opening exists to test that continuation.

All results go under `out/engines-round4-1-16`, with embedded replay data and
configuration snapshots. Optional difficulty-diagonal slices are separate
from the Medium tuning comparison. Kill events do not identify their damage
source, so the report will not invent direct/poison/confusion/burst attribution.

The Easy diagonal also needs a newcomer-policy check: run Engineer Rookie on
16 seeds per branch under Easy affordability. Occasional wins are the target;
expert-only difficulty ordering would not establish newcomer accessibility.

### Prepared reroll driver hypothesis (before its comparison)

The first Raid Engineer slice reached 80 offers: 39 could pay the 25g fee,
but only two also retained a full 30g defense purchase. Four other offers passed
the public-pool value test in a hypothetical 55g bank, but not at their real
bank. The budget-aware driver therefore never rerolled. This motivates a
driver scheduling experiment, not reducing the fee or inventing gold.

New `engineer-prepared` reserves up to 25g before a publicly scheduled drop
wave only when a bounded, frozen-next-wave simulation predicts zero lost core.
The scratch probe disables future drop generation and never reads future
offers. A leak or enemy within six path cells releases the reserve. At an
actual visible offer, a similarly safe board may retain half a Bolt's price
while paying a reroll that passes the existing public-pool value estimate.
It keeps the same 20-tick action cadence; this is explicitly oracle-assisted.

Compare prepared versus ordinary Engineer **after both receive the same
path-preservation guard**, using unchanged engine configurations. Persist this
separate driver generation under `out/engines-prepared-guarded-1-16`; do not
mix its outcomes with the still-running pre-guard `engines-round4-1-16` sweep.

### Loop 4 results — apparent difficulty was still partly a driver defect

All 580 runs in the three slices below replay-verified with zero rejected
commands. These are tuning samples, not holdout validation of final knobs.

- Pre-guard 436-run sweep: Medium Engineer wins Raid 9/16, Compound 8/16,
  Pact 9/16; forced Ember wins 15/16, 12/16, 15/16, respectively. Forced Arc
  also wins 15/16 Raid. Paid fishing changes individual outcomes but not
  monotonically; its Compound/Pact behavior chases an unavailable explosion
  drop and must be labeled a deliberately reckless control. Pure and warm
  status-carrier controls have no full clears, but some warm carriers reach
  wave 17; this is not an exhaustive exploit search.
- Easy newcomer slice: Rookie wins Raid 2/16, Compound 3/16, Pact 3/16.
  These support occasional newcomer wins, not calibrated human accessibility.
- Guarded 96-run comparison: ordinary Engineer wins **16/16 Raid, 16/16
  Compound, 14/16 Pact**. Prepared has the same aggregate outcomes. The guard
  avoids destroying existing firing lanes when extending the maze. The much
  higher win rate exposes that previous failures were often bad placement,
  not successful knife-edge balancing. **Do not accept these global knobs.**

Prepared makes paid rerolls reachable without changing the 25g price: four
Raid runs make five rolls (125g), and one Pact run makes two rolls (50g).
It shifts spending from some coaters into upgrades, but no aggregate rescue
claim follows from these easy guarded runs. Its forecast and public-pool
estimate remain explicitly oracle-assisted; exact choice forks are separate.
The next pressure envelope should use the corrected guarded drivers, retain
the replay-backed mechanic witnesses, and seek a genuine stochastic wall.

## Loop 5 — Falsify shortcuts and fix the driver

Round4 forced Ember and forced Arc each clear15/16 Medium tuning seeds. The
judge reran Ember with every patch benefit neutralized:5/16 still clear, with
zero rejected commands. This violates the intended need to assemble an engine.
Before changing global pressure, compare Ember's six-level2.4×damage ladder
against a four-level cap, a gentler2.2×ladder, and both. Preserve early upgrade
viability and test normal versus neutral drops on the same16seeds. Arc gets a
separate neutral-drop probe; a second shortcut must not be blamed on Ember.

The driver also destroyed a winning defense: seed3's Bolt atcell162 reroutes
the same-length path away from Frost/Mortar. Every tested late-build subset
without162 wins; every subset including162 loses, keeping the call tick fixed.
An engineer-only path-aware guard is being tested. Historical and revised
driver outcomes must not be pooled or described as RNG difficulty.

Support delivery hypothesis: prefer uncoated targets, with the player's target
priority breaking ties and normal targeting when every target is coated.
Opt-in data preserves old replay behavior. Compare this delivery rule before
increasing wet/oil multipliers; original adaptive no-oil tests do not yet show
that oil earns its opportunity cost. A maintained strong poison remains a
possible alternative reason to prefer repeated hits over fresh targets.

### Curve verdict and reroll evidence

96 replay-verified Ember curve runs: cap4 gives15/16 ordinary wins and1/16
neutral wins; gentler six-level2.2× gives13/16 and0/16; cap4+gentler gives the
same13/16 and0/16. Judge prefers gentler alone as the next candidate:17actual
upgrades across5runs remain, and the arbitrary cap adds no observed benefit.
This small tuning sample is not a zero-percent population claim.

With the repaired path guard,16 adaptive paid-reroll checkpoints no longer
yield binary loss/win differences. Retire the old fish-loss causal claim.
Raid11 afterwave8 remains a real downside: paying to reroll ends at1core;
keeping visible Overclock ends at11core, with identical prefix and zero
rejections. Do not contort game difficulty to make every choice binary.

### Loop 5 availability A/B — hypothesis recorded before runs

Arc's normal 15/16 versus neutral-patch 0/16 result suggests its matching engine
is offered too reliably, rather than base Arc being sufficient. Freeze current
`engines("raid")` and compare two versus three offered cards on the same seeds
1–16, using forced Arc, forced Ember, and the corrected path-aware Engineer.
Record the first three initial offer sets, rerolls separately, selected stacks
through wave 12, full-clear rate and survival P5/P50/P95. Reduced choice count
should lower routine completion of a forced engine while leaving some strong
offer-led runs possible. This is a tuning sample, not a held-out fun verdict.

A third arm keeps two-card offers and opts coating towers into fresh-target
priority; compare only Engineer with its same-data two-card baseline. No tower
cost, status multiplier, global engine configuration or unrelated policy changes
are authorized by this experiment. Freeze data and driver-source fingerprints
with every output, verify all replay hashes, and report delivery improvement
separately from drop availability. Output: `out/availability-1-16`.

### Availability A/B results — 112 replay-verified runs

All runs use Medium seeds 1–16 and corrected path-aware driver fingerprint
`3184624778`; no commands were rejected. Do not pool this Engineer's results
with the historical unguarded Engineer that stranded its own kill zones.

| Driver / delivery | Three offered cards | Two offered cards |
|---|---:|---:|
| Forced Arc | 15/16 wins; survival P5/P50/P95 10/18/18 | 11/16; 11/18/18 |
| Forced Ember | 15/16; 14/18/18 | 15/16; 11/18/18 |
| Path-aware Engineer | 16/16; 18/18/18 | 16/16; 18/18/18 |
| Engineer, fresh-target coatings | not tested | 16/16; 18/18/18 |

Every run reached its first three initial offer sets. Arc's matching-card
availability in those sets (zero/one/two/three sets containing Conductive)
changes from `[3,4,7,2]` to `[5,6,5,0]`. Arc runs with at least three selected
Conductive copies through wave 12 fall from 5/16 to zero. Forced Ember likewise
loses its three-or-more-copy runs (4/16 to zero) without lowering its win rate.
Thus narrower offers reduce one forced engine's reliability; they do not solve
Ember's power curve or the corrected adaptive driver's routine clears.

Fresh coating delivery changes timing in 9/16 two-card Engineer runs (eight
faster, one slower), but final core and support spending are identical in every
paired run. This does not establish a survival benefit or meaningful choice
pressure; the baseline already clears every seed. Two-card Engineer rerolls
once across 16 runs, versus zero with three cards; affordability remains a
separate question under the prepared-reserve driver experiment.

Frozen configurations, manifest, summaries, first-three-offer histories,
through-wave-12 stacks, and all replay files are under
`out/availability-1-16/`. Reproduce with
`pnpm exec tsx experiments/0004-raid-heat/availability.ts 16 1 <new-label>`.
These are paired tuning results, not held-out estimates or certification of fun.

### Geometric pressure envelope — pre-run hypothesis

Combine the justified candidate adjustments without mutating `engines.ts`:
Raid, six Ember levels with 2.2× damage growth, two-card offers, and fresh-target
coating delivery. Vary only per-wave HP growth across 1.04/1.05/1.06/1.07; budget
growth stays 1.18 and opening budgets are unchanged. Compare paired seeds 1–16
with path-aware Engineer, forced Arc, forced Ember, and the available prepared
Engineer reserve policy. These four curves are geometric from the start, not
an arbitrary late-wave spike.

Success requires more than a lower win rate: retain the free first wave,
inspect second/third-wave leakage and surviving-enemy proximity, failures near
the intended late wall, actual selected stacks and spending through each wave,
and whether freezing input after waves 4/8/12 still wins. Early passive coasts
are a failure; a sufficiently assembled later engine may legitimately coast.
Preserve fixed-command no-patch probes but label their rejected inputs/timing
limits. Snapshot configurations, source fingerprints, baseline replays and
counterfactual replays under `out/pressure-1-16` before interpreting results.

### Pressure envelope results — geometric pressure helps, opening remains slack

Completed 256 baseline runs and 998 reachable fixed-command counterfactuals;
all replay verified, with zero baseline command rejections. Configurations and
driver fingerprint `3184624778` are frozen under `out/pressure-1-16`.

| Per-wave HP growth | Engineer wins | Forced Arc wins | Forced Ember wins | Prepared Engineer wins |
|---|---:|---:|---:|---:|
| 1.04 | 16/16 | 11/16 | 10/16 | 15/16 |
| 1.05 | 15/16 | 11/16 | 9/16 | 14/16 |
| 1.06 | 15/16 | 8/16 | 9/16 | 13/16 |
| 1.07 | 14/16 | 5/16 | 6/16 | 12/16 |

At 1.07, nonwinning runs' median waves cleared are 14/14/13/13 for those four
policies respectively; these are cleared counts, so failure is on the following
wave. Forced Arc's overall survival P5/P50/P95 is 9/16/18; Ember's is 7/13/18.
Thus forced routes become meaningfully conditional, though 14/16 adaptive
clears remain high and cannot by themselves certify the desired experience.

No frozen-after-wave-4 defense wins in any arm. At 1.07, Engineer frozen after
8 wins 0/16 (median clear 12); frozen after 12 wins 4/16 (median clear 16).
Compare 1.04's 13/16 frozen-after-12 wins. Later intensity therefore overtakes
many established defenses while retaining some assembled engines that genuinely
dominate. There is one earlier frozen-after-8 Ember win at 1.04; none at 1.07.
Every fixed-command no-patch probe loses, but their timing/rejected-command
caveats remain: this is not an optimal no-patch solver or adaptive control.

The opening is not solved by this envelope. Wave 1 is leak-free in every run;
Engineer wave 2 is also leak-free in every arm, and wave 3 only leaks one enemy
across the 16 highest-pressure runs. Its early surviving-enemy distance medians
remain roughly 17/16/13 cells for waves 1/2/3. Increasing geometric late pressure
alone has not made the second and third waves feel tight. Prepared Engineer's
seed 4 loses eight core on wave 3 at every pressure setting: the next-wave safety
forecast does not guarantee enough investment for the wave after that, and this
must not be mislabeled random difficulty. No policy was changed mid-sweep.

Per-wave core, bank, spending, selected stacks, nearest-survivor measurements,
failed-run distributions and every frozen/no-patch replay are retained. Reproduce
with `pnpm exec tsx experiments/0004-raid-heat/pressure.ts 16 1 <new-label>`.
No global engine data or held-out validation seeds were changed or consumed.

### Branch / actual-skill calibration — pre-run hypothesis

Keep six Ember levels at 2.2× damage growth, two offered cards and fresh-target
coaters. Compare Compound HP growth 1.05/1.06/1.07 and Pact 1.06/1.07 on Medium
seeds 1–16 using ordinary path-aware Engineer versus a path-guarded banker/pact
specialist. Specialists retain their original banking/sacrifice logic and gain
only route protection; do not claim they acquire Engineer's coating planner.
Measure whether ordinary damage builds bypass the named branch engine, using
actual uptake and fixed-command no-interest/no-low-life probes with rejection
caveats. Preserve core, bank, spending and chosen stacks by wave.

For Raid at 1.07, test actual newcomer-policy accessibility with Easy defense
prices at 80% and 70%, then the corrected Engineer at Hard's existing 125% price.
Do not infer skill spread from expert-only affordability bands. This is a frozen
208-baseline tuning comparison under `out/branch-calibration-1-16`; reserved
validation seeds and global `engines.ts` remain untouched.

### Branch calibration results — named engines remain optional

All 208 baselines and 160 engine-removal counterfactuals replay verified, with
zero baseline rejected commands. At Compound HP growth 1.05/1.06/1.07,
Engineer wins 12/10/8 of 16 and guarded Banker wins 11/6/5. Engineer wins without
ever selecting Compound number 11/9/8, respectively, and those same counts
survive the no-patch-interest intervention without rejected inputs. The ordinary
damage/status route can therefore bypass the named economy engine. Banker's
median interest falls 112/90/59 as pressure removes safe investment windows.

At Pact 1.06/1.07, Engineer wins 12/10 and guarded Pact wins 6/4. No-low-life
probes retain 11/7 Engineer wins and 2/1 specialist wins with zero rejected
commands. Do not promote a globally necessary low-core engine from these
results; the earlier matched Last Stand choice witnesses remain the stronger
evidence for a specific conditional strategy. Specialists here are path-aware,
not upgraded to Engineer's coating planner.

Raid 1.07's Hard 125%-price Engineer wins 7/16 (survival P5/P50/P95 3/14/18;
nonwinner median clear 12). Easy's historical rookie wins 2/16 at both 80% and
70% prices, with the same winning seeds 2 and 6. That does not justify tuning
around its spatial errors: actual failed replays show repeated legal placements
that strand defense. Easy80 seed1 Bolt163 at tick3400 cuts exposure 64→27.2;
substituting safe Bolt177 at that exact tick improves clear8→9 with no rejected
later inputs. Seed4's Bolt144 cuts 60→16, and changing that placement improves
clear6→10 but creates one later rejected input, so that fork is qualified.

### Apprentice control — pre-run hypothesis

Keep the historical rookie unchanged. Add `engineer-apprentice`: identical
limited drop knowledge and affordable-only purchasing, but basic route
protection via the same opt-in kill-zone guard. Compare old rookie/apprentice
on Raid 1.07, gentler six-level Ember, two cards and fresh coating targets at
Easy80%, Easy70%, and Medium100%, paired seeds 1–16. This tests whether earlier
price conclusions were contaminated by spatial mistakes, not calibrated human
intelligence. A separate `engineer-deliberate` factory retains full Engineer
knowledge/path planning and only limits decisions to 80 ticks; do not run its
frozen difficulty comparison before the parent selects the final candidate.

### Apprentice control results — spatial mistakes masked the price signal

All 96 runs in `out/learning-calibration-1-16` replay verified with zero rejected
commands. At Easy80, historical rookie wins 2/16 with survival P5/P50/P95
3/10/18; the path-aware apprentice wins 4/16 with 12/14/18. At Easy70, rookie
still wins 2/16 (4/9/18), while apprentice wins 5/16 (12/15/18). Medium100
rookie wins 0/16 (5/8/16), versus apprentice 4/16 (6/11/18). Equal apprentice
win counts on Easy80 and Medium conceal a substantial safety difference:
nonwinner median clear is 13 versus 10, and Easy70 raises that median to 15.

Route protection exposes a modest affordability benefit previously masked by
self-sabotage. It does not make the limited-knowledge player reliable, nor does
it establish calibrated human skill. The new deliberate Engineer profile
changes only decision cadence to four seconds; its knowledge and planner stay
identical. Two deterministic/cadence tests pass. Historical rookie names and
results remain intact.

### Frozen v4 contextual review and learner repair

`DRIVER-REVIEW-V4.md` records two wins and two losses, each with three concrete
drop/purchase decisions. All 64 tuning replays under `out/driver-review-v4`
verify without rejected commands. Thermal upgrades and wet/lightning/cold
support spending produce inspectable grooves; delayed pivots and premature
support purchases still fail. An actual prepared seed4 reroll after8 rescues
the run: same prefix and Engineer adaptive continuation, reroll wins18/core4
versus keeping visible Conductive losing during14. Other actual rolls at3/9
do not improve win/loss, preventing a blanket reroll-superiority claim.

The apprentice remains an inadequate accessibility model: Easy seed1 collects
two Hot Wires but never saves the extra8 gold for an Ember over a Bolt. Do not
tune Easy around this failure. Frozen runtime stays unchanged. Experiment-local
`learner-controller.ts` adds a 40-tick learner with basic typed-card savings,
bounded increasing commitment after repeated boosts, Cold→Frost activation,
public composition estimates and safe routes. Near-core emergencies release
savings. It has no exact combat forecast, unseen-offer access, virtual money,
coating planner, raids or rerolls; other mechanics remain poorly understood.

Smoke witnesses in `out/learner-v1-smoke` demonstrate actual activation, not
just improved wins: seed1 Hot Wire at1880→Ember2080; seed4 Hot Wire600→Ember680
and Cold Front1720→Frost1920; seed5 Conductive840→Arc1000. Repeated copies and
later off-lane cards also induce matching purchases. Seeds1/5 win atcore12;
seed4 still loses during17. All replay verify with zero rejected commands;
two deterministic/cadence tests and project typecheck pass. This is a repaired
low-knowledge heuristic, not calibrated human intelligence. Fresh learner
held-out evaluation requires the parent's explicit freeze/authorization.

### Learner-v1 fresh validation — preregistered, no retuning

Parent authorization: run new board seeds301–340 exactly once for learner-v1
across Raid/Compound/Pact and Easy/Medium/Hard, all from frozen candidate-v4
JSON: 360 baseline games. Freeze controller fingerprint2963884217 and all nine
effective configurations before starting. Do not alter controller or gameplay
in response to these outcomes. Keep this separate from historical apprentice
diagnostics and from the earlier reserved validation population.

Report exact verified replays, zero/nonzero rejected commands, win intervals,
failure-wave distributions, early wave1/2/3 leakage, and actual drop-to-matching
purchase delays (including whether a matching tower was already present).
The behavioral criterion is that owned typed cards are converted into usable
investment without endless cheap-purchase starvation. Easy accessibility is
judged from survival distributions and behavior, not a desired win-rate alone.
This remains an inspectable low-knowledge heuristic, not calibrated humans.

### Learner-v1 fresh validation results — accepted without retuning

All360 replays verify exactly with zero rejected commands; controller remains
2963884217. Wins /40 Easy/Medium/Hard: Raid38/27/12, Compound34/12/2,
Pact33/14/3. Easy firstthree waves never leak across120 games. Medium wave2
leaks in20/40 runs per mechanic, while wave3 is almost clean. Compound/Pact
Medium failures concentrate during16/17, after an opportunity to form a build.

New typed/Cold avenues activate208/209 on Easy and208/212 on Medium, every
successful activation within two waves. Median delay is8seconds Easy and14
seconds Medium. The lone Easy non-activation is a wave17 card on an already
winning Raid seed338, not the historical endless-Bolt starvation. Hard converts
151/171, with failures often cutting the attempt short. Exact per-drop and
wave records remain under `out/learner-v1-validation-301-340`.

The independent judge accepts this as a sensible low-knowledge diagnostic
repair and supports Easy as a forgiving onramp; it is not knife-edge at
82.5–95% wins. Medium/Hard show clear separation. Keep limitations explicit:
machine-precise route scoring, incomplete rare/coating knowledge, and no mapping
to measured human skill percentiles. No retuning requested or performed.
`LEARNER-V1.md` records the complete interpretation, reproducible commands and
failure quantiles. `learner-v1-summary.json` retains compact results and frozen
source/controller manifest outside ignored generated output.
