/** pnpm exec tsx experiments/0004-raid-heat/branch-calibration.ts [count=16] [start=1] [label=branch-calibration] */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deriveData, fnv1a, hashState, makeReplay, replayState, runReplay, step, withDifficulty,
  type Difficulty, type GameData, type RawGameData, type Replay } from "../../packages/sim/src/index.ts";
import { makePolicy } from "../../tools/balance/src/policies/index.ts";
import { raiderPolicy } from "../../tools/balance/src/policies/raider.ts";
import { preserveKillZone } from "../../tools/balance/src/policies/path-guard.ts";
import type { Policy } from "../../tools/balance/src/policy.ts";
import { percentile, runPolicy, summarize, type RunSummary } from "../../tools/balance/src/runner.ts";
import { engines } from "./engines.ts";
import type { Variant } from "./variants.ts";

const count = Number(process.argv[2] ?? 16), start = Number(process.argv[3] ?? 1), label = process.argv[4] ?? "branch-calibration";
if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isInteger(start) || start < 0 || !/^[a-z0-9-]+$/.test(label)) throw new Error("Invalid count/start/label");
const root = fileURLToPath(new URL(`./out/${label}-${start}-${count}/`, import.meta.url));
const driverHash = fnv1a(["engineer", "raider", "greedy", "path-guard"].map(name =>
  readFileSync(new URL(`../../tools/balance/src/policies/${name}.ts`, import.meta.url), "utf8")).join("\n"));
const sources = Object.fromEntries((["raid", "compound", "pact"] as Variant[]).map(v => {
  const raw = engines(v);
  raw.relicRules.offerCount = 2;
  Object.assign(raw.towers.find(t => t.id === "ember")!, { damageGrowthBp: 22000, levels: 6 });
  for (const t of raw.towers) if (t.coating) t.preferFreshCoating = true;
  return [v, raw];
})) as Record<Variant, RawGameData>;
const arms: { id: string; variant: Variant; hp: number; difficulty: Difficulty; price?: number; policies: string[] }[] = [
  ...[10500,10600,10700].map(hp => ({ id: `compound-${hp}`, variant: "compound" as const, hp, difficulty: "medium" as const, policies: ["engineer", "guarded-banker"] })),
  ...[10600,10700].map(hp => ({ id: `pact-${hp}`, variant: "pact" as const, hp, difficulty: "medium" as const, policies: ["engineer", "guarded-pact"] })),
  ...[8000,7000].map(price => ({ id: `raid-easy-${price}`, variant: "raid" as const, hp: 10700, difficulty: "easy" as const, price, policies: ["engineer-rookie"] })),
  { id: "raid-hard", variant: "raid", hp: 10700, difficulty: "hard", price: 12500, policies: ["engineer"] },
];
function freeze(path: string, value: unknown): void {
  if (existsSync(path) && JSON.stringify(JSON.parse(readFileSync(path, "utf8"))) !== JSON.stringify(value)) throw new Error(`Frozen output differs: ${path}; use a new label`);
  writeFileSync(path, JSON.stringify(value, null, 2));
}
mkdirSync(root, { recursive: true });
freeze(`${root}/manifest.json`, { count, start, driverHash, sources, arms });

function guarded(name: string): Policy {
  const base = raiderPolicy(name.slice("guarded-".length));
  return { name, decide(data,s,rng) { return preserveKillZone(data,s,base.decide(data,s,rng)); } };
}
function trace(data: GameData, replay: Replay, extend = false) {
  const s = replayState(data,replay);
  const waves = [];
  const rejected: { tick: number; kind: string; reason: string }[] = [];
  let ci=0, goldAtStart=s.gold, livesAtStart=s.lives, leaksAtStart=0, lastRecorded=0;
  const record = () => {
    if (!s.wave || lastRecorded === s.wave) return;
    const spending: Record<string,number> = {};
    for (const tower of s.towers) spending[tower.type] = (spending[tower.type] ?? 0)+tower.spent;
    waves.push({ wave:s.wave, completed:s.stats.wavesCleared >= s.wave, tick:s.tick, lives:s.lives, gold:s.gold, goldAtStart,livesAtStart,
      leaks:s.stats.leaks-leaksAtStart, goldSpent:s.stats.goldSpent, interestEarned:s.stats.interestEarned, spending,
      stacks:s.relics.reduce((a,id)=>({...a,[id]:(a[id]??0)+1}),{} as Record<string,number>) });
    lastRecorded=s.wave;
  };
  while(s.outcome === "playing" && s.tick < (extend ? 400000 : replay.endTick ?? 400000)) {
    const commands=[];
    while(ci<replay.commands.length && replay.commands[ci]!.tick===s.tick) commands.push(replay.commands[ci++]!.cmd);
    const tick=s.tick, preLeaks=s.stats.leaks;
    const events=step(data,s,commands);
    for(const e of events) {
      if(e.kind==="waveStart") { goldAtStart=s.gold; livesAtStart=s.lives; leaksAtStart=preLeaks; }
      if(e.kind==="rejected") rejected.push({tick,kind:e.cmd.kind,reason:e.reason});
    }
    if(events.some(e=>e.kind==="waveEnd"))record();
  }
  record();
  const output=makeReplay(data,s,replay.commands.slice(0,ci));
  const verified=runReplay(data,output,400000);
  if(verified.finalHash!==hashState(s))throw new Error("Trace replay mismatch");
  return { outcome:s.outcome, wavesCleared:s.stats.wavesCleared,lives:s.lives,gold:s.gold,interest:s.stats.interestEarned,
    ticks:s.tick,finalHash:hashState(s),replay:output,replayVerified:true,rejected,waves };
}

const reports=[];
for(const arm of arms) {
  const raw=structuredClone(sources[arm.variant]);
  raw.version+=`/branch-calibration-${arm.id}`;
  raw.composer.hpGrowthBp=arm.hp;
  if(arm.price) raw.difficulties[arm.difficulty].defenseCostBp=arm.price;
  const actual=withDifficulty(raw,arm.difficulty),data=deriveData(actual);
  const directory=`${root}/${arm.id}`;
  mkdirSync(directory,{recursive:true});
  freeze(`${directory}/data.json`,actual);
  for(const name of arm.policies) {
    const runs:RunSummary[]=[],rows=[];
    for(let seed=start;seed<start+count;seed++) {
      const run=runPolicy(data,name.startsWith("guarded-")?guarded(name):makePolicy(name),seed);
      const original=trace(data,run.replay);
      if(original.finalHash!==run.finalHash)throw new Error("Original mismatch");
      const replayFile=`${arm.id}/${name}-${seed}.replay.json`;
      writeFileSync(`${root}/${replayFile}`,JSON.stringify(original.replay));
      let ablation=null;
      if(arm.variant!=="raid") {
        const modified=structuredClone(actual), kind=arm.variant==="compound"?"no-patch-interest":"no-low-life";
        modified.version+=`/${kind}`;
        for(const r of modified.relics) {
          if(arm.variant==="compound") { r.interestBp=0;r.interestCapBonusGold=0;r.interestRateMultiplierBp=10000; }
          else r.lowLifeDamageBp=10000;
        }
        const counter=trace(deriveData(modified),{...run.replay,data:modified,dataVersion:modified.version},true);
        const file=`${arm.id}/${name}-${seed}-${kind}.replay.json`;
        writeFileSync(`${root}/${file}`,JSON.stringify(counter.replay));
        const {replay:_counterReplay,...counterSummary}=counter;
        ablation={kind,...counterSummary,replayFile:file};
      }
      const {replay:_originalReplay,...originalSummary}=original;
      const {replay:_runReplay,...summary}=run;
      rows.push({...summary,original:originalSummary,replayFile,ablation});
      runs.push(run);
    }
    const failed=rows.filter(r=>r.outcome==="lost").map(r=>r.wavesCleared).sort((a,b)=>a-b);
    const interest=rows.map(r=>r.interestEarned).sort((a,b)=>a-b);
    const report={arm:arm.id,variant:arm.variant,difficulty:arm.difficulty,hpGrowthBp:arm.hp,driverHash,...summarize(runs),
      failedP50:failed.length?percentile(failed,50):null,interestP5:percentile(interest,5),interestP50:percentile(interest,50),interestP95:percentile(interest,95),
      earlyWaves:[1,2,3].map(w=>({wave:w,leakRuns:rows.filter(r=>r.original.waves.some(x=>x.wave===w&&x.leaks>0)).length})),
      noEngineWins:arm.variant==="raid"?null:rows.filter(r=>r.ablation?.outcome==="won").length,
      noEngineWinsZeroRejections:arm.variant==="raid"?null:rows.filter(r=>r.ablation?.outcome==="won"&&r.ablation.rejected.length===0).length,
      winsDependingOnEngineZeroRejections:arm.variant==="raid"?null:rows.filter(r=>r.outcome==="won"&&r.ablation?.outcome==="lost"&&r.ablation.rejected.length===0).map(r=>r.seed),
      ordinaryWinsWithoutNamedDrop:arm.variant==="raid"?null:rows.filter(r=>r.outcome==="won"&&!(r.original.waves.at(-1)?.stacks[arm.variant==="compound"?"compound":"last-stand"])).map(r=>r.seed),
      rejections:rows.reduce((n,r)=>n+r.original.rejected.length,0),allReplaysVerified:true,
      winners:rows.filter(r=>r.outcome==="won").map(r=>({seed:r.seed,lives:r.lives,interest:r.interestEarned,stacks:r.original.waves.at(-1)?.stacks})),rows};
    writeFileSync(`${directory}/${name}.report.json`,JSON.stringify(report,null,2));
    const {rows:_rows,...compact}=report;
    reports.push(compact);console.log(JSON.stringify(compact));
  }
}
writeFileSync(`${root}/summary.json`,JSON.stringify({reports,runs:reports.reduce((n,r)=>n+r.runs,0),
  caveats:["Paired tuning seeds, not reserved validation or human skill calibration.","Guarded specialists retain banking/pact logic and gain route protection, not Engineer coating awareness.",
    "Engine-removal probes keep commands fixed; changed timing and rejected actions qualify causal interpretation.","Base economy interest remains in no-patch-interest probes.","Raid Easy uses actual rookie policy; Hard uses path-aware Engineer."]},null,2));
console.log(JSON.stringify({done:`${root}/summary.json`}));
