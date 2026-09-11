import { mkdirSync,readFileSync,writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createState,deriveData,fnv1a,hashState,step,withDifficulty } from "../../packages/sim/src/index.ts";
import { runPolicy } from "../../tools/balance/src/runner.ts";
import { learnerOffers,learnerPolicy,learnerTarget } from "./learner-controller.ts";

const root=fileURLToPath(new URL("./out/learner-v1-smoke/",import.meta.url));mkdirSync(root,{recursive:true});
const source=JSON.parse(readFileSync(new URL("./candidate-v4/raid.json",import.meta.url),"utf8"));
const data=deriveData(withDifficulty(source,"easy"));
writeFileSync(`${root}/manifest.json`,JSON.stringify({source,controllerHash:fnv1a(readFileSync(new URL("./learner-controller.ts",import.meta.url),"utf8")),seeds:[1,4,5]},null,2));
const summaries=[];
for(const seed of [1,4,5]) {
  const run=runPolicy(data,learnerPolicy(),seed),s=createState(data,seed);let i=0,rejected=0;const trace=[];
  while(s.tick<run.replay.endTick) {
    const cmds=[];while(run.replay.commands[i]?.tick===s.tick)cmds.push(run.replay.commands[i++]!.cmd);
    if(cmds.length)trace.push({tick:s.tick,wave:s.wave,lives:s.lives,gold:s.gold,commands:cmds,offers:s.relicOffers.length?learnerOffers(data,s):[],savingTarget:learnerTarget(data,s),relics:[...s.relics],
      investments:Object.fromEntries(data.towers.map(t=>[t.id,s.towers.filter(x=>x.type===t.id).reduce((n,x)=>n+x.spent,0)]))});
    rejected+=step(data,s,cmds).filter(e=>e.kind==="rejected").length;
  }
  if(hashState(s)!==run.finalHash)throw new Error("Replay mismatch");
  writeFileSync(`${root}/learner-${seed}.replay.json`,JSON.stringify(run.replay));
  writeFileSync(`${root}/learner-${seed}.trace.json`,JSON.stringify(trace,null,2));
  const links=trace.filter(t=>t.commands.some(c=>c.kind==="pickRelic")).map(t=>{
    const pick=t.commands.find(c=>c.kind==="pickRelic")!;const relic=data.relics.find(r=>r.id===pick.id)!;
    const types=relic.slowDamageBp>10000?["frost"]:data.towers.filter(x=>x.damageType===relic.damageType&&relic.damageType!=="all").map(x=>x.id);
    const first=trace.find(x=>x.tick>t.tick&&x.commands.some(c=>c.kind==="build"&&types.includes(c.type)));
    return {pick:pick.id,wave:t.wave,tick:t.tick,gold:t.gold,matchingPurchase:first?{tick:first.tick,wave:first.wave,gold:first.gold,commands:first.commands}:null};
  });
  const summary={seed,outcome:run.outcome,wavesCleared:run.wavesCleared,lives:run.lives,rejected,replayVerified:true,links};summaries.push(summary);console.log(JSON.stringify(summary));
}
writeFileSync(`${root}/summary.json`,JSON.stringify(summaries,null,2));
