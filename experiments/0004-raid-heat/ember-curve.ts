/** Isolate the upgrade ladder from the global wave pressure. */
import { mkdirSync, writeFileSync } from "node:fs";
import { deriveData, runReplay, withDifficulty } from "../../packages/sim/src/index.ts";
import { makePolicy } from "../../tools/balance/src/policies/index.ts";
import { runPolicy, summarize } from "../../tools/balance/src/runner.ts";
import { engines } from "./engines.ts";
const out = "experiments/0004-raid-heat/out/ember-curve-round5";
mkdirSync(out, { recursive: true });
const reports = [];
for (const [name, levels, damageGrowthBp] of [["cap4", 4, 24000], ["gentler", 6, 22000], ["cap4-gentler", 4, 22000]] as const) {
  for (const neutral of [false, true]) {
    const raw = engines("raid");
    raw.version += `/${name}${neutral ? "-neutral" : ""}`;
    Object.assign(raw.towers.find(t => t.id === "ember")!, { levels, damageGrowthBp });
    if (neutral) for (const r of raw.relics) Object.assign(r, { damageBp: 10000, slowDamageBp: 10000, interestBp: 0, deathBurstBp: 0, poisonDamageBp: 0, confusionDamageBp: 0, hitSlowTicks: 0, hitSlowBp: 10000, lowLifeDamageBp: 10000, interestRateMultiplierBp: 10000, interestCapBonusGold: 0 });
    const data = deriveData(withDifficulty(raw, "medium"));
    const folder = `${out}/${name}${neutral ? "-neutral" : ""}`;
    mkdirSync(folder, { recursive: true });
    writeFileSync(`${folder}/data.json`, JSON.stringify(raw, null, 2));
    const rows = Array.from({ length: 16 }, (_, i) => runPolicy(data, makePolicy("force-ember"), i + 1));
    for (const row of rows) {
      if (runReplay(data, row.replay, 400000).finalHash !== row.finalHash) throw new Error("Replay mismatch");
      writeFileSync(`${folder}/${row.seed}.replay.json`, JSON.stringify(row.replay));
    }
    const summary = { name, neutral, ...summarize(rows) };
    reports.push(summary); console.log(JSON.stringify(summary));
    writeFileSync(`${out}/report.json`, JSON.stringify(reports, null, 2));
  }
}
