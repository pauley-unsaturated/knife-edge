import { runReplay, type GameData, type Replay } from "@knife-edge/sim";
import { makePolicy } from "./policies/index.js";
import { runPolicy } from "./runner.js";

/** Compare one human replay against reference policies on its exact data, seed and horizon. */
export function comparePlayer(data: GameData, replay: Replay) {
  const human = runReplay(data, replay, 400000);
  if (replay.finalHash !== undefined && replay.finalHash !== human.finalHash)
    throw new Error("Human replay failed verification");
  if (replay.initialWave)
    throw new Error("Use a normal run, not an isolated-wave probe");
  const rows = [
    {
      policy: "human",
      outcome: human.state.outcome,
      wavesCleared: human.state.stats.wavesCleared,
      lives: human.state.lives,
      leaks: human.state.stats.leaks,
      spent: human.state.stats.goldSpent,
      commands: replay.commands.length,
    },
  ];
  for (const policy of [
    "random",
    "greedy",
    "greedy-k3",
    "greedy-reserve60",
    "greedy-relics",
    ...Object.keys(data.playerProfiles ?? {}).map((p) => `player-${p}`),
  ]) {
    const bot = runPolicy(data, makePolicy(policy), replay.seed, human.ticks);
    rows.push({
      policy,
      outcome: bot.outcome === "timeout" ? "playing" : bot.outcome,
      wavesCleared: bot.wavesCleared,
      lives: bot.lives,
      leaks: bot.leaks,
      spent: bot.goldSpent,
      commands: bot.replay.commands.length,
    });
  }
  return {
    seed: replay.seed,
    dataVersion: data.version,
    ticksCompared: human.ticks,
    rows,
    caveat:
      "Same simulated-time horizon; pause time and planning are not an intelligence score. Calibrate over several human seeds, with and without relics.",
  };
}
