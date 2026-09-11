/** Current 18-wave lab regression gate, not human calibration or a fun score.
 * Uses reused tuning seeds 1..N; fresh held-out evidence is a separate workflow.
 * pnpm validate:balance [8..200] (default 8; nightly 40)
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveData, enemyHpAtWave, runReplay, waveBudget, withDifficulty, type Difficulty, type GameData, type RawGameData } from "@knife-edge/sim";
import { assertEngineRun, neutralEnginePatches, runEngineValidation, summarizeEngineValidation, type CheckedEngineRun } from "./engine-validation.js";
import { makePolicy } from "./policies/index.js";

const VARIANTS = { raid: "data/game.json", compound: "data/compound.json", pact: "data/pact.json" } as const;
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const LAB_BANDS = { easyMinimum: 0.5, mediumMinimum: 0.125, hardMaximum: 0.875, neutralMaximum: 0.25, neutralMedianMaximum: 14 } as const;

export function labSampleCount(value = "8"): number {
  const count = Number(value);
  assert(Number.isSafeInteger(count) && count >= 8 && count <= 200, "use 8–200 reused tuning seeds");
  return count;
}

/** Design-shape regressions, not a solved combat difficulty estimate. Pressure
 * is budget × one fixed enemy's HP. Tier/count allocation and resistances mean
 * this proxy must never be described as actual damage required or player power. */
export function checkLabRules(raw: RawGameData) {
  const data = deriveData(raw);
  assert.equal(data.economy.maxWaves, 18, "current lab gate expects the 18-wave run; revise the gate explicitly for a new format");
  const prices = ["easy", "medium", "hard"].map((d) => raw.difficulties[d as Difficulty].defenseCostBp);
  assert(prices[0]! < prices[1]! && prices[1]! < prices[2]!, "difficulty prices must increase Easy < Medium < Hard");
  assert(data.economy.startGold >= Math.min(...data.towers.map((t) => t.cost)) * 2, "opening budget must buy at least two basic defenses");
  const first = 12, last = data.economy.maxWaves;
  assert(data.composer.growthBp > 10000 && data.composer.hpGrowthBp > 10000, "late pressure must grow geometrically");
  const reference = data.enemies[0]!;
  const budgetRatio = waveBudget(data, last) / waveBudget(data, first);
  const hpRatio = enemyHpAtWave(data, reference, last) / enemyHpAtWave(data, reference, first);
  assert(budgetRatio >= 1.5 && hpRatio >= 1.2, "late-third budget/HP growth disappeared");
  const maxBounty = (wave: number) => data.composer.maxEnemiesPerWave * (data.economy.bountyBase + data.economy.bountyPerWave * wave);
  assert(maxBounty(first) > 0 && budgetRatio * hpRatio > maxBounty(last) / maxBounty(first) * 1.5,
    "geometric pressure must outgrow the capped kill-bounty supply");
  return { fromWave: first, toWave: last, budgetRatio, hpRatio, pressureProxyRatio: budgetRatio * hpRatio,
    cappedBountyRatio: maxBounty(last) / maxBounty(first), caveat: "Proxy only; excludes interest, raids, resistance, placement and patch engines." };
}

export function checkLabResources(data: GameData, row: CheckedEngineRun, refunds = 0): void {
  assertEngineRun(row);
  const opening = row.earlyWaves.find((w) => w.wave === 1);
  assert(opening?.completed && opening.leaks === 0, `${row.policy}/${row.seed}: first wave is no longer free`);
  for (const value of [row.gold, row.goldEarned, row.goldSpent, row.rerollFees, refunds])
    assert(Number.isSafeInteger(value) && value >= 0, "resources must remain nonnegative safe integers");
  assert.equal(row.gold + row.goldSpent, data.economy.startGold + row.goldEarned + refunds, "cash conservation failed");
  assert(row.rerollFees <= row.goldSpent, "reroll fees must be paid from actual spending");
  // Several enemies may leak in one tick before terminal state is set. Signed
  // overkill core is valid on a loss; it is not an economic overdraft.
  assert(Number.isSafeInteger(row.lives) && row.lives <= data.economy.lives, "invalid core health");
  assert.equal(row.lives <= 0, row.outcome === "lost", "core and terminal outcome disagree");
  for (const w of row.waves) assert(Number.isSafeInteger(w.bank) && w.bank >= 0, "wave bank overdrawn");
}

type Report = ReturnType<typeof summarizeEngineValidation>;
export function checkLabBands(easy: Report, medium: Report, hard: Report, controls: readonly Report[]): void {
  assert(easy.winRate >= LAB_BANDS.easyMinimum, "Easy expert regression: fewer than half clear");
  assert(medium.winRate >= LAB_BANDS.mediumMinimum, "Medium expert regression: no meaningful winning floor");
  assert(hard.winRate <= LAB_BANDS.hardMaximum, "Hard expert regression: almost every run clears");
  assert(easy.winRate >= hard.winRate, "aggregate difficulty ordering reversed");
  for (const r of controls) {
    assert(r.winRate <= LAB_BANDS.neutralMaximum, `${r.policy}: neutral-patch control too strong`);
    assert(r.wavesP50 <= LAB_BANDS.neutralMedianMaximum, `${r.policy}: neutral-patch median bypasses the late wall`);
  }
}

function fingerprintSources(directory: string): Record<string, string> {
  return Object.fromEntries(readdirSync(join(ROOT, directory), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? Object.entries(fingerprintSources(path)) : entry.name.endsWith(".ts")
      ? [[path, createHash("sha256").update(readFileSync(join(ROOT, path))).digest("hex")]] : [];
  }));
}

export function runLabValidation(count = 8) {
  count = labSampleCount(String(count));
  const output = join(ROOT, `experiments/0004-raid-heat/out/ci-lab-${count}`);
  const configs = Object.fromEntries(Object.entries(VARIANTS).map(([name, path]) => [name, JSON.parse(readFileSync(join(ROOT, path), "utf8")) as RawGameData]));
  const rules = Object.fromEntries(Object.entries(configs).map(([name, raw]) => [name, checkLabRules(raw)]));
  const save = (path: string, data: unknown) => {
    const target = join(output, path);
    mkdirSync(resolve(target, ".."), { recursive: true });
    writeFileSync(target, JSON.stringify(data, null, 2));
  };
  save("manifest.json", { count, seeds: [1, count], bands: LAB_BANDS, rules,
    sources: { ...fingerprintSources("packages/sim/src"), ...fingerprintSources("tools/balance/src") },
    configs, purpose: "Broad current-lab regression only; reused tuning seeds, oracle-assisted heuristic, not human calibration or fun certification." });
  const reports: (Report & { variant: string; difficulty: Difficulty; neutral: boolean })[] = [];
  const boards = new Map<string, number>();
  for (const [variant, raw] of Object.entries(configs)) {
    function batch(difficulty: Difficulty, policy: string, neutral = false) {
      const data = deriveData(withDifficulty(neutral ? neutralEnginePatches(raw) : raw, difficulty));
      const rows: CheckedEngineRun[] = [];
      const prefix = `${variant}/${difficulty}/${policy}${neutral ? "-neutral" : ""}`;
      for (let seed = 1; seed <= count; seed++) {
        const row = runEngineValidation(data, makePolicy(policy), seed);
        const { replay, ...metrics } = row;
        save(`${prefix}-${seed}.replay.json`, replay);
        save(`${prefix}-${seed}.metrics.json`, metrics); // Preserve failing witness before asserting.
        let refunds = 0;
        if (replay.commands.some((c) => c.cmd.kind === "sell"))
          runReplay(data, replay, 400000, (_, events) => { for (const e of events) if (e.kind === "sell") refunds += e.refund; });
        checkLabResources(data, row, refunds);
        const key = `${variant}/${seed}`;
        assert(!boards.has(key) || boards.get(key) === row.boardFingerprint, "difficulty/control changed the board");
        boards.set(key, row.boardFingerprint);
        rows.push(row);
      }
      const report = { variant, difficulty, neutral, ...summarizeEngineValidation(rows) };
      save(`${prefix}.report.json`, report);
      reports.push(report);
      console.log(JSON.stringify(report));
      return report;
    }
    const easy = batch("easy", "engineer");
    const medium = batch("medium", "engineer");
    const hard = batch("hard", "engineer");
    const controls = [batch("medium", "force-arc", true), batch("medium", "force-ember", true)];
    checkLabBands(easy, medium, hard, controls);
  }
  const summary = { runs: count * 15, allReplaysVerified: true, rejectedCommands: 0, timeouts: 0, firstWaveLeakRuns: 0, rules, reports,
    caveats: ["Reused tuning-seed regression, not held-out validation or fun certification.", "No human intelligence/dexterity calibration is claimed.", "Neutral forced-type policies are stress baselines, not clean single-mechanic causal ablations.", "Pressure proxy is not a minimum-defense solver."] };
  save("summary.json", summary);
  console.log(`Lab regression gates passed: ${summary.runs} verified runs. Reports/replays: ${output}`);
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(process.argv.length <= 3, "usage: pnpm validate:balance [8..200]");
  runLabValidation(labSampleCount(process.argv[2]));
}
