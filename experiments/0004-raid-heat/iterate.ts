import { mkdirSync, writeFileSync } from "node:fs";
import { deriveData, runReplay, withDifficulty } from "../../packages/sim/src/index.ts";
import { makePolicy } from "../../tools/balance/src/policies/index.ts";
import { runPolicy, summarize } from "../../tools/balance/src/runner.ts";
import { variant, type Variant } from "./variants.ts";

const start = Number(process.argv[2] ?? 1), count = Number(process.argv[3] ?? 40);
const round = process.argv[4] ?? "round2";
const reports = [];
for (const name of ["raid", "compound", "pact"] as Variant[]) {
  const raw = variant(name);
  const data = deriveData(withDifficulty(raw, "medium"));
  const out = `experiments/0004-raid-heat/out/${round}-${name}-${start}-${count}`;
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/data.json`, JSON.stringify(raw, null, 2));
  for (const policy of ["greedy", "greedy-relics", "synergy-rookie", "synergy-deliberate", "synergy-expert", ...(name === "raid" ? ["synergy-no-raids", "synergy-all-raids"] : []), "force-cold", "force-blast", "force-ember", "force-arc", ...(name === "compound" ? ["banker"] : name === "pact" ? ["pact"] : [])]) {
    const rows = Array.from({ length: count }, (_, i) => runPolicy(data, makePolicy(policy), start + i));
    for (const row of rows) {
      if (runReplay(data, row.replay, 400000).finalHash !== row.finalHash) throw new Error("Replay mismatch");
      writeFileSync(`${out}/${policy}-${row.seed}.replay.json`, JSON.stringify(row.replay));
    }
    const report = { variant: name, ...summarize(rows) };
    reports.push(report);
    writeFileSync(`${out}/${policy}.report.json`, JSON.stringify(report));
    console.log(JSON.stringify(report));
  }
}
writeFileSync(`experiments/0004-raid-heat/out/${round}-${start}-${count}.json`, JSON.stringify(reports, null, 2));
