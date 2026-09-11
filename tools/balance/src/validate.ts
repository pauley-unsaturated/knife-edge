/** Historical demo-1 gate, retained for the original 30-wave experiment only.
 * Not compatible with current shipped lab rules; use validate-lab.ts instead. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  deriveData,
  runReplay,
  withDifficulty,
  type Difficulty,
  type RawGameData,
} from "@knife-edge/sim";
import { makePolicy } from "./policies/index.js";
import { probeDefense } from "./margin.js";
import { percentile, runPolicy, summarize, type RunSummary } from "./runner.js";

const raw = JSON.parse(readFileSync("data/game.json", "utf8")) as RawGameData;
const count = Number(process.argv[2] ?? 20);
assert(
  Number.isInteger(count) && count >= 20 && count <= 1000,
  "use 20–1000 seeds",
);
const bands: Record<Difficulty, [number, number]> = {
  easy: [0.85, 1],
  medium: [0.6, 0.9],
  hard: [0.2, 0.65],
};
const reports = new Map<string, ReturnType<typeof summarize>>();
for (const difficulty of ["easy", "medium", "hard"] as const) {
  const data = deriveData(withDifficulty(raw, difficulty));
  for (const policy of ["greedy", "random", "greedy-k3", "greedy-reserve60"]) {
    const rows: RunSummary[] = [];
    for (let seed = 1; seed <= count; seed++) {
      const run = runPolicy(data, makePolicy(policy), seed);
      assert.notEqual(
        run.outcome,
        "timeout",
        `${difficulty}/${policy}/${seed} timed out`,
      );
      assert.equal(
        runReplay(data, run.replay, 400000).finalHash,
        run.finalHash,
        "replay parity",
      );
      rows.push(run);
    }
    const summary = summarize(rows);
    reports.set(`${difficulty}/${policy}`, summary);
    console.log(JSON.stringify({ difficulty, ...summary }));
    if (policy === "greedy") {
      const [lo, hi] = bands[difficulty];
      assert(
        summary.winRate >= lo && summary.winRate <= hi,
        `${difficulty}: greedy clear rate outside demo band ${lo}–${hi}`,
      );
      const winners = rows
        .filter((r) => r.outcome === "won")
        .map((r) => r.minutesAt1x)
        .sort((a, b) => a - b);
      const median = percentile(winners, 50);
      assert(
        median >= 25 && median <= 30,
        `${difficulty}: winning P50 duration ${median} is outside 25–30 min`,
      );
    }
  }
}
assert(
  reports.get("easy/greedy-k3")!.winRate >= 0.8,
  "Easy should forgive three poor opening purchases",
);
assert(
  reports.get("medium/random")!.winRate <= 0.1,
  "Medium random floor too strong",
);
assert(
  reports.get("hard/random")!.winRate <= 0.05,
  "Hard random floor too strong",
);
assert(
  reports.get("medium/greedy-reserve60")!.winRate <=
    reports.get("medium/greedy")!.winRate + 0.15,
  "Reserve strategy dominates baseline",
);
const medium = deriveData(withDifficulty(raw, "medium"));
const reference = runPolicy(medium, makePolicy("greedy"), 7);
for (const wave of [19, 24, 29]) {
  const budget = reference.budgetAtWaveStart[wave - 1]!;
  const probe = probeDefense(medium, 7, wave, budget * 2);
  assert(
    probe.cost !== null && probe.replay,
    `no zero-leak witness on reference wave ${wave}`,
  );
  const replayed = runReplay(
    deriveData(probe.replay.data!),
    probe.replay,
    400000,
  );
  assert.equal(replayed.finalHash, probe.replay.finalHash);
  assert.equal(replayed.state.stats.leaks, 0);
  const margin = budget / probe.cost - 1;
  assert(
    margin >= 0 && margin <= 0.5,
    `reference late-wave margin ${margin} outside provisional 0–50% band`,
  );
  console.log(
    JSON.stringify({
      seed: 7,
      wave,
      budget,
      minDefenseCostUpperBound: probe.cost,
      marginLowerBound: margin,
    }),
  );
}
console.log(
  "Demo difficulty gates passed. These are bot regression bands, not human calibration or proof of a solved minimum.",
);
