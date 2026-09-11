# Hand-off

Updated 2026-09-11 local. When finishing a session, update this file and append
to `vault/90-Log/Session Log.md`.

## Current state: v4 mechanic lab ready for a human trial

The user's original Medium seed7 was boring. Its submitted30-wave replay
perfect-cleared with718 gold unspent and could coast from wave17. That ruleset
is historical, not this release's difficulty evidence.

The iterative driver/judge goal now has a playable candidate: Raid/Heat,
Compound, and Glass Cannon, each Easy/Medium/Hard. The final independent judge
says **KEEP FOR HUMAN TRIAL**, not “bots experience fun” or “balance is solved.”
Six causal avenues and a paid-reroll rescue are retained as14 positive/negative
replays in `experiments/0004-raid-heat/keepers/v4/`. Read its `JUDGE.md`.
Art, theme and audio remain deliberately out of scope.

Run `pnpm dev`, open http://127.0.0.1:5173 and choose **New run**. Resume restores
the save's embedded old rules. Start Raid/Heat Easy7 to learn controls; Medium
Compound/Glass Cannon are more volatile groove-finding trials. Hard is the
stronger-planning challenge. `PLAYTEST.md` gives six focused experiments.
The bundled **Watch Raid/Heat example** is a verified current Easy7 Engineer win.

## Shipped rules and critical knobs

Canonical frozen files `experiments/0004-raid-heat/candidate-v4/{raid,compound,pact}.json`
match `data/{game,compound,pact}.json` exactly. Do not edit a historical candidate
to hide a result. Start a new version and hypothesis in the diary.

- 18waves,12core,120gold. Opening budgets60/200/250; armor appears atwave2.
- Budget grows18% per wave; HP grows7% Raid/Pact and6% Compound. Enemy count caps
  at18, bounty is flat3. Excess budget buys HP tiers. There is no discrete wall.
- Easy/Medium/Hard defense prices70/100/125%, with identical boards and enemies.
- Two-card offers afterwaves2/5/8/11/14/17; weighted rare drops. Gold rerolls
  cost25/40/64, at most3 per offer, independent of future wave/drop streams.
- Nine towers: Bolt, Ember, Frost, Mortar, Arc, Lens, Relay, Sprayer, Solvent.
  Ember has6 levels with2.2×damage growth; new coaters have3 levels and prefer
  uncoated targets. Water boosts Arc damage/Frost slow; oil→Ember burst plus burn.
- Poison, Black Ice, Mutiny and corpse explosions have explicit integer strength,
  duration, stacking and cap rules. Extra duplicate kicker is only5% per prior
  stack on additive statuses/explosions; already-multiplicative boosts are intact.
- Raid: type removal +75/90/110gold, each permanently+35%HP and+20%spawn rate.
  Compound: investment rate grows×1.8 per Compound stack; spend enough to survive.
  Pact: Blood Price costs3core nonlethally, +25%damage; Last Stand×2.5 at≤4core.
  Compound/Pact omit the raid/explosion shortcut; alternate winning builds allowed.

## Evidence and player models

Frozen baseline validation:1512 runs, unseen boards201–240 and fixed-board7 loot
offsets10001–10024. All exact-replay verified, no rejected commands/timeouts,
unchanged source/config fingerprints. `heldout-v4-summary.json` retains full
distributions, confidence intervals, early leaks and provenance.

| Engineer/oracle-assisted wins/40 | Easy | Medium | Hard |
|---|---:|---:|---:|
| Raid |39|33|16|
| Compound |39|31|8|
| Pact |40|25|12|

Fresh reasonable-learner validation:360 runs, boards301–340, all verified and
legal. `LEARNER-V1.md` and `learner-v1-summary.json` retain methodology/results.

| Learner wins/40 | Easy | Medium | Hard |
|---|---:|---:|---:|
| Raid |38|27|12|
| Compound |34|12|2|
| Pact |33|14|3|

Learner activates416/421 newly chosen typed/Cold avenues within two waves on
Easy/Medium. It uses public matchup/geometry,40tick cadence and real saving,
not combat forecasts, future drops or virtual gold. Its exact route scoring
is still machine-like. It is experiment-local in `learner-controller.ts`.

Engineer uses20tick cadence, support/offer ROI and perfect next-wave forecasts;
the deliberate variant holds strategy at80ticks. Prepared reserves reroll money
only with a safe public-next-wave forecast, sometimes hurting overall results.
These are knowledge/execution proxies, not calibrated IQ/dexterity. The old
apprentice still starves expensive matching purchases: keep it as a myopic
diagnostic, never portray its losses as normal novice difficulty.

Important findings:
- Earlier “difficulty” included bot maze self-sabotage. The opt-in route guard
  preserves existing kill-zone coverage and chooses alternate legal cells.
  Old pre-guard rates must not be pooled with repaired-driver rates.
- Cost-preserving neutral Arc/Ember drop controls won1/240, median9–10 cleared.
  These are not an exhaustive solver or proof every unboosted strategy fails.
- Fixed-board varied loot wins22/24 Raid,16/24 Compound,8/24 Pact for prepared
  Engineer. Pact supports occasional success; favorable Raid is still forgiving.
- Clean adaptive witnesses show poison/Ember, Conductive/Arc, death bursts,
  investment, low-core recovery and sacrifice affect outcomes. A real reroll
  fork wins18 versus loss during14, paying25 at the same wave8 checkpoint.
- Five selected winners all die when every command is frozen afterwave12.
  Continued decisions matter; late dominance after earning a build is welcome.
- All fresh learners clearwave1 safely. Easy1–3 all safe. Mediumwave2 leaks in
  half the learner runs; wave3 is not uniformly tough. Don't promise a fixed
  rhythm or universal wave12 death. Hard expert median clears13–14.
- Coating/Mutiny necessity, repeated Compound god-stacking, interesting raid
  exclusions, human fun and true minimum-defense margins remain unproved.

## Verification and compatibility

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm validate:balance
pnpm exec playwright install chromium webkit
pnpm test:browser
pnpm exec tsx experiments/0004-raid-heat/keepers/v4/verify.ts
pnpm balance compare --file path/to/human.replay.json
```

The current gate is `tools/balance/src/validate-lab.ts`:120 replay-verified reused
tuning-seed smoke runs, broad expert/neutral bands, firstwave safety, matched
boards, cash conservation, increasing defense prices and geometric-pressure
proxy versus capped bounty. It is not a fresh held-out or human-fun gate.
The old `validate.ts` stays historical; do not use its30wave duration/bands.
Nightly uses40 reused seeds (600runs). Both120 and600-run gates passed locally.
CI also checks the14 retained witnesses. Checkpoint tags are indexed in
`experiments/0004-raid-heat/CHECKPOINTS.md`; no remote push is needed.

Current local verification:109 unit tests, forced typecheck and production build
pass;16 Chromium/WebKit checks pass including all labs, rare offer/reroll/recovery,
full headless winner playback and delayed-style/resizing Safari regressions.
Vite reports only the known large-chunk advisory (~381KB gzip game bundle).
Browser runtime had no connection; tests used isolated local Playwright. Actual
Safari hardware remains useful human coverage. No deployment/push was performed.

The current seed99 undefended golden is wave2, tick927, hash40312270:
wave1's six leaks are survivable with12core, then armoredwave2 kills. Keep this
rationale alongside the data change in the commit. Original human demo1 Medium7
still verifies tick31860/hash2474316104; all7 prior keeper replays also verify.
Optional rules/state are deliberately absent in old replays to retain hashes.
Tracked TypeScript build caches were removed; generated caches now stay ignored.

## Architecture cautions

- Sim is engine-free fixed20Hz integer code. Renderer only reads state/events.
  Status/coating calculations and integer-product bounds live in sim modules;
  never add browser-only combat effects.
- Every replay embeds raw rules, commands, endtick and finalhash. Hash includes
  all future-affecting enemy/status/offer/raid state. Validate imports before use.
- Death cleanup pays each bounty once; on-death chains do not recursively apply
  on-hit effects. Slow has a floor, confusion needs another living target.
- Session offers pause human play; call/resume disabled until a choice. Legacy
  simulation command legality remains intact for old replays.
- Preserve Safari fix: Phaser `expandParent:false`, absolute canvas inside a
  CSS-bounded frame, ResizeObserver→requestAnimationFrame refit. Never let canvas
  intrinsic dimensions or Phaser parent expansion own document height.
- `probeDefense` remains an upper bound on minimum cost, not an optimum. The
  historical all-wave3–6% margin and5–10% sustained god-run rate are unproved.
  ADR0018 explicitly replaces the zero-drop acceptance goal for this trial.

## Continue after human feedback

Use `PLAYTEST.md`: save a win and loss, identify a debated choice, whether
drops established a build, when the late engine took over, and desire to retry.
A boring win or opaque death fails the fun gate regardless of bot statistics.
Inspect their embedded replay before tuning. Record the hypothesis in
`experiments/0004-raid-heat/DIARY.md`, run matched alternatives and an independent
judge per `LOOP.md`, then reserve new unseen seeds. Do not reuse201–240 or301–340
as new held-out evidence. Keep successful checkpoints via annotated git tags.

Full enemy behaviors (real splitting/healing/airborne/bosses), beam/fuzzer,
meta progression, art/audio, iOS and launch polish remain future scope.
