# Mechanic lab: human playtest

The demo now uses the 18-wave, nine-tower mechanic lab. The original 30-wave
Medium seed-7 rules have been replaced; start a **New run**, not Resume.

## Start here

Run `pnpm dev`, open http://127.0.0.1:5173, and choose **New run**.
Resume preserves the old run's embedded rules, even after a balance update.

Start on Easy to learn the controls, then try Medium on the same board. Hard is
for deliberate combo-building. Pause, change speed, or jump to the wave end
whenever useful; fast clicking is not the intended difficulty.

Select a tower with 1–9. Click a cell, then Build (B); U upgrades, X sells.
Towers change the route, so check that your new wall keeps enemies in the kill
zone. N calls the next wave, Space pauses. Leave a legal path to the core.

## Six things to try

1. **Name your build after the second drop.** Let the offers steer you instead of
   deciding every tower in advance. What made the direction attractive? At the
   next offer, was deepening it better than pivoting?
2. **Engineer a combo.** Put Sprayer coverage over an Arc/Frost firing lane, or
   Solvent over an Ember lane. Compare with spending that gold on damage or an
   upgrade. Was the support's contribution visible?
3. **Try a status engine.** Poison rewards repeated hits and can be maintained
   after a strong dose; Black Ice enables cold bonuses; Mutiny makes crowds hurt
   one another; death explosions need a first kill. Does the run settle into a
   recognizable groove rather than just displaying bigger numbers?
4. **Pay for a reroll once.** On an awkward offer, note what tower/upgrade you
   gave up. Retry the same seed and keep the visible card instead. Both runs
   winning can still reveal a useful tradeoff in core, gold, or safety.
5. **Compare the other labs.** Compound asks how little defense you can survive
   on while interest grows. Glass Cannon asks whether spending core is safe,
   especially before Last Stand is available. Raid/Heat trades a dangerous enemy
   source for cash and stronger remaining enemies. Read the exact price first.
6. **Look for the turning point.** Around two-thirds through, ordinary income
   should stop keeping up. Did your assembled engine take over, or did you
   understand what it was missing? A late god-like victory is intentional.

## What to save

Use **Save replay + notes** after a win and a loss. Include:

- Mechanic, difficulty, board seed, and the wave where the run changed.
- A choice you debated, the alternative, and what happened.
- Whether the first wave felt welcoming and waves 2–3 needed attention.
- Whether failure felt preventable, confusing, or purely unlucky.
- Whether the strong build felt earned—and whether you wanted to try again.

Don't spend time judging art or sound yet. Also flag layout/targeting/input
problems separately from difficulty. WebKit is tested, but your actual Safari
and display remain valuable coverage.

## What the automated tests do—and don't—establish

Every retained run embeds its rules and commands and must replay to the exact
final hash. Drivers vary mechanic knowledge, decision cadence and budgeting;
some use perfect next-wave forecasts, explicitly labeled oracle-assisted.
They do not simulate human intelligence, cursor dexterity, or enjoyment.

The independent judge checks meaningful alternatives, coherent builds,
ordinary-defense failure, earned late dominance, and difficulty ordering.
Your playtest is what decides whether those structures actually feel fun.
