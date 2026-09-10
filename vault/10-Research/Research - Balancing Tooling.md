---
id: 4669B894-CA06-4E86-8892-CB3D2D5A3017
created: 2026-09-10T05:49:17Z
modified: 2026-09-10T05:49:17Z
tags: [research, stratum-1, balancing, tooling]
---
# Research - Balancing Tooling

*Stratum 1. Append-only. Compiled 2026-09-10. WebSearch worked; direct fetches of many primary pages (wordpress.com, gamedeveloper.com, gdcvault.com, arxiv.org, machinations.io, lostgarden.com, sirlin.net) were blocked by the session's proxy. Items marked (snippet) are summarized from search-result excerpts; GitHub pages were fetched in full.*

Feeds: branch B13 in [[Branch Register]] · [[Balance Toolkit Plan]] · the "knife edge" sections of each concept.

---

## 1. Theory and frameworks

### Schreiber, *Game Balance Concepts* (2010) and Schreiber and Romero, *Game Balance* (2021)
- Course index: https://gamebalanceconcepts.wordpress.com/ ; [Level 3: Transitive Mechanics and Cost Curves](https://gamebalanceconcepts.wordpress.com/2010/07/21/level-3-transitive-mechanics-and-cost-curves/), [Level 7: Advancement, Progression and Pacing](https://gamebalanceconcepts.wordpress.com/2010/08/18/level-7-advancement-progression-and-pacing/). Book chapter [Transitivity and Cost Curves](https://www.taylorfrancis.com/chapters/mono/10.1201/9781315156422-8/transitivity-cost-curves-ian-schreiber-brenda-romero).
- **TD-relevant techniques:** (a) *Transitive* objects (towers, upgrades) are balanced by cost, not parity: convert every benefit (damage, rate, range, splash, slow) and drawback into one resource unit and fit a cost curve; anything off-curve is mispriced. (b) *Intransitive* structure (armor vs damage types, swarm vs splash) is balanced with payoff matrices. (c) Level 7: balance is the comparison of the **player power curve against the opposition power curve**, both designer-controlled (snippet). This is exactly the invariant a knife-edge TD must make explicit and testable.

### Machinations (Dormans)
- [Simulating Mechanics to Study Emergence in Games](https://ojs.aaai.org/index.php/AIIDE/article/view/12477) (AIIDE 2011); [Game Mechanics: Advanced Game Design, Ch. 5](https://www.oreilly.com/library/view/game-mechanics-advanced/9780132946728/ch05.html); [machinations.io](https://machinations.io/homepage) with Monte Carlo batch runs and per-node histograms; community TD diagrams exist ([tower-defense](https://machinations.io/community/drak154/tower-defense-267a36ffbcc211ec8c2902f943517e50)). Case: [Balancing, solved!](https://machinations.io/articles/balancing-solved) (thousands of 33-day simulations) (snippet).
- **Use for TD:** model the income loop (kill gold + wave bonus + interest to tower purchases to DPS to kill gold) to reason about **feedback polarity** (interest is positive feedback, i.e. snowball) before writing code. Good for economy shape, poor for spatial DPS; a custom sim is still needed.

### Daniel Cook (Lostgarden)
- [Loops and Arcs](https://lostgarden.com/2012/04/30/loops-and-arcs/) and [Value chains](https://lostgarden.com/2021/12/12/value-chains/) (snippet): model each resource as a chain from faucet to an anchor motivation; forces a statement of what gold is *for* per wave, the precondition for a testable budget.

### Sirlin
- [Balancing Multiplayer Games, Part 1](https://www.sirlin.net/articles/balancing-multiplayer-games-part-1-definitions) and sequels (snippet). Balance = many *viable* options at high-level play; a strictly dominant option destroys strategy. For a single-player TD, "viable options" means multiple tower mixes clear the invariant within margin, measurable by a bot sweep.

### Sylvester, *Designing Games*, Ch. 6 "Balance"
- Sections: goals of balance, fairness, depth, degenerate strategies, the "viable strategy-counting fallacy" (snippet). Harvest *experiences, not suggestions* from playtests ([review](https://www.gbgames.com/2014/05/07/book-review-designing-games-by-tynan-sylvester/)).

### Lanchester's laws
- [Kicking Butt by the Numbers](https://www.gamedeveloper.com/design/the-designer-s-notebook-kicking-butt-by-the-numbers-lanchester-s-laws); [Combat Models for RTS Games](https://arxiv.org/pdf/1605.05305). Relevance to TD is limited: enemies do not shoot back, so there is no tower-side attrition. The real TD invariant is a **time integral**: sum over towers of DPS x seconds-each-enemy-spends-in-range >= wave effective HP. This is why range dominates: Lars Doucet notes range "has a far greater impact on a tower's total effectiveness than either damage per hit or rate of fire" ([Defender's Quest](https://www.gamedeveloper.com/design/optimizing-tower-defense-for-focus-and-thinking---defender-s-quest)) (snippet).

### Genre math
- Enemy HP typically grows geometrically (~8-12%/wave per [game-ace](https://game-ace.com/blog/engineering-of-tower-defense-games/)) while income grows roughly linearly; both failure directions are curve-fit problems.
- Interest (Vector TD lineage): Vector TD sold +3% interest as a purchasable bonus ([Jay is Games](https://jayisgames.com/review/vector-td.php)) (snippet). Legion TD 2 controls snowballing by tuning leak rewards per wave (25% to 151% changed to 25% to 179% across waves 1-21) ([SteamDB](https://steamdb.info/patchnotes/15345445/)) (snippet).

---

## 2. Practical tooling in industry and indie

### Spreadsheet-driven balance
- GDC [Spreadsheets Microtalks](https://gdcvault.com/play/1035719/Spreadsheets) (snippet). Open-source pipelines: [gdoc_tuning_exporter](https://github.com/handcircus/gdoc_tuning_exporter) (Sheets to JSON to Unity, explicitly for "continuous balancing"); [Beamable Game Content Designer](https://docs.beamable.com/docs/game-content-designer); [Spreadsheet Tools in Game Design](https://medium.com/@urpi/spreadsheet-tools-in-game-design-57511eac68c) (snippet).
- Not found: evidence that Slay the Spire uses a sheet pipeline (content is Java classes); Supercell/King/Riot internal practice beyond public balance posts.

### Headless simulation / Monte Carlo in TD studios
- **Infinitode 2 (Prineside)** is the best-documented TD case. Update 1.9.0 (July 2024) added a "Simulation" debug feature "to benchmark performance, detect synchronization issues, and simulate runs to collect statistics for rebalancing" ([blog](https://blog.infinitode.prineside.com/2024/07/infinitode-2-major-update-190-and.html)). The developer's [Lua game-loop simulation gist](https://gist.github.com/prineside/a3e94b140bcfb5f45f11b301c9636578) (fetched) builds a `GameSystemProvider`, sets a seed, queues scripted actions ("build Basic tower at 3:2 on frame 50"), steps until game over (>20k frames), and logs coin accumulation and score. **This is precisely the deterministic fixed-tick core + scripted-policy pattern.**
- **Legion TD 2** is data-driven: patches cite win rate, pick rate, opening win/usage rates, end-wave distribution; baseline pick rate 60%, win rate 50% ([v4.06 notes](https://preview.legiontd2.com/updates/v406-game-balance-ai-improvements/)) (snippet).
- Not found: any public statement that Ninja Kiwi, Element Studios, Die of Death or Hidden Path use automated simulation for balance.
- Non-TD analogue: MY.GAMES "Battle Runner" batches production player states through battles and reports statistics ([MY.GAMES](https://medium.com/my-games-company/beyond-the-routine-in-qa-how-we-automated-regression-testing-2f6a98d98415)) (snippet).

### Automated playtesting agents
- **King / Candy Crush:** [Human-Like Playtesting with Deep Learning](https://gwern.net/doc/reinforcement-learning/imitation-learning/2018-gudmundsson.pdf) (CIG 2018): a CNN trained on millions of human moves predicts level pass rates; reported to cut manual level adjustments ~95% ([PocketGamer.biz](https://www.pocketgamer.biz/crafting-candy-crushs-difficulty-blockers-level-design-ai-and-the-complexity-staircase/)). Caveat: bots predict pass rate and find outliers, not "feel."
- Commercial: [modl.ai](https://modl.ai/) (bots emulating skill levels); [Ludo.ai](https://ludo.ai/features) is ideation, not simulation.
- Academic lineage:
  - Volz, Rudolph, Naujoks, [Demonstrating the Feasibility of Automatic Game Balancing](https://arxiv.org/pdf/1603.03795) (GECCO 2016).
  - Morosan and Poli, [Automated Game Balancing in Ms PacMan and StarCraft Using Evolutionary Algorithms](https://www.researchgate.net/publication/315639209) (2017).
  - de Mesentier Silva et al., [Evolving the Hearthstone Meta](https://arxiv.org/abs/1907.01623) (CoG 2019): NSGA-II searches for the **minimum set of card-stat changes** that drives deck win rates to 50%. Closest template for "find the smallest tuning delta that restores the invariant."
  - Rupp et al., [Simulation-Driven Balancing of Competitive Game Levels with RL](https://arxiv.org/abs/2503.18748) (IEEE ToG 2024); code: [pcgrl-simulation-driven-balancing](https://github.com/FlorianRupp/pcgrl-simulation-driven-balancing).
  - Politowski et al., [Assessing Video Game Balance using Autonomous Agents](https://arxiv.org/abs/2304.08699) (2023): agents compare difficulty across game *versions*; a regression-testing framing.
  - Mukai et al., [Where Does Balance Break? Boundary Discovery for Game Balance Testing under a Finite Simulation Budget](https://arxiv.org/abs/2608.28364) (Aug 2026): locates the boundary between balanced and unbalanced parameter regions under noisy sims; win-rate heatmaps with an acceptable band (0.4-0.6) (snippet).
  - TD-specific: Tan et al., [Automated Evaluation for AI Controllers in Tower Defense Game Using Genetic Algorithm](https://link.springer.com/chapter/10.1007/978-3-642-40567-9_12) (2013); [Automating Tower Defense Game Level Design with Evolutionary Algorithms](https://ieeexplore.ieee.org/document/10770629/) (2024); [PCG for TD wave design](https://dl.acm.org/doi/fullHtml/10.1145/3564982.3564993).
  - Design-assistant systems: Browne's Ludi, Machado's [Cicero](https://arxiv.org/pdf/1907.03877), Cook and Colton's [Mechanic Miner](https://www.researchgate.net/publication/262400788), [RuleSmith: Multi-Agent LLMs for Automated Game Balancing](https://arxiv.org/pdf/2602.06232) (2026).

### Difficulty-curve visualization
- Standard artifacts: (a) player power vs opposition power over time (Schreiber L7), (b) flow-channel difficulty curves ([davetech](https://www.davetech.co.uk/difficultycurves)), (c) **win-rate heatmaps over 2-D parameter grids with an acceptance band** and cliff detection (Mukai et al.). No established source for the phrase "tension band"; treat it as our own term.

### Telemetry-driven balancing
- **Slay the Spire:** Giovannetti, [Metrics Driven Design and Balance](https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics) (GDC 2019; [slides](https://media.gdcvault.com/gdc2019/presentations/Giovannetti_Anthony_SlayTheSpire.pdf)). Every run reported: card pick rate when offered, what it was picked over, presence in winning decks, damage taken per enemy; explicitly "not a mathematical approach" ([Game Developer](https://www.gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder)) (snippet).
- **Into the Breach:** Justin Ma: "a single additional enemy can turn a battle from a fun challenge to completely impossible"; low randomness made tuning tractable ([Road to the IGF](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-)) (snippet).
- **Published thresholds worth copying as a pattern:** Riot's Champion Balance Framework (OP if win rate >54.5% Average / >54% Skilled with ban rate below ~7%) ([Riot /dev](https://nexus.leagueoflegends.com/en-us/2019/05/dev-champion-balance-framework/)); Supercell: card healthy at 5-15% usage ([Clash Royale](https://supercell.com/en/games/clashroyale/blog/release-notes/may-balance-changes-2/)) (snippet).

---

## 3. Knife-edge techniques for TD

1. **Explicit invariants, checked per wave.** For each wave n and map: `Budget(n) = start_gold + sum over k<n of (kill_gold_k + wave_bonus_k + interest_k)`; `MinDefenseCost(n) = min cost of a tower set whose integral of DPS x time-in-range >= EHP(wave n) x (1 + leak_tolerance)`. Assert `Budget(n) >= MinDefenseCost(n) x (1 + margin_n)` with a designed `margin_n` (e.g., 8-15% early, tightening to 3-5% late). Schreiber's power-curve framing gives the two curves; Legion TD 2 and Riot show shipped teams publish exactly such bands.
2. **Perfect-play baseline solver.** Difficulty is set as a fraction of a solver's ceiling, not by feel. Prior art: the [Bloons ILP paper](https://optimization-online.org/2025/12/modeling-bloons-tower-defense-as-a-temporal-two-dimensional-knapsack-problem-with-irregular-shapes-and-side-constraints-integer-programming-based-approaches/) (Dec 2025) formulates BTD as a temporal 2-D knapsack with greedy per-round and multi-round ILPs; [btd6-farm-optimizer](https://github.com/DeSince29/btd6-farm-optimizer) uses DP + beam search; Tan et al. 2013 use GA. Practical ladder for a small team: greedy DPS-per-gold placement, then beam search over build orders, then occasional exact ILP on small maps to calibrate the greedy bot's gap.
3. **Bot ladder as difficulty ruler.** Run random / greedy / beam / "k-mistake" bots (greedy with k forced suboptimal purchases). Publish the target as "wave 12 is cleared by greedy-with-at-most-3-mistakes >=95% of seeds, and by random <5%."
4. **Boundary discovery, not point checks.** Sweep two parameters at a time (HP growth x interest rate; tower cost multiplier x wave bonus), plot clear-rate heatmaps with an acceptance band, look for cliffs (Mukai et al. 2026).
5. **Regression pinning.** Every overpowered build a fuzzer or player finds becomes a fixed-seed test that must keep failing (spirefall does this). Hearthstone-meta style search for the *minimum* stat delta that restores the invariant keeps knife-edge changes small.
6. **Variance, not just mean.** RNG makes clear rate a distribution; report P5/P50/P95 wave reached per seed batch and require the P5 to satisfy the invariant.

---

## 4. Recommended architecture for a small team

```
/sim        deterministic core: fixed tick (e.g., 20 Hz), integer or fixed-point positions,
            seeded PRNG (PCG32/xoshiro) injected, zero rendering/IO imports
/data       towers.csv, enemies.csv, waves.csv, economy.json (sheet -> CSV export,
            schema-validated on load; git-versioned)
/policies   random, greedy(DPS-per-gold, range-weighted), beam(build orders), k-mistake wrapper,
            replay(commands)
/cli        run --seed N --policy greedy --map M --waves 40 --out run.jsonl
            sweep --param hp_growth=1.06..1.14:0.01 --param interest=0..0.05 --runs 200
/report     jsonl -> CSV -> charts (clear-rate heatmap, budget-vs-min-defense per wave,
            P5/P50/P95 wave reached)
/tests      snapshot: golden run hashes per (map, seed, policy); invariants per wave;
            pinned exploit seeds; boundary checks (+-5% on each tunable must not flip pass/fail)
```

- Game = `(data, seed, command list)` so replays, saves, bots and tests are one mechanism. The client renders by interpolating sim state; the sim never reads wall-clock.
- Run sweeps in CI nightly; fail the build if any pinned invariant or golden hash changes without a data-file diff.

**Open-source references (small hobby projects, architecturally on point):**
- [yudongqagent/void-bastion](https://github.com/yudongqagent/void-bastion): `balance.js` holds every tunable and is imported by `tools/simulate.mjs` (`--runs`, `--sweep`) and `tools/headless.mjs`.
- [reaperhulk/spirefall](https://github.com/reaperhulk/spirefall): "pure, deterministic, headless simulation core; a full run is just (meta, seed, commands)"; strategy bots play entire careers in CI and assert the difficulty curve; an evolutionary build fuzzer searches for OP builds with regression tests pinning past finds.
- [Calculator5329/neon-vector-defense](https://github.com/Calculator5329/neon-vector-defense): seeded RNG + fixed timestep; `npm run balance` simulates map x protocol x bot matrices, writes `balance-report.json`.
- [DJLougen/ai-gym-tower-defense](https://github.com/DJLougen/ai-gym-tower-defense): Gymnasium TD env, pure NumPy, seeded, greedy/random/PPO/LLM agents.
- [game_balance_simulator](https://github.com/ZakriaYounus/game_balance_simulator), [rpg-combat-simulator](https://github.com/boulder225/rpg-combat-simulator): generic Monte Carlo harnesses with sensitivity analysis and confidence intervals.
- [Prineside's Infinitode 2 Lua gist](https://gist.github.com/prineside/a3e94b140bcfb5f45f11b301c9636578): developer-provided scripted sim of a shipped TD.

**Gaps not closed:** no primary text from Schreiber's Level 3/7, Machinations articles, StS slides or the Bloons ILP manuscript (blocked); no evidence of simulation use at Ninja Kiwi, Element Studios, Die of Death or Hidden Path; no canonical source for "tension band."
