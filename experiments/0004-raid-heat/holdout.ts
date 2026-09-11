/**
 * Frozen pre-crossover mechanics: 120 disjoint-board runs plus 36 fixed-board
 * loot-offset runs. Run with: nice -n 10 pnpm exec tsx experiments/0004-raid-heat/holdout.ts
 * This samples oracle-assisted heuristics, not calibrated human skill levels.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createState,
  deriveData,
  fnv1a,
  runReplay,
  type GameData,
  type RawGameData,
} from "../../packages/sim/src/index.ts";
import { raiderPolicy } from "../../tools/balance/src/policies/raider.ts";
import { runPolicy, summarize, type RunSummary } from "../../tools/balance/src/runner.ts";
import { variant, type Variant } from "./variants.ts";

const ROOT = fileURLToPath(new URL("./out/holdout-pre-crossover/", import.meta.url));
const NAMES: Variant[] = ["raid", "compound", "pact"];
const EXPERT: Record<Variant, string> = {
  raid: "synergy-expert", compound: "banker", pact: "pact",
};
// Capture every configuration before any runs; concurrent development cannot
// silently mix variant generations within this process. Each replay embeds it.
const CONFIGS = Object.fromEntries(NAMES.map((name) => [name, variant(name)])) as Record<Variant, RawGameData>;
mkdirSync(ROOT, { recursive: true });
for (const name of NAMES)
  writeFileSync(`${ROOT}/${name}.data.json`, JSON.stringify(CONFIGS[name], null, 2));

function boardHash(data: GameData, seed: number): number {
  const { grid } = createState(data, seed);
  return fnv1a(JSON.stringify({
    width: grid.width, height: grid.height, entry: grid.entry, core: grid.core,
    obstacle: Array.from(grid.obstacle),
  }));
}

function verifyAndSave(data: GameData, row: RunSummary, group: string, name: Variant, offset: number | null) {
  const rejects: { tick: number; kind: string; reason: string }[] = [];
  const replayed = runReplay(data, row.replay, 400000, (tick, events) => {
    for (const event of events)
      if (event.kind === "rejected") rejects.push({ tick, kind: event.cmd.kind, reason: event.reason });
  });
  if (replayed.finalHash !== row.finalHash || replayed.ticks !== row.ticks)
    throw new Error(`Replay mismatch: ${name} ${row.policy} ${row.seed} offset ${offset}`);
  const typeCounts: Record<string, number> = {};
  const typeInvestment: Record<string, number> = {};
  const levelCounts: Record<string, number> = {};
  for (const tower of replayed.state.towers) {
    typeCounts[tower.type] = (typeCounts[tower.type] ?? 0) + 1;
    typeInvestment[tower.type] = (typeInvestment[tower.type] ?? 0) + tower.spent;
    levelCounts[tower.level] = (levelCounts[tower.level] ?? 0) + 1;
  }
  const directory = `${ROOT}/${group}/${name}`;
  mkdirSync(directory, { recursive: true });
  const basename = `${row.policy}-${row.seed}${offset === null ? "" : `-loot-${offset}`}`;
  writeFileSync(`${directory}/${basename}.replay.json`, JSON.stringify(row.replay));
  const { replay, ...summary } = row;
  return {
    ...summary,
    variant: name,
    group,
    offerSeedOffset: offset,
    boardHash: boardHash(data, row.seed),
    replayVerified: true,
    replayFile: `${group}/${name}/${basename}.replay.json`,
    dataVersion: data.version,
    dataHash: fnv1a(JSON.stringify(replay.data)),
    chosenDrops: replayed.state.relics,
    raids: replayed.state.raided ?? [],
    typeCounts,
    typeInvestment,
    levelCounts,
    rejectedCommands: rejects,
  };
}

function runBatch(name: Variant, policy: string, group: "disjoint" | "fixed-board-loot") {
  const runs: RunSummary[] = [];
  const rows: ReturnType<typeof verifyAndSave>[] = [];
  const count = group === "disjoint" ? 20 : 12;
  for (let i = 0; i < count; i++) {
    const offset = group === "disjoint" ? null : i + 1;
    const raw = structuredClone(CONFIGS[name]);
    if (offset !== null) {
      raw.version += `/loot-offset-${offset}`;
      raw.relicRules.offerSeedOffset = offset;
    }
    const data = deriveData(raw);
    const row = runPolicy(data, raiderPolicy(policy), group === "disjoint" ? 101 + i : 7);
    runs.push(row);
    rows.push(verifyAndSave(data, row, group, name, offset));
  }
  if (group === "fixed-board-loot" && new Set(rows.map((r) => r.boardHash)).size !== 1)
    throw new Error(`Loot offsets unexpectedly changed the board: ${name}`);
  const report = {
    ...summarize(runs),
    variant: name,
    group,
    skillLabel: policy === "synergy-rookie"
      ? "Simplified oracle-assisted rookie heuristic; not a calibrated human novice"
      : "Mechanic-aware oracle-assisted heuristic; not a calibrated human expert",
    dataHash: fnv1a(JSON.stringify(CONFIGS[name])),
    seedRange: group === "disjoint" ? [101, 120] : [7, 7],
    lootOffsets: group === "disjoint" ? null : [1, 12],
    allReplaysVerified: rows.every((r) => r.replayVerified),
    rejectedCommands: rows.reduce((n, r) => n + r.rejectedCommands.length, 0),
    winners: rows.filter((r) => r.outcome === "won").map((r) => ({
      seed: r.seed,
      offerSeedOffset: r.offerSeedOffset,
      lives: r.lives,
      chosenDrops: r.chosenDrops,
      typeCounts: r.typeCounts,
      typeInvestment: r.typeInvestment,
      levelCounts: r.levelCounts,
      interestEarned: r.interestEarned,
      raids: r.raids,
      replayFile: r.replayFile,
    })),
    rows,
  };
  writeFileSync(`${ROOT}/${group}/${name}/${policy}.report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, rows: undefined, winners: undefined }));
  return report;
}

const reports = [];
for (const name of NAMES) {
  reports.push(runBatch(name, EXPERT[name], "disjoint"));
  reports.push(runBatch(name, "synergy-rookie", "disjoint"));
}
for (const name of NAMES) reports.push(runBatch(name, EXPERT[name], "fixed-board-loot"));
const summary = {
  hypothesis: "Mechanic-aware heuristics should retain occasional full clears on disjoint boards while weaker heuristics struggle. With board 7 fixed, independent loot offsets should change successful loadouts and outcomes rather than merely restating board luck.",
  method: "Exactly 120 runs on seeds101..120, expert and rookie per branch, plus36 fixed-board7 runs with loot offsets1..12. Configuration snapshots captured before runs; unchanged pre-upgrade-crossover rules. Every run embeds its data and verifies its replay hash.",
  caveat: "Oracle-assisted driver labels are heuristic policies, not human skill calibration. Twenty runs yield wide confidence intervals. Fixed-board variation changes only the offer stream at configuration level, but players adapt and later combat changes consequently. These findings qualify candidate mechanics, not subjective fun.",
  runs: reports.reduce((n, r) => n + r.runs, 0),
  allReplaysVerified: reports.every((r) => r.allReplaysVerified),
  reports: reports.map(({ rows, ...report }) => report),
};
writeFileSync(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ output: `${ROOT}/summary.json`, runs: summary.runs, allReplaysVerified: summary.allReplaysVerified }));
