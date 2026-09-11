/** pnpm exec tsx experiments/0004-raid-heat/learning-calibration.ts [count=16] [start=1] [label=learning-calibration] */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deriveData, fnv1a, runReplay, withDifficulty, type Difficulty } from "../../packages/sim/src/index.ts";
import { makePolicy } from "../../tools/balance/src/policies/index.ts";
import { apprenticePolicy } from "../../tools/balance/src/policies/learning.ts";
import { percentile, runPolicy, summarize, type RunSummary } from "../../tools/balance/src/runner.ts";
import { engines } from "./engines.ts";

const count=Number(process.argv[2]??16), start=Number(process.argv[3]??1), label=process.argv[4]??"learning-calibration";
if(!Number.isInteger(count)||count<1||count>100||!Number.isInteger(start)||start<0||!/^[a-z0-9-]+$/.test(label))throw new Error("Invalid count/start/label");
const root=fileURLToPath(new URL(`./out/${label}-${start}-${count}/`,import.meta.url));
const source=engines("raid");
source.composer.hpGrowthBp=10700;source.relicRules.offerCount=2;
Object.assign(source.towers.find(t=>t.id==="ember")!,{damageGrowthBp:22000,levels:6});
for(const t of source.towers)if(t.coating)t.preferFreshCoating=true;
const driverHash=fnv1a(["engineer","raider","greedy","path-guard","learning"].map(name=>readFileSync(new URL(`../../tools/balance/src/policies/${name}.ts`,import.meta.url),"utf8")).join("\n"));
function freeze(path:string,value:unknown) {
  if(existsSync(path)&&JSON.stringify(JSON.parse(readFileSync(path,"utf8")))!==JSON.stringify(value))throw new Error(`Frozen output differs: ${path}`);
  writeFileSync(path,JSON.stringify(value,null,2));
}
mkdirSync(root,{recursive:true});freeze(`${root}/manifest.json`,{count,start,source,driverHash});
const reports=[];
for(const [difficulty,price] of [["easy",8000],["easy",7000],["medium",10000]] as [Difficulty,number][]) {
  const raw=structuredClone(source);raw.version+=`/learning-${difficulty}-${price}`;
  raw.difficulties[difficulty].defenseCostBp=price;
  const actual=withDifficulty(raw,difficulty),data=deriveData(actual),directory=`${root}/${difficulty}-${price}`;
  mkdirSync(directory,{recursive:true});freeze(`${directory}/data.json`,actual);
  for(const policy of ["engineer-rookie","engineer-apprentice"]) {
    const runs:RunSummary[]=[],rows=[];
    for(let seed=start;seed<start+count;seed++) {
      const run=runPolicy(data,policy==="engineer-apprentice"?apprenticePolicy():makePolicy(policy),seed);
      let rejected=0,upgrades=0;
      const replayed=runReplay(data,run.replay,400000,(_tick,events)=>{rejected+=events.filter(e=>e.kind==="rejected").length;upgrades+=events.filter(e=>e.kind==="upgrade").length;});
      if(replayed.finalHash!==run.finalHash)throw new Error("Replay mismatch");
      const replayFile=`${difficulty}-${price}/${policy}-${seed}.replay.json`;
      writeFileSync(`${root}/${replayFile}`,JSON.stringify(run.replay));
      const {replay:_replay,...summary}=run;
      rows.push({...summary,rejected,upgrades,chosenDrops:replayed.state.relics,replayFile,replayVerified:true});runs.push(run);
    }
    const failures=rows.filter(r=>r.outcome==="lost").map(r=>r.wavesCleared).sort((a,b)=>a-b);
    const report={difficulty,price,driverHash,...summarize(runs),failedP50:failures.length?percentile(failures,50):null,
      upgrades:rows.reduce((n,r)=>n+r.upgrades,0),rejections:rows.reduce((n,r)=>n+r.rejected,0),
      winners:rows.filter(r=>r.outcome==="won").map(r=>({seed:r.seed,lives:r.lives,chosenDrops:r.chosenDrops})),rows,allReplaysVerified:true};
    writeFileSync(`${directory}/${policy}.report.json`,JSON.stringify(report,null,2));
    const {rows:_rows,...compact}=report;reports.push(compact);console.log(JSON.stringify(compact));
  }
}
writeFileSync(`${root}/summary.json`,JSON.stringify({reports,runs:reports.reduce((n,r)=>n+r.runs,0),
  caveats:["Old rookie is intentionally unchanged; apprentice adds spatial route protection, not more drop knowledge or extra gold.","Driver names are not calibrated human intelligence levels.","Deliberate execution profile is tested separately after candidate freeze; it is not included here."]},null,2));
console.log(JSON.stringify({done:`${root}/summary.json`}));
