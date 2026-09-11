/** Frozen candidate diagnostics, tuning seeds only; no runtime policy edits. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createState, deriveData, fnv1a, hashState, step, withDifficulty, type Difficulty } from "../../packages/sim/src/index.ts";
import { makePolicy } from "../../tools/balance/src/policies/index.ts";
import { evaluateEngineerOffers } from "../../tools/balance/src/policies/engineer.ts";
import { evaluateOffers } from "../../tools/balance/src/policies/raider.ts";
import { runPolicy } from "../../tools/balance/src/runner.ts";

const root=fileURLToPath(new URL("./out/driver-review-v4/",import.meta.url));
mkdirSync(root,{recursive:true});
const source=JSON.parse(readFileSync(new URL("./candidate-v4/raid.json",import.meta.url),"utf8"));
const driverHash=fnv1a(["engineer","raider","greedy","path-guard","learning"].map(name=>readFileSync(new URL(`../../tools/balance/src/policies/${name}.ts`,import.meta.url),"utf8")).join("\n"));
writeFileSync(`${root}/manifest.json`,JSON.stringify({source,driverHash,seeds:[1,16],purpose:"Tuning-only contextual decision review; not held-out validation"},null,2));
const rows=[];
for(const [difficulty,profile] of [["easy","engineer-apprentice"],["medium","engineer-deliberate"],["hard","engineer"],["medium","engineer-prepared"]] as [Difficulty,string][]) {
  const data=deriveData(withDifficulty(source,difficulty)),directory=`${root}/${difficulty}`;
  mkdirSync(directory,{recursive:true});
  for(let seed=1;seed<=16;seed++) {
    const run=runPolicy(data,makePolicy(profile),seed),s=createState(data,seed);
    const decisions:unknown[]=[],waves:unknown[]=[];let index=0,rejected=0;
    while(s.tick<run.replay.endTick) {
      const commands=[];
      while(run.replay.commands[index]?.tick===s.tick)commands.push(run.replay.commands[index++]!.cmd);
      if(commands.some(c=>["build","upgrade","pickRelic","reroll"].includes(c.kind))) {
        const investments=Object.fromEntries(data.towers.map(t=>[t.id,s.towers.filter(x=>x.type===t.id).reduce((n,x)=>n+x.spent,0)]));
        const costs=commands.map(c=>c.kind==="build"?data.towerById.get(c.type)!.ladder[0]!.cost:c.kind==="upgrade"?data.towerById.get(s.towers.find(t=>t.cell===c.cell)!.type)!.ladder[s.towers.find(t=>t.cell===c.cell)!.level]!.cost:null);
        decisions.push({tick:s.tick,wave:s.wave,inWave:s.inWave,lives:s.lives,gold:s.gold,commands,costs,relics:[...s.relics],
          offers:s.relicOffers.length?(profile==="engineer-apprentice"?evaluateOffers(data,s,"synergy-rookie"):evaluateEngineerOffers(data,s)):[],investments,
          towers:s.towers.map(t=>({cell:t.cell,type:t.type,level:t.level,spent:t.spent})),enemies:s.enemies.length});
      }
      const events=step(data,s,commands);rejected+=events.filter(e=>e.kind==="rejected").length;
      for(const e of events)if(e.kind==="waveStart"||e.kind==="waveEnd")waves.push({tick:s.tick,wave:s.wave,event:e,lives:s.lives,gold:s.gold,spent:s.stats.goldSpent,relics:[...s.relics]});
    }
    if(hashState(s)!==run.finalHash)throw new Error("Replay mismatch");
    const stem=`${difficulty}/${profile}-${seed}`;
    writeFileSync(`${root}/${stem}.replay.json`,JSON.stringify(run.replay));
    writeFileSync(`${root}/${stem}.trace.json`,JSON.stringify({difficulty,profile,seed,outcome:run.outcome,wavesCleared:run.wavesCleared,rejected,decisions,waves},null,2));
    const row={difficulty,profile,seed,outcome:run.outcome,wavesCleared:run.wavesCleared,lives:run.lives,gold:run.gold,spent:run.goldSpent,relics:s.relics,rerolls:run.replay.commands.filter(c=>c.cmd.kind==="reroll").map(c=>c.tick),rejected,stem};
    rows.push(row);console.log(JSON.stringify(row));
    writeFileSync(`${root}/summary.json`,JSON.stringify({driverHash,rows},null,2));
  }
}
