import { mkdirSync, writeFileSync } from "node:fs";
import { deriveData, runReplay } from "../../packages/sim/src/index.ts";
import { makePolicy } from "../../tools/balance/src/policies/index.ts";
import { runPolicy, summarize } from "../../tools/balance/src/runner.ts";
import { variant, type Variant } from "./variants.ts";

const reports = [];
for (const name of ["raid", "compound", "pact"] as Variant[]) for (const hp of [10400, 10700]) {
  const raw = variant(name);
  // Offset richer upgrade efficiency with geometric pressure, not a wave12 cliff.
  raw.composer.hpGrowthBp = name === "compound" ? hp - 400 : hp;
  Object.assign(raw.towers.find(t => t.id === "ember")!, { costGrowthBp: 14000, damageGrowthBp: 24000 });
  Object.assign(raw.towers.find(t => t.id === "mortar")!, { costGrowthBp: 14000, damageGrowthBp: 23500 });
  const data = deriveData(raw);
  const out = `experiments/0004-raid-heat/out/crossover-${name}-${hp}`;
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/data.json`, JSON.stringify(raw, null, 2));
  for (const policy of ["greedy-relics", "synergy-expert", name === "compound" ? "banker" : name === "pact" ? "pact" : "force-blast"]) {
    const rows = Array.from({ length: 20 }, (_, i) => runPolicy(data, makePolicy(policy), i + 1));
    for (const r of rows) {
      if (runReplay(data, r.replay, 400000).finalHash !== r.finalHash) throw new Error("Replay mismatch");
      writeFileSync(`${out}/${policy}-${r.seed}.replay.json`, JSON.stringify(r.replay));
    }
    const report = { name, hp, ...summarize(rows), upgrades: rows.map(r => r.replay.commands.filter(c => c.cmd.kind === "upgrade").length) };
    reports.push(report);
    console.log(JSON.stringify(report));
  }
}
writeFileSync("experiments/0004-raid-heat/out/crossover-report.json", JSON.stringify(reports, null, 2));
