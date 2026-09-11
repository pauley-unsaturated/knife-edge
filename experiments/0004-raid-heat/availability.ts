/** pnpm exec tsx experiments/0004-raid-heat/availability.ts [count=16] [start=1] [label=availability] */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deriveData, fnv1a, runReplay, withDifficulty, type RawGameData } from "../../packages/sim/src/index.ts";
import { makePolicy } from "../../tools/balance/src/policies/index.ts";
import type { Policy } from "../../tools/balance/src/policy.ts";
import { runPolicy, summarize, type RunSummary } from "../../tools/balance/src/runner.ts";
import { engines } from "./engines.ts";

const count = Number(process.argv[2] ?? 16), start = Number(process.argv[3] ?? 1), label = process.argv[4] ?? "availability";
if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isInteger(start) || start < 0 || !/^[a-z0-9-]+$/.test(label)) throw new Error("Invalid count/start/label");
const root = fileURLToPath(new URL(`./out/${label}-${start}-${count}/`, import.meta.url));
const source = engines("raid");
const driverHash = fnv1a(["engineer", "raider", "greedy", "path-guard"].map(name =>
  readFileSync(new URL(`../../tools/balance/src/policies/${name}.ts`, import.meta.url), "utf8")).join("\n"));
const arms = [
  { name: "offers3", count: 3, fresh: false, policies: ["force-arc", "force-ember", "engineer"] },
  { name: "offers2", count: 2, fresh: false, policies: ["force-arc", "force-ember", "engineer"] },
  { name: "offers2-fresh", count: 2, fresh: true, policies: ["engineer"] },
];
function freeze(path: string, value: unknown): void {
  if (existsSync(path) && JSON.stringify(JSON.parse(readFileSync(path, "utf8"))) !== JSON.stringify(value))
    throw new Error(`Frozen output differs: ${path}; use a new label`);
  writeFileSync(path, JSON.stringify(value, null, 2));
}
mkdirSync(root, { recursive: true });
freeze(`${root}/manifest.json`, { count, start, driverHash, source, arms });
const reports = [];
for (const arm of arms) {
  const raw: RawGameData = structuredClone(source);
  raw.version += `/availability-${arm.name}`;
  raw.relicRules.offerCount = arm.count;
  for (const tower of raw.towers) if (tower.coating) {
    if (arm.fresh) tower.preferFreshCoating = true;
    else delete tower.preferFreshCoating;
  }
  const directory = `${root}/${arm.name}`;
  mkdirSync(directory, { recursive: true });
  freeze(`${directory}/data.json`, raw);
  const data = deriveData(withDifficulty(raw, "medium"));
  for (const name of arm.policies) {
    const runs: RunSummary[] = [];
    const rows = [];
    for (let seed = start; seed < start + count; seed++) {
      const base = makePolicy(name);
      const offers: { wave: number; tick: number; rerolls: number; ids: string[]; picked?: string }[] = [];
      const picks: { wave: number; id: string }[] = [];
      let offerKey = "";
      const driver: Policy = { name: base.name, decide(d, s, rng) {
        if (s.relicOffers.length) {
          const key = `${s.wave}/${s.offerRerolls ?? 0}`;
          if (key !== offerKey) {
            offers.push({ wave: s.wave, tick: s.tick, rerolls: s.offerRerolls ?? 0, ids: [...s.relicOffers] });
            offerKey = key;
          }
        }
        const commands = base.decide(d, s, rng);
        for (const command of commands) if (command.kind === "pickRelic") {
          picks.push({ wave: s.wave, id: command.id });
          if (offers.length) offers[offers.length - 1]!.picked = command.id;
        }
        return commands;
      } };
      const run = runPolicy(data, driver, seed);
      let rejected = 0, rerolls = 0, rerollFees = 0;
      const checked = runReplay(data, run.replay, 400000, (_tick, events) => {
        rejected += events.filter(e => e.kind === "rejected").length;
        for (const event of events) if (event.kind === "reroll") { rerolls++; rerollFees += event.gold; }
      });
      if (checked.finalHash !== run.finalHash || checked.ticks !== run.ticks) throw new Error(`Replay mismatch ${arm.name}/${name}/${seed}`);
      const firstThreeOffers = offers.filter(o => o.rerolls === 0).slice(0, 3);
      const stacksThroughWave12: Record<string, number> = {};
      for (const pick of picks.filter(p => p.wave <= 12)) stacksThroughWave12[pick.id] = (stacksThroughWave12[pick.id] ?? 0) + 1;
      const lane = name === "force-arc" ? "conductive" : name === "force-ember" ? "hot-wire" : undefined;
      const typeInvestment: Record<string, number> = {};
      for (const tower of checked.state.towers) typeInvestment[tower.type] = (typeInvestment[tower.type] ?? 0) + tower.spent;
      const replayFile = `${arm.name}/${name}-${seed}.replay.json`;
      writeFileSync(`${root}/${replayFile}`, JSON.stringify(run.replay));
      const { replay: _replay, ...summary } = run;
      rows.push({ ...summary, firstThreeOffers, offers, stacksThroughWave12,
        matchingOffersFirstThree: lane ? firstThreeOffers.filter(o => o.ids.includes(lane)).length : null,
        matchingStacksThroughWave12: lane ? stacksThroughWave12[lane] ?? 0 : null,
        typeInvestment, rerolls, rerollFees, rejected, replayFile, replayVerified: true });
      runs.push(run);
    }
    const report = { arm: arm.name, difficulty: "medium", driverHash, ...summarize(runs),
      completedFirstThreeOfferSets: rows.filter(r => r.firstThreeOffers.length === 3).length,
      matchingOfferCounts: [0,1,2,3].map(n => rows.filter(r => r.matchingOffersFirstThree === n).length),
      matchingStackCountsThroughWave12: [0,1,2,3,4].map(n => rows.filter(r => r.matchingStacksThroughWave12 === n).length),
      wins: rows.filter(r => r.outcome === "won").map(r => r.seed),
      rerolls: rows.reduce((sum, r) => sum + r.rerolls, 0),
      rejections: rows.reduce((sum, r) => sum + r.rejected, 0), allReplaysVerified: true, rows };
    writeFileSync(`${directory}/${name}.report.json`, JSON.stringify(report, null, 2));
    const { rows: _rows, ...compact } = report;
    reports.push(compact);
    console.log(JSON.stringify(compact));
  }
}
writeFileSync(`${root}/summary.json`, JSON.stringify({ reports, runs: reports.reduce((n, r) => n + r.runs, 0),
  caveats: ["Paired tuning seeds, not held-out human fun validation.", "First three offers mean initial offers at three distinct drop waves; rerolls are recorded separately.",
    "Stacks through wave12 count selected cards, not inferred combat contributions.", "Corrected path-aware driver must not be pooled with the earlier unguarded Engineer.",
    "Fresh-coating arm changes target delivery only; no drop pool, tower price, or multiplier changes."] }, null, 2));
console.log(JSON.stringify({ done: `${root}/summary.json` }));
