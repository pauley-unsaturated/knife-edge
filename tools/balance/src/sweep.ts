import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  deriveData,
  withDifficulty,
  runReplay,
  type RawGameData,
  type Difficulty,
} from "@knife-edge/sim";
import { runPolicy, summarize } from "./runner.js";
import { makePolicy } from "./policies/index.js";

const mode = process.argv[2] ?? "presets";
const count = Number(process.argv[3] ?? 20);
if (
  !Number.isInteger(count) ||
  count < 1 ||
  count > 1000 ||
  !["presets", "profiles", "economy", "sensitivity"].includes(mode)
)
  throw new Error(
    "usage: sweep.ts presets|profiles|economy|sensitivity [1–1000 seeds]",
  );
const root = `experiments/0002-playable-bands/out/${mode}-${count}`;
mkdirSync(root, { recursive: true });
const base = JSON.parse(readFileSync("data/game.json", "utf8")) as RawGameData;
const cases: { name: string; raw: RawGameData }[] = [];
if (mode === "economy") {
  for (const startGold of [90, 120, 150])
    for (const bountyBase of [1, 2, 3])
      for (const interestBp of [0, 300, 600]) {
        const raw = structuredClone(base);
        Object.assign(raw.economy, { startGold, bountyBase, interestBp });
        const name = `gold${startGold}-bounty${bountyBase}-interest${interestBp}`;
        raw.version += `+${name}`;
        cases.push({ name, raw });
      }
} else if (mode === "sensitivity") {
  for (const key of ["startGold", "interestBp", "interestCapGold"] as const)
    for (const bp of [9500, 10500]) {
      const raw = structuredClone(base);
      raw.economy[key] = Math.round((raw.economy[key] * bp) / 10000);
      raw.version += `+${key}${bp}`;
      cases.push({ name: `${key}${bp}`, raw });
    }
  for (const bp of [9500, 10500]) {
    const raw = structuredClone(base);
    raw.composer.budgetBase = Math.round(
      (raw.composer.budgetBase * bp) / 10000,
    );
    raw.version += `+budget${bp}`;
    cases.push({ name: `budget${bp}`, raw });
  }
} else {
  for (const difficulty of ["easy", "medium", "hard"] as Difficulty[])
    cases.push({ name: difficulty, raw: withDifficulty(base, difficulty) });
}
const reports: unknown[] = [];
for (const c of cases) {
  const data = deriveData(c.raw);
  const dir = `${root}/${c.name}`;
  mkdirSync(dir, { recursive: true });
  for (const policy of mode === "profiles"
    ? ["player-deliberate", "player-hesitant", "player-rushed4x"]
    : mode === "presets"
      ? [
          "greedy",
          "random",
          "greedy-k1",
          "greedy-k3",
          "greedy-reserve60",
          "greedy-relics",
        ]
      : ["greedy", "random", "greedy-reserve60"]) {
    const rows = [];
    for (let seed = 1; seed <= count; seed++) {
      const run = runPolicy(data, makePolicy(policy), seed);
      const replayed = runReplay(data, run.replay, 400000);
      if (run.finalHash !== replayed.finalHash)
        throw new Error(`replay mismatch ${c.name}/${policy}/${seed}`);
      writeFileSync(
        `${dir}/${policy}-${seed}.replay.json`,
        JSON.stringify(run.replay),
      );
      const { replay: _, ...row } = run;
      rows.push(row);
    }
    writeFileSync(
      `${dir}/${policy}.jsonl`,
      rows.map((r) => JSON.stringify(r)).join("\n") + "\n",
    );
    const report = {
      case: c.name,
      data: data.version,
      ...summarize(rows as Parameters<typeof summarize>[0]),
      replayVerified: count,
    };
    reports.push(report);
    console.log(JSON.stringify(report));
  }
}
writeFileSync(`${root}/report.json`, JSON.stringify(reports, null, 2));
