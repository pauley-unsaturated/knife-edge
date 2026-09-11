# v4 causal checkpoints

Fourteen self-contained replays retain six successful strategic avenues and one paid-reroll rescue, each with a losing counterfactual. They are selected tuning seeds, not population win-rate evidence. Older keeper files one directory up use historical rules and do not validate v4.

Run `pnpm exec tsx experiments/0004-raid-heat/keepers/v4/verify.ts` from the repository root. Every replay embeds its exact effective Medium configuration; the verification checks file SHA-256, recorded state hash, end tick, expected outcome, and zero rejected commands. `provenance.json` records original artifact paths, all frozen simulation/policy/config source hashes, and held-out fingerprints. Canonical unmodified rules are in `../../candidate-v4/`; the three disabled-effect replays intentionally embed diagnostic variants that retain costs and card identities.

| Pair | Positive | Negative | Comparison |
| --- | --- | --- | --- |
| Poison / seed 1 | `poison-ember-win-1` | `poison-disabled-loss-1` | Full adaptive run, poison effect removed only |
| Arc / seed 5 | `conductive-arc-win-5` | `conductive-disabled-loss-5` | Full adaptive run, Conductive multiplier removed only |
| Explosion / seed 2 | `death-burst-win-2` | `death-burst-disabled-loss-2` | Full adaptive run, corpse explosion removed only |
| Investment / seed 15 | `compound-investment-win-15` | `compound-immediate-control-loss-15` | Actual Compound versus Black Ice, identical tick-2380 prefix |
| Low-core / seed 6 | `pact-low-core-win-6` | `pact-poison-alternative-loss-6` | Actual Last Stand versus Venom, identical tick-2360 prefix |
| Sacrifice / seed 10 | `pact-sacrifice-win-10` | `pact-thermal-alternative-loss-10` | Actual Blood Price versus Hot Wire, identical tick-840 prefix |
| Reroll / seed 4 | `reroll-rescue-win-4` | `reroll-keep-visible-loss-4` | Spend 25 gold versus keep visible Conductive, identical tick-2920 prefix |

Append `.replay.json` to each stem. Offer forks continue adaptively with the same private continuation RNG; the full-run ablations replan from the beginning. These are driver-dependent counterfactuals, not claims that all possible strategies fail under the changed choice. Bank/Pact forks use the guarded specialist controllers in `../../v4-witnesses.ts`. Reroll uses a prepared-driver prefix, then the same standard Engineer continuation in both arms (`../../engine-choices.ts`); it is not a whole-policy prepared-versus-normal comparison.

See [JUDGE.md](JUDGE.md) for the final human-trial rubric and [the retained held-out summary](../../heldout-v4-summary.json) for unselected difficulty statistics. Complete generation commands and interpretation are in `../../v4-witnesses.ts` and `../../judge-report.ts`. No ignored `out/` file is needed to replay these checkpoints.
