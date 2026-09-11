# Frozen v4 driver-pattern review

These are tuning witnesses, not held-out estimates or claims about human
emotion. All 64 runs replay verified with zero rejected commands. Full visible
offers, score explanations, purchase costs, pre-action cash/core/loadout, and
wave-end traces are in `out/driver-review-v4`. Scores are policy beliefs, not
validated counterfactual values. Runtime policies and candidate rules stayed
unchanged. Tuning wins: Easy apprentice 6/16, Medium deliberate 13/16, Hard
Engineer 7/16, Medium prepared 12/16.

## Two wins

**Medium deliberate, seed1 — thermal/poison investment, win core12.**

1. After wave2 (tick640, 11g, core12), Venom beats offered Compound. Six Bolts
   already deliver poison; a tiny bank cannot monetize Compound immediately.
   This is a comprehensible combat-versus-investment direction, though this
   driver does not seriously explore banking here.
2. After wave8 (tick2960, 52g, core12), second Hot Wire beats Cold Front.
   Existing investment is Ember126 + Solvent40, with no Frost. Both avenues
   are affordable (Ember42/Frost38); reinforcing oil/fire avoids spending to
   activate a new cold engine. This is the strongest contextual commitment
   decision in this trace, not proof the rejected alternative loses.
3. At wave11 (tick4080, 60g), it upgrades Ember167 for59 rather than buy another
   Ember42. It later saves88 for the83 upgrade at wave12 and126 for116 at14.
   Unlike the old flat-expansion bug, this is actual concentration of capital
   in an established kill zone. No leakage occurs; by wave13 it can bank74
   without new spending. This is an assembled-power witness, not a tight
   survival witness. The late Conductive pick with no Arc is weak/off-lane
   slack, not another interesting decision.

**Hard Engineer, seed5 — damaged opening becomes a wet/lightning/cold groove,
win core5.**

1. After wave5 (tick2700, 26g, core6), second Conductive beats Hot Wire despite
   no Arc yet. It genuinely saves to60 and buys Arc176 in wave6; this differs
   from a bot merely collecting a themed label while buying only Bolt.
2. After wave8 (tick4260, 44g, core5), Venom beats Hot Wire: two Arcs already
   have120 invested, while thermal investment is zero. After adding a third
   Arc, it spends45 on Sprayer173 at wave9 instead of waiting for another
   60g Arc. This is a real support-versus-expansion decision with matching
   deployment, though no paired purchase fork was run here.
3. After wave11 (tick5980, 16g), Cold Front beats Compound, then it saves49 and
   buys Frost136 for48 at wave12. The second Cold Front after14 now has a
   ready activator. Core stops falling after wave7 and stays5 through18.
   The groove is achieved after early sacrifice of safety, not guaranteed
   by one lucky card. Continued Arc/Sprayer purchases are largely maintenance.

## Two losses

**Medium deliberate, seed4 — cold commitment, delayed pivot, loss during14.**

1. After2 (tick640, 41g, core12), Cold Front over Hot Wire, then Frost38 at720
   is a concrete card-to-purchase link. Wave3 nevertheless leaks eight core.
   This is not a clean demonstration of a late wall alone: the opening spends
   heavily on conditional support before enough damage is established.
2. After5 (2160, 39g, core4), second Cold Front beats Venom because Frost is
   already deployed. It survives without further leakage through13, so the
   follow-up is not an immediate fatal mistake. We did not prove that taking
   Venom would improve this checkpoint.
3. After8 (3440, 27g), Conductive beats Compound, but Lens35 is purchased first
   and the first Arc48 arrives only at wave11. A further Arc at13 and14 does
   not rescue the run. This is a late, undercapitalized pivot; it cannot be
   called successful adaptation. The near-exhausted opening life buffer also
   contaminates a pure late-wall interpretation.

**Easy apprentice, seed1 — myopic-control failure, loss during16.**

1. After2 (580, 23g), Compound and Venom both score zero in its limited model;
   deterministic tie-breaking picks Compound. This is not a thoughtful
   investment choice.
2. Hot Wire after5 (1780, 23g) and again after8 (3380, 12g) never produce a
   single Ember purchase. It keeps spending21 on Bolt instead of saving the
   additional8 for Ember29. The route guard prevents spatial sabotage but
   cannot repair this affordability starvation.
3. Overclock after11 actually benefits the existing Bolt investment, but
   Conductive after14 still leaves zero Arc. Final spending is945 Bolt +25
   Lens. Core11 after12 falls10/7/2 across13/14/15 before death. Geometric
   pressure exposes a missing engine, but this intentionally myopic driver
   must not be advertised as a reasonable human-like Easy player.

## Actual bad-offer reroll rescue

Prepared seed4, after wave8 at tick2920: core4, gold53, two Cold Fronts; visible
Conductive versus Compound. Spend25 to reroll versus keep Conductive, with an
identical prefix and the same standard Engineer adaptive continuation in both
forks. Reroll obtains Chain Reaction and wins18 at core4; keeping Conductive
loses during14 (13 cleared). Both have zero rejected commands and exact saved
replays under `medium/choices-engineer-prepared-reroll`. Later choices can
adapt; no free gold or unseen-offer inspection was added. This demonstrates
one genuine rescue, not expected reroll superiority. Actual seed3 and seed9
roll forks both win either way (seed3 even retains one more core by keeping).

The current candidate has meaningful card-to-purchase and investment examples.
It also retains automatic late picks and imperfect opening support timing.
An experiment-local learner repair is required before using low-knowledge
profiles to make claims about Easy accessibility; frozen runtime stays intact.
