/** pnpm exec tsx experiments/0004-raid-heat/pressure.ts [count=16] [start=1] [label=pressure] */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deriveData, fnv1a, withDifficulty, type RawGameData } from "../../packages/sim/src/index.ts";
import { analyzeExploration, type ExplorationWitness } from "../../tools/balance/src/exploration.ts";
import { engineerPolicy } from "../../tools/balance/src/policies/engineer.ts";
import { makePolicy } from "../../tools/balance/src/policies/index.ts";
import { percentile, runPolicy, summarize, type RunSummary } from "../../tools/balance/src/runner.ts";
import { engines } from "./engines.ts";

const count = Number(process.argv[2] ?? 16), start = Number(process.argv[3] ?? 1), label = process.argv[4] ?? "pressure";
if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isInteger(start) || start < 0 || !/^[a-z0-9-]+$/.test(label)) throw new Error("Invalid count/start/label");
const root = fileURLToPath(new URL(`./out/${label}-${start}-${count}/`, import.meta.url));
const source = engines("raid");
source.relicRules.offerCount = 2;
Object.assign(source.towers.find(t => t.id === "ember")!, { damageGrowthBp: 22000, levels: 6 });
for (const tower of source.towers) if (tower.coating) tower.preferFreshCoating = true;
const driverHash = fnv1a(["engineer", "raider", "greedy", "path-guard"].map(name =>
  readFileSync(new URL(`../../tools/balance/src/policies/${name}.ts`, import.meta.url), "utf8")).join("\n"));
const policies = ["engineer", "force-arc", "force-ember", "engineer-prepared"];
const growths = [10400, 10500, 10600, 10700];
const freezeWaves = [4, 8, 12];
function freeze(path: string, value: unknown): void {
  if (existsSync(path) && JSON.stringify(JSON.parse(readFileSync(path, "utf8"))) !== JSON.stringify(value))
    throw new Error(`Frozen output differs: ${path}; use a new label`);
  writeFileSync(path, JSON.stringify(value, null, 2));
}
mkdirSync(root, { recursive: true });
freeze(`${root}/manifest.json`, { count, start, driverHash, source, policies, growths, freezeWaves });
const reports = [];
for (const growth of growths) {
  const raw: RawGameData = structuredClone(source);
  raw.version += `/pressure-${growth}`;
  raw.composer.hpGrowthBp = growth;
  const directory = `${root}/hp-${growth}`;
  mkdirSync(directory, { recursive: true });
  freeze(`${directory}/data.json`, raw);
  const data = deriveData(withDifficulty(raw, "medium"));
  for (const name of policies) {
    const runs: RunSummary[] = [];
    const rows = [];
    for (let seed = start; seed < start + count; seed++) {
      const driver = name === "engineer-prepared" ? engineerPolicy(name) : makePolicy(name);
      const run = runPolicy(data, driver, seed);
      const analysis = analyzeExploration(data, run.replay, { maxTicks: 400000, choiceLimit: 0, freezeWaves });
      if (!analysis.verification.matchesExpectedHash || !analysis.verification.matchesIndependentReplay) throw new Error(`Replay mismatch ${growth}/${name}/${seed}`);
      const saveWitness = (witness: ExplorationWitness, suffix: string) => {
        const replayFile = `hp-${growth}/${name}-${seed}${suffix}.replay.json`;
        writeFileSync(`${root}/${replayFile}`, JSON.stringify(witness.replay));
        const { replay: _replay, ...summary } = witness;
        return { ...summary, replayFile };
      };
      const original = saveWitness(analysis.original, "");
      const frozenDefense = analysis.frozenDefense.map(f => ({ afterWave: f.afterWave, checkpointTick: f.checkpointTick,
        result: f.result ? saveWitness(f.result, `-freeze${f.afterWave}`) : null }));
      const noPatches = saveWitness(analysis.noPatches, "-no-patches");
      const waves = analysis.waves.map(w => ({ wave: w.wave, tick: w.tick, completed: w.completed, lives: w.lives, gold: w.bank,
        goldAtStart: w.goldAtStart, livesAtStart: w.livesAtStart, goldSpent: w.goldSpent, leaks: w.leaks,
        nearestSurvivorCells: w.nearestSurvivorCells, spendByType: w.spendByType,
        chosenStacks: w.relics.reduce((counts, id) => ({ ...counts, [id]: (counts[id] ?? 0) + 1 }), {} as Record<string, number>),
        patchOffers: w.patchOffers, patchChoices: w.patchChoices, finalHash: w.finalHash }));
      const { replay: _replay, ...summary } = run;
      rows.push({ ...summary, original, waves, patchDecisions: analysis.patchDecisions, frozenDefense, noPatches });
      runs.push(run);
    }
    const failures = rows.filter(r => r.outcome === "lost").map(r => r.wavesCleared).sort((a, b) => a - b);
    const report = { hpGrowthBp: growth, difficulty: "medium", driverHash, ...summarize(runs),
      failedWavesP5: failures.length ? percentile(failures, 5) : null,
      failedWavesP50: failures.length ? percentile(failures, 50) : null,
      failedWavesP95: failures.length ? percentile(failures, 95) : null,
      earlyWaves: [1,2,3].map(wave => {
        const observations = rows.flatMap(r => r.waves.filter(w => w.wave === wave));
        const nearest = observations.flatMap(w => w.nearestSurvivorCells === null ? [] : [w.nearestSurvivorCells]).sort((a,b) => a-b);
        return { wave, reached: observations.length, completed: observations.filter(w => w.completed).length,
          leakRuns: observations.filter(w => w.leaks > 0).length, leaks: observations.reduce((sum,w) => sum+w.leaks,0),
          nearestP50: nearest.length ? percentile(nearest,50) : null };
      }),
      frozen: freezeWaves.map(afterWave => {
        const observations = rows.flatMap(r => r.frozenDefense.filter(f => f.afterWave === afterWave && f.result).map(f => f.result!));
        const survived = observations.map(f => f.wavesCleared).sort((a,b) => a-b);
        return { afterWave, reached: observations.length, wins: observations.filter(f => f.outcome === "won").length,
          perfectWins: observations.filter(f => f.outcome === "won" && f.lives === data.economy.lives).length,
          wavesP50: survived.length ? percentile(survived,50) : null };
      }),
      fixedNoPatchWins: rows.filter(r => r.noPatches.outcome === "won").length,
      fixedNoPatchWinsZeroRejections: rows.filter(r => r.noPatches.outcome === "won" && r.noPatches.rejections.length === 0).length,
      rejectedCommands: rows.reduce((sum,r) => sum+r.original.rejections.length,0),
      wins: rows.filter(r => r.outcome === "won").map(r => ({ seed: r.seed, lives: r.lives, stacks12: r.waves.find(w => w.wave === 12)?.chosenStacks ?? null })),
      allReplaysVerified: rows.every(r => r.original.replayVerified && r.noPatches.replayVerified && r.frozenDefense.every(f => !f.result || f.result.replayVerified)), rows };
    writeFileSync(`${directory}/${name}.report.json`, JSON.stringify(report, null, 2));
    const { rows: _rows, ...compact } = report;
    reports.push(compact);
    console.log(JSON.stringify(compact));
  }
}
writeFileSync(`${root}/summary.json`, JSON.stringify({ reports, runs: reports.reduce((n,r) => n+r.runs,0),
  method: "One frozen combined candidate, varying only geometric HP growth; paired tuning seeds. Original and every fixed-command counterfactual replay verified.",
  caveats: ["Policy skill labels are not human calibration; tighter survival alone is not fun.", "Frozen defense removes all later commands including calls and drops, allowing automatic waves.",
    "No-patch probes retain later fixed inputs; rejected commands and changed timing qualify causal interpretation.", "Nearest-survivor distance is sampled, not an exact solvability margin.",
    "Engineer-prepared uses a bounded perfect-model next-wave safety forecast and never unseen offer information."] }, null, 2));
console.log(JSON.stringify({ done: `${root}/summary.json` }));
