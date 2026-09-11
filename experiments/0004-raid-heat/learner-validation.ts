/** Authorized fresh learner validation. Frozen v4 rules; seeds301–340 only. */
import { existsSync,mkdirSync,readFileSync,writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createState,deriveData,fnv1a,hashState,step,withDifficulty,type Difficulty } from "../../packages/sim/src/index.ts";
import { runPolicy,summarize,percentile,type RunSummary } from "../../tools/balance/src/runner.ts";
import { learnerPolicy } from "./learner-controller.ts";

const root=fileURLToPath(new URL("./out/learner-v1-validation-301-340/",import.meta.url));
const controllerHash=fnv1a(readFileSync(new URL("./learner-controller.ts",import.meta.url),"utf8"));
if(controllerHash!==2963884217)throw new Error("Authorized controller fingerprint changed");
const dependencies=["raider","greedy","path-guard"].map(n=>({name:n,hash:fnv1a(readFileSync(new URL(`../../tools/balance/src/policies/${n}.ts`,import.meta.url),"utf8"))}));
const sources=Object.fromEntries(["raid","compound","pact"].map(v=>[v,JSON.parse(readFileSync(new URL(`./candidate-v4/${v}.json`,import.meta.url),"utf8"))]));
const arms=Object.entries(sources).flatMap(([variant,source])=>(["easy","medium","hard"] as Difficulty[]).map(difficulty=>({variant,difficulty,raw:withDifficulty(source,difficulty)})));
function freeze(file:string,value:unknown){if(existsSync(file)&&JSON.stringify(JSON.parse(readFileSync(file,"utf8")))!==JSON.stringify(value))throw new Error(`Frozen file differs: ${file}`);writeFileSync(file,JSON.stringify(value,null,2));}
mkdirSync(root,{recursive:true});
freeze(`${root}/manifest.json`,{controllerHash,dependencies,seeds:{start:301,end:340},purpose:"Fresh authorized held-out learner behavior and difficulty validation; no retuning",sources,configHashes:arms.map(a=>({variant:a.variant,difficulty:a.difficulty,hash:fnv1a(JSON.stringify(a.raw))}))});
for(const arm of arms){mkdirSync(`${root}/${arm.variant}/${arm.difficulty}`,{recursive:true});freeze(`${root}/${arm.variant}/${arm.difficulty}/data.json`,arm.raw);}
const reports=[];
for(const arm of arms){
  const data=deriveData(arm.raw),directory=`${root}/${arm.variant}/${arm.difficulty}`,runs:RunSummary[]=[],rows=[];
  for(let seed=301;seed<=340;seed++){
    const run=runPolicy(data,learnerPolicy(),seed),s=createState(data,seed);let i=0,rejected=0;
    const links:{id:string;tick:number;wave:number;gold:number;types:string[];existingSpend:number;purchaseTick:number|null;purchaseWave:number|null;purchaseKind:string|null}[]=[];
    const perWave=new Map<number,{wave:number;leaks:number;endLives:number;endGold:number;spent:number;cleared:boolean}>();
    while(s.tick<run.replay.endTick){
      const commands=[];while(run.replay.commands[i]?.tick===s.tick)commands.push(run.replay.commands[i++]!.cmd);
      for(const c of commands){
        if(c.kind==="pickRelic"){
          const r=data.relics.find(r=>r.id===c.id)!;
          const types=r.slowDamageBp>10000?data.towers.filter(t=>t.slowTicks>0).map(t=>t.id):r.damageType!=="all"&&r.damageBp>10000?data.towers.filter(t=>t.damageType===r.damageType).map(t=>t.id):[];
          if(types.length)links.push({id:c.id,tick:s.tick,wave:s.wave,gold:s.gold,types,existingSpend:s.towers.filter(t=>types.includes(t.type)).reduce((n,t)=>n+t.spent,0),purchaseTick:null,purchaseWave:null,purchaseKind:null});
        }
        if(c.kind==="build"||c.kind==="upgrade"){
          const type=c.kind==="build"?c.type:s.towers.find(t=>t.cell===c.cell)!.type;
          for(const link of links)if(link.purchaseTick===null&&link.types.includes(type)){link.purchaseTick=s.tick;link.purchaseWave=s.wave;link.purchaseKind=c.kind;}
        }
      }
      const before=s.stats.leaks,events=step(data,s,commands);rejected+=events.filter(e=>e.kind==="rejected").length;
      if(s.wave>0){const row=perWave.get(s.wave)??{wave:s.wave,leaks:0,endLives:s.lives,endGold:s.gold,spent:s.stats.goldSpent,cleared:false};row.leaks+=s.stats.leaks-before;row.endLives=s.lives;row.endGold=s.gold;row.spent=s.stats.goldSpent;row.cleared=s.stats.wavesCleared>=s.wave;perWave.set(s.wave,row);}
    }
    if(hashState(s)!==run.finalHash)throw new Error("Exact replay mismatch");
    const replayFile=`${arm.variant}/${arm.difficulty}/learner-${seed}.replay.json`;writeFileSync(`${root}/${replayFile}`,JSON.stringify(run.replay));
    const row={seed,outcome:run.outcome,wavesCleared:run.wavesCleared,failureWave:run.outcome==="lost"?s.wave:null,lives:run.lives,gold:run.gold,spent:run.goldSpent,rejected,replayVerified:true,replayFile,links:links.map(l=>({...l,delayTicks:l.purchaseTick===null?null:l.purchaseTick-l.tick,delayWaves:l.purchaseWave===null?null:l.purchaseWave-l.wave})),waves:[...perWave.values()]};
    rows.push(row);runs.push(run);
  }
  const allLinks=rows.flatMap(r=>r.links),unactivated=allLinks.filter(l=>l.existingSpend===0),delays=unactivated.filter(l=>l.delayTicks!==null).map(l=>l.delayTicks!).sort((a,b)=>a-b);
  const histogram=Object.fromEntries([...new Set(rows.filter(r=>r.failureWave!==null).map(r=>r.failureWave!))].sort((a,b)=>a-b).map(w=>[w,rows.filter(r=>r.failureWave===w).length]));
  const failures=rows.filter(r=>r.outcome==="lost").map(r=>r.wavesCleared).sort((a,b)=>a-b);
  const report={variant:arm.variant,difficulty:arm.difficulty,controllerHash,...summarize(runs),wins:rows.filter(r=>r.outcome==="won").length,rejected:rows.reduce((n,r)=>n+r.rejected,0),allReplaysVerified:true,failedClearP50:failures.length?percentile(failures,50):null,failureWaveHistogram:histogram,
    early:[1,2,3].map(w=>({wave:w,reached:rows.filter(r=>r.waves.some(x=>x.wave===w)).length,runsLeaking:rows.filter(r=>r.waves.some(x=>x.wave===w&&x.leaks>0)).length,totalLeaks:rows.reduce((n,r)=>n+(r.waves.find(x=>x.wave===w)?.leaks??0),0)})),
    activation:{typedOrColdPicks:allLinks.length,picksWithoutMatchingInvestment:unactivated.length,converted:unactivated.filter(l=>l.purchaseTick!==null).length,notConverted:unactivated.filter(l=>l.purchaseTick===null).length,delayTicksP50:percentile(delays,50),delayTicksP95:percentile(delays,95),withinNextTwoWaves:unactivated.filter(l=>l.delayWaves!==null&&l.delayWaves<=2).length},rows};
  writeFileSync(`${directory}/report.json`,JSON.stringify(report,null,2));const{rows:_rows,...compact}=report;reports.push(compact);console.log(JSON.stringify(compact));
  writeFileSync(`${root}/summary.json`,JSON.stringify({controllerHash,reports,totalRuns:reports.reduce((n,r)=>n+r.runs,0),caveats:["Fresh learner-v1 validation, separate from old apprentice diagnostic.","No game/controller retuning during this batch; profile is not calibrated human skill.","Activation includes upgrades and builds; already-active drops are not counted as missing activation.","No simulated emotions: decision quality requires trace inspection alongside aggregate statistics."]},null,2));
}
