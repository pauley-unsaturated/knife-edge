import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createState,
  deriveData,
  hashState,
  makeReplay,
  runReplay,
  step,
  validateReplay,
  type TimedCommand,
} from "../../packages/sim/src/index.ts";

const source = process.argv[2];
if (!source) throw new Error("Pass the human replay path");
const original = validateReplay(JSON.parse(readFileSync(source, "utf8")));
if (!original.data) throw new Error("Embedded data required");
const data = deriveData(original.data);
const out = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(out, { recursive: true });

function analyze(commands: TimedCommand[], limit = 400000) {
  const state = createState(data, original.seed);
  const waves = [];
  const rejected = [];
  let ci = 0;
  let closest = Infinity;
  let previousSpend = 0;
  while (state.outcome === "playing" && state.tick < limit) {
    const batch = [];
    while (ci < commands.length && commands[ci]!.tick === state.tick)
      batch.push(commands[ci++]!.cmd);
    const events = step(data, state, batch);
    for (const e of state.enemies)
      closest = Math.min(
        closest,
        e.next < 0 ? 0 : state.dist[e.next]! + 1 - e.progress / 1024,
      );
    for (const event of events)
      if (event.kind === "rejected")
        rejected.push({ tick: state.tick - 1, ...event });
    if (events.some((e) => e.kind === "waveEnd")) {
      waves.push({
        wave: state.wave,
        tick: state.tick,
        gold: state.gold,
        spent: state.stats.goldSpent,
        newSpending: state.stats.goldSpent - previousSpend,
        lives: state.lives,
        closestSurvivingEnemyCells: closest,
        pathLength: state.dist[state.grid.entry],
        towers: state.towers.length,
      });
      closest = Infinity;
      previousSpend = state.stats.goldSpent;
    }
  }
  const replay = makeReplay(
    data,
    state,
    commands.filter((c) => c.tick < state.tick),
  );
  if (runReplay(data, replay, 400000).finalHash !== replay.finalHash)
    throw new Error("Counterfactual replay verification failed");
  return { state, waves, rejected, replay };
}

const human = analyze(original.commands, original.endTick);
if (hashState(human.state) !== original.finalHash)
  throw new Error("Original replay verification failed");
const variants = [];
for (const wave of human.waves) {
  const result = analyze(original.commands.filter((c) => c.tick < wave.tick));
  const name = `stop-after-wave-${wave.wave}`;
  writeFileSync(`${out}${name}.replay.json`, JSON.stringify(result.replay));
  variants.push({
    name,
    outcome: result.state.outcome,
    wavesCleared: result.state.stats.wavesCleared,
    lives: result.state.lives,
    spent: result.state.stats.goldSpent,
    gold: result.state.gold,
    rejected: result.rejected.length,
  });
}
const noPatches = analyze(
  original.commands.filter((c) => c.cmd.kind !== "pickRelic"),
);
writeFileSync(`${out}no-patches.replay.json`, JSON.stringify(noPatches.replay));
const report = {
  sourceHash: original.finalHash,
  verified: true,
  human: {
    ...human.state.stats,
    gold: human.state.gold,
    relics: human.state.relics,
    commands: original.commands.length,
    rejected: human.rejected,
    waves: human.waves,
  },
  variants,
  noPatches: {
    outcome: noPatches.state.outcome,
    lives: noPatches.state.lives,
    spent: noPatches.state.stats.goldSpent,
    gold: noPatches.state.gold,
    rejected: noPatches.rejected,
  },
};
writeFileSync(`${out}report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
