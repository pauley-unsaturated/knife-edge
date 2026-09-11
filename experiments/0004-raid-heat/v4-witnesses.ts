/** Bounded tuning-only judge pass. Frozen v4 rules; adaptive, cost-preserving
 * ablations and identical-prefix offered alternatives. Not held-out win rates. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { deriveData, fnv1a, hashState, makeReplay, replayState, runReplay, seedRng, step, withDifficulty,
  type Command, type GameData, type RawGameData, type Replay, type State, type TimedCommand } from "../../packages/sim/src/index.ts";
import { makePolicy } from "../../tools/balance/src/policies/index.ts";
import { raiderPolicy } from "../../tools/balance/src/policies/raider.ts";
import { preserveKillZone } from "../../tools/balance/src/policies/path-guard.ts";
import { runPolicy } from "../../tools/balance/src/runner.ts";
import type { Policy } from "../../tools/balance/src/policy.ts";

const root = new URL("./out/v4-witnesses-1-16/", import.meta.url);
mkdirSync(root, { recursive: true });
const branches = ["raid", "compound", "pact"] as const;
const sources = Object.fromEntries(branches.map(branch => [branch, JSON.parse(readFileSync(new URL(`./candidate-v4/${branch}.json`, import.meta.url), "utf8"))])) as Record<typeof branches[number], RawGameData>;
const manifest = { sources, seeds: [1,16], driverHash: fnv1a(["engineer", "raider", "greedy", "path-guard"].map(n => readFileSync(new URL(`../../tools/balance/src/policies/${n}.ts`, import.meta.url), "utf8")).join("\n")), caveat: "Tuning-only selected witnesses. Adaptive driver is not an optimal or calibrated human player. Ablations retain sacrifice costs and drop identities." };
const manifestPath = new URL("manifest.json",root);
if (existsSync(manifestPath) && JSON.stringify(JSON.parse(readFileSync(manifestPath,"utf8"))) !== JSON.stringify(manifest)) throw new Error("Frozen inputs changed; use a new output directory");
writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
function policy(name:string):Policy {
  if(!name.startsWith("guarded-")) return makePolicy(name);
  const base=raiderPolicy(name.slice(8));
  return {name,decide(data,s,rng) { return preserveKillZone(data,s,base.decide(data,s,rng)); }};
}
function save(data:GameData,replay:Replay,file:string) {
  const rejects:unknown[]=[],waves:unknown[]=[];
  const check=runReplay(data,replay,400000,(tick,events)=>{ for(const e of events) { if(e.kind==="rejected")rejects.push({tick,...e}); if(e.kind==="waveEnd")waves.push({tick,...e}); }});
  if(check.finalHash!==replay.finalHash || check.ticks!==replay.endTick)throw new Error("Replay mismatch");
  if(rejects.length)throw new Error(`Rejected witness: ${file}`);
  writeFileSync(new URL(file,root),JSON.stringify(replay));
  const s=check.state;
  return {file,seed:replay.seed,outcome:s.outcome,wave:s.stats.wavesCleared,core:s.lives,interest:s.stats.interestEarned,spent:s.stats.goldSpent,gold:s.gold,relics:s.relics,
    towers:s.towers.map(t=>({type:t.type,level:t.level,spent:t.spent})),rejects:0,verified:true,finalHash:check.finalHash,waves};
}
function ablation(raw:RawGameData,kind:string) {
  const r=structuredClone(raw);r.version+=`/judge-${kind}`;
  for(const card of r.relics) {
    if(kind==="no-poison") {card.poisonDamageBp=0;card.poisonTicks=0;}
    if(kind==="no-burst")card.deathBurstBp=0;
    if(kind==="no-conductive"&&card.id==="conductive")card.damageBp=10000;
    if(kind==="no-interest") {card.interestBp=0;card.interestCapBonusGold=0;card.interestRateMultiplierBp=10000;}
    if(kind==="no-low-life")card.lowLifeDamageBp=10000;
  }
  return deriveData(r);
}
function fork(data:GameData,replay:Replay,name:string,at:TimedCommand,id:string,file:string) {
  const p=policy(name),s=replayState(data,replay),commands:TimedCommand[]=[],rng=seedRng(replay.seed^0x61537);
  let ci=0;
  // Rebuild policy caches from the same prefix. All arms use the same private
  // continuation RNG seed, and no future world/offer stream is inspected.
  while(s.tick<at.tick) {
    p.decide(data,s,rng);
    const batch:Command[]=[];
    while(ci<replay.commands.length&&replay.commands[ci]!.tick===s.tick)batch.push(replay.commands[ci++]!.cmd);
    commands.push(...batch.map(cmd=>({tick:s.tick,cmd})));step(data,s,batch);
  }
  if(!s.relicOffers.includes(id))throw new Error("Alternative not actually offered");
  const checkpoint={tick:s.tick,wave:s.wave,core:s.lives,gold:s.gold,offers:[...s.relicOffers],relics:[...s.relics],prefixHash:hashState(s)};
  const cmd:Command={kind:"pickRelic",id};commands.push({tick:s.tick,cmd});step(data,s,[cmd]);
  while(s.outcome==="playing"&&s.tick<400000) {const batch=p.decide(data,s,rng);commands.push(...batch.map(cmd=>({tick:s.tick,cmd})));step(data,s,batch);}
  return {checkpoint,pick:id,...save(data,makeReplay(data,s,commands),file)};
}
const reports:any[]=[];
for(const branch of branches) {
  const raw=withDifficulty(sources[branch],"medium"),data=deriveData(raw),name=branch==="raid"?"engineer":`guarded-${branch==="compound"?"banker":"pact"}`;
  const reportPath=new URL(`${branch}.report.json`,root);
  const rows:any[]=existsSync(reportPath)?JSON.parse(readFileSync(reportPath,"utf8")).rows:[];
  for(let seed=1;seed<=16;seed++) {
    if(rows.some(row=>row.seed===seed))continue;
    const replay=runPolicy(data,policy(name),seed).replay;
    const row:any={...save(data,replay,`${branch}-${name}-${seed}.replay.json`),ablations:[],choices:[]};
    if(row.outcome==="won") {
      const kinds=branch==="raid"?["no-poison","no-burst","no-conductive"]:[branch==="compound"?"no-interest":"no-low-life"];
      for(const kind of kinds) {
        const changed=ablation(raw,kind),test=runPolicy(changed,policy(name),seed);
        row.ablations.push({kind,...save(changed,test.replay,`${branch}-${name}-${seed}-${kind}.replay.json`)});
      }
      if(branch!=="raid") {
        const picks=replay.commands.filter(c=>c.cmd.kind==="pickRelic" && (branch==="compound"?c.cmd.id==="compound":["blood-price","last-stand"].includes(c.cmd.id))).slice(0,4);
        for(const at of picks) {
          const checkpoint=runReplay(data,{...replay,commands:replay.commands.filter(c=>c.tick<at.tick),endTick:at.tick},400000).state;
          const arms=checkpoint.relicOffers.filter(id=>(data.relics.find(r=>r.id===id)!.sacrificeLives??0)<checkpoint.lives)
            .map(id=>fork(data,replay,name,at,id,`${branch}-${name}-${seed}-at${at.tick}-${id}.replay.json`));
          if(arms.some(a=>a.checkpoint.prefixHash!==arms[0]!.checkpoint.prefixHash))throw new Error("Nonidentical checkpoint");
          row.choices.push({tick:at.tick,original:at.cmd,arms});
        }
      }
    }
    rows.push(row);
    writeFileSync(new URL(`${branch}.report.json`,root),JSON.stringify({branch,name,rows},null,2));
    console.log(JSON.stringify({branch,seed,outcome:row.outcome,wave:row.wave,core:row.core,ablations:row.ablations.map((r:any)=>[r.kind,r.outcome,r.wave]),choices:row.choices.map((c:any)=>({tick:c.tick,arms:c.arms.map((a:any)=>[a.pick,a.outcome,a.wave,a.core])}))}));
  }
  reports.push({branch,name,rows});
}
writeFileSync(new URL("summary.json",root),JSON.stringify({manifest,reports},null,2));
