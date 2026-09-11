/**
 * pnpm exec tsx experiments/0004-raid-heat/engine-sweep.ts [count=16] [start=1]
 *   [label=engines-round4] [--diagonal | --easy-rookie-only | --prepared-only]
 * Existing configuration output is not silently overwritten with new knobs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  deriveData, fnv1a, runReplay, withDifficulty,
  type Difficulty, type RawGameData,
} from "../../packages/sim/src/index.ts";
import { makePolicy } from "../../tools/balance/src/policies/index.ts";
import { greedyPolicy } from "../../tools/balance/src/policies/greedy.ts";
import { engineerPolicy, evaluateEngineerOffers } from "../../tools/balance/src/policies/engineer.ts";
import { raiderPolicy } from "../../tools/balance/src/policies/raider.ts";
import type { Policy } from "../../tools/balance/src/policy.ts";
import { runPolicy, summarize, type RunSummary } from "../../tools/balance/src/runner.ts";
import { engines } from "./engines.ts";
import type { Variant } from "./variants.ts";

const count = Number(process.argv[2] ?? 16);
const start = Number(process.argv[3] ?? 1);
const label = process.argv[4] ?? "engines-round4";
if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isInteger(start) || start < 0 || !/^[a-z0-9-]+$/.test(label))
  throw new Error("Use count1..100, nonnegative start seed, and a lowercase-hyphen label");
const ROOT = fileURLToPath(new URL(`./out/${label}-${start}-${count}/`, import.meta.url));
const VARIANTS: Variant[] = ["raid", "compound", "pact"];
const CONFIGS = Object.fromEntries(VARIANTS.map((name) => [name, engines(name)])) as Record<Variant, RawGameData>;
mkdirSync(ROOT, { recursive: true });
for (const name of VARIANTS) {
  const file = `${ROOT}/${name}.data.json`;
  if (existsSync(file) && JSON.stringify(JSON.parse(readFileSync(file, "utf8"))) !== JSON.stringify(CONFIGS[name]))
    throw new Error(`Configuration differs from ${file}; use a new label`);
  writeFileSync(file, JSON.stringify(CONFIGS[name], null, 2));
}

/** Stress control, not a proposed human strategy. Warm start prevents inability
 * to clear the tutorial from concealing a later HP-scaled carrier exploit. */
function carrierPolicy(pure: boolean): Policy {
  const opener = raiderPolicy("synergy-rookie");
  const carrier = greedyPolicy({ callEarly: false, towerBias: { sprayer: 1000000 } });
  return {
    name: pure ? "carrier-pure" : "carrier-warm",
    decide(data, s, rng) {
      if (s.tick % 20) return [];
      if (s.relicOffers.length) {
        const ranked = evaluateEngineerOffers(data, s).map((offer) => {
          const relic = data.relics.find((r) => r.id === offer.id)!;
          // Confusion scales from enemy HP, unlike Sprayer's tiny poison dose.
          return { ...offer, score: offer.score + (relic.confusionDamageBp ? 100 : relic.hitSlowTicks ? 20 : relic.deathBurstBp ? 10 : relic.poisonDamageBp ? 5 : 0) };
        }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
        return ranked[0] ? [{ kind: "pickRelic", id: ranked[0].id }] : [];
      }
      if (!pure && s.towers.filter((t) => t.type === "bolt").length < 4)
        return opener.decide(data, s, rng);
      const commands = carrier.decide(data, s, rng).filter((c) =>
        c.kind === "build" ? c.type === "sprayer" :
        c.kind === "upgrade" ? s.towers.find((t) => t.cell === c.cell)?.type === "sprayer" : false);
      if (commands.length) return commands;
      return !s.inWave && s.wave > 0 ? [{ kind: "callWave" }] : [];
    },
  };
}

function runBatch(name: Variant, difficulty: Difficulty, policy: string, samples = count) {
  const data = deriveData(withDifficulty(structuredClone(CONFIGS[name]), difficulty));
  const directory = `${ROOT}/${difficulty}/${name}`;
  mkdirSync(directory, { recursive: true });
  const runs: RunSummary[] = [];
  const rows = [];
  for (let i = 0; i < samples; i++) {
    const driver = policy.startsWith("carrier-") ? carrierPolicy(policy === "carrier-pure") :
      policy.startsWith("engineer") ? engineerPolicy(policy) : makePolicy(policy);
    const run = runPolicy(data, driver, start + i);
    const rejected: { tick: number; kind: string; reason: string }[] = [];
    const supports: { tick: number; type: string; cell: number; cost: number }[] = [];
    const rerolls: { tick: number; cost: number; count: number }[] = [];
    const upgrades: { tick: number; cell: number; level: number }[] = [];
    let failedSupportBuilds = 0;
    const result = runReplay(data, run.replay, 400000, (tick, events) => {
      for (const e of events) {
        if (e.kind === "rejected") {
          rejected.push({ tick, kind: e.cmd.kind, reason: e.reason });
          if (e.cmd.kind === "build" && data.towerById.get(e.cmd.type)?.coating) failedSupportBuilds++;
        }
        if (e.kind === "build" && data.towerById.get(e.type)?.coating)
          supports.push({ tick, type: e.type, cell: e.cell, cost: data.towerById.get(e.type)!.cost });
        if (e.kind === "reroll") rerolls.push({ tick, cost: e.gold, count: e.count });
        if (e.kind === "upgrade") upgrades.push({ tick, cell: e.cell, level: e.level });
      }
    });
    if (result.finalHash !== run.finalHash || result.ticks !== run.ticks)
      throw new Error(`Replay mismatch: ${name}/${difficulty}/${policy}/${run.seed}`);
    const replayFile = `${difficulty}/${name}/${policy}-${run.seed}.replay.json`;
    writeFileSync(`${ROOT}/${replayFile}`, JSON.stringify(run.replay));
    const typeCounts: Record<string, number> = {};
    const typeInvestment: Record<string, number> = {};
    for (const t of result.state.towers) {
      typeCounts[t.type] = (typeCounts[t.type] ?? 0) + 1;
      typeInvestment[t.type] = (typeInvestment[t.type] ?? 0) + t.spent;
    }
    const { replay, ...summary } = run;
    rows.push({
      ...summary, replayFile, replayVerified: true, typeCounts, typeInvestment,
      chosenDrops: result.state.relics, supportBuilds: supports,
      failedSupportBuilds, rerolls, rerollFees: rerolls.reduce((n, r) => n + r.cost, 0),
      upgrades, rejectedCommands: rejected,
    });
    runs.push(run);
  }
  const summary = {
    variant: name, difficulty, dataVersion: data.version,
    dataHash: fnv1a(JSON.stringify(data)),
    ...summarize(runs),
    oracleAssisted: !policy.startsWith("carrier-pure"),
    label: policy.startsWith("carrier-") ? "Carrier exploit stress control" : "Heuristic driver, not calibrated human skill",
    rerollRuns: rows.filter((r) => r.rerolls.length).length,
    totalRerolls: rows.reduce((n, r) => n + r.rerolls.length, 0),
    rerollFees: rows.reduce((n, r) => n + r.rerollFees, 0),
    supportRuns: rows.filter((r) => r.supportBuilds.length).length,
    supportBuilds: rows.reduce((n, r) => n + r.supportBuilds.length, 0),
    failedSupportBuilds: rows.reduce((n, r) => n + r.failedSupportBuilds, 0),
    upgradedRuns: rows.filter((r) => r.upgrades.length).length,
    upgrades: rows.reduce((n, r) => n + r.upgrades.length, 0),
    rejectedCommands: rows.reduce((n, r) => n + r.rejectedCommands.length, 0),
    allReplaysVerified: true,
    winners: rows.filter((r) => r.outcome === "won").map((r) => ({
      seed: r.seed, lives: r.lives, chosenDrops: r.chosenDrops,
      typeCounts: r.typeCounts, typeInvestment: r.typeInvestment,
      upgrades: r.upgrades.length, supportBuilds: r.supportBuilds.length,
      rerolls: r.rerolls.length, rerollFees: r.rerollFees, replayFile: r.replayFile,
    })),
  };
  writeFileSync(`${directory}/${policy}.report.json`, JSON.stringify({ ...summary, rows }, null, 2));
  console.log(JSON.stringify({ ...summary, winners: undefined }));
  return summary;
}

const reports: ReturnType<typeof runBatch>[] = [];
if (process.argv.includes("--prepared-only")) {
  for (const name of VARIANTS)
    for (const policy of ["engineer", "engineer-prepared"])
      reports.push(runBatch(name, "medium", policy));
} else if (process.argv.includes("--easy-rookie-only")) {
  for (const name of VARIANTS) reports.push(runBatch(name, "easy", "engineer-rookie"));
} else {
  for (const name of VARIANTS)
    for (const policy of ["engineer", "engineer-no-reroll", "engineer-fish", "engineer-rookie", "force-ember", "force-arc", ...(name === "compound" ? ["banker"] : []), "carrier-pure", "carrier-warm"])
      reports.push(runBatch(name, "medium", policy));
}
if (process.argv.includes("--diagonal"))
  for (const name of VARIANTS)
    for (const difficulty of ["easy", "hard"] as const)
      reports.push(runBatch(name, difficulty, "engineer", Math.min(count, 6)));
const summary = {
  method: `Frozen engines.ts configuration, tuning seeds ${start}..${start + count - 1}. Every run replay verified; data snapshots and complete commands retained.`,
  caveats: [
    "Driver labels are not calibrated human skill; comparative outcomes do not certify fun.",
    "Carrier-pure may fail before obtaining drops; carrier-warm tests a four-Bolt opening followed by coating/status delivery.",
    "Kill events do not attribute direct/poison/confusion/burst sources; no attribution is inferred.",
    "Whole-policy reroll comparisons may change other choices; meaningful individual reroll/support tradeoffs require identical-checkpoint adaptive forks.",
  ],
  runs: reports.reduce((n, r) => n + r.runs, 0),
  allReplaysVerified: reports.every((r) => r.allReplaysVerified),
  reports,
};
writeFileSync(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ summaryFile: `${ROOT}/summary.json`, runs: summary.runs, allReplaysVerified: summary.allReplaysVerified }));
