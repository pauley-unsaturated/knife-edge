import { deriveData, runReplay } from "../../packages/sim/src/index.ts";
import { makePolicy } from "../../tools/balance/src/policies/index.ts";
import { runPolicy, summarize } from "../../tools/balance/src/runner.ts";
import { candidate } from "./candidate.ts";
import { mkdirSync, writeFileSync } from "node:fs";

for (const budget of [140, 180, 220]) for (const growth of [11600, 12000]) {
  const raw = candidate(growth, 10000, 16);
  raw.composer.budgetBase = budget;
  raw.composer.openingBudgets = [60, 200, 280];
  const data = deriveData(raw);
  const out = `experiments/0004-raid-heat/out/explore-${budget}-${growth}`;
  mkdirSync(out, { recursive: true });
  for (const policy of ["greedy", "synergy", "synergy-no-raids", "synergy-all-raids"]) {
    const rows = Array.from({ length: 20 }, (_, i) => runPolicy(data, makePolicy(policy), i + 1));
    for (const row of rows) {
      if (runReplay(data, row.replay, 400000).finalHash !== row.finalHash) throw new Error("Replay mismatch");
      writeFileSync(`${out}/${policy}-${row.seed}.replay.json`, JSON.stringify(row.replay));
    }
    const report = { budget, growth, ...summarize(rows) };
    writeFileSync(`${out}/${policy}.report.json`, JSON.stringify(report));
    console.log(JSON.stringify(report));
  }
}
