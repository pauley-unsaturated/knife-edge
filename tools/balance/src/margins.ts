import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  deriveData,
  runReplay,
  withDifficulty,
  type Difficulty,
  type RawGameData,
} from "@knife-edge/sim";
import { makePolicy } from "./policies/index.js";
import { runPolicy } from "./runner.js";
import { probeDefense } from "./margin.js";

const raw = JSON.parse(readFileSync("data/game.json", "utf8")) as RawGameData;
const seed = Number(process.argv[2] ?? 7);
const difficulty = (process.argv[3] ?? "medium") as Difficulty;
const data = deriveData(withDifficulty(raw, difficulty));
const run = runPolicy(data, makePolicy("greedy"), seed);
const out = `experiments/0002-playable-bands/out/margins/${difficulty}-${seed}`;
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/run.replay.json`, JSON.stringify(run.replay));
const rows = [];
for (let wave = 1; wave <= run.budgetAtWaveStart.length; wave++) {
  const budget = run.budgetAtWaveStart[wave - 1]!;
  const probe = probeDefense(data, seed, wave, budget * 2);
  if (probe.replay) {
    const replayed = runReplay(
      deriveData(probe.replay.data!),
      probe.replay,
      400000,
    );
    if (replayed.finalHash !== probe.replay.finalHash)
      throw new Error("probe replay mismatch");
    writeFileSync(
      `${out}/wave-${wave}.replay.json`,
      JSON.stringify(probe.replay),
    );
  }
  const row = {
    wave,
    budget,
    minDefenseCostUpperBound: probe.cost,
    marginLowerBound: probe.cost === null ? null : budget / probe.cost - 1,
    attempts: probe.attempts,
  };
  rows.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync(`${out}/margins.json`, JSON.stringify(rows, null, 2));
