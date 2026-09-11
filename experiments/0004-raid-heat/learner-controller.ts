/** Experiment-local low-knowledge controller. No runtime fingerprint changes,
 * future RNG inspection, combat forecast, virtual cash, raids or rerolls. */
import { SCALE, canBuild, composeWave, damageMultiplier, pathFromEntry, type Command, type GameData, type State } from "../../packages/sim/src/index.ts";
import type { Policy } from "../../tools/balance/src/policy.ts";
import { evaluateOffers, raiderPolicy } from "../../tools/balance/src/policies/raider.ts";
import { assessBuildRoute, preserveKillZone } from "../../tools/balance/src/policies/path-guard.ts";

export function learnerOffers(data:GameData,s:State) {
  return evaluateOffers(data,s,"synergy-rookie").map(offer=>{
    const r=data.relics.find(r=>r.id===offer.id)!;
    // Knows the plainly stated slow→damage connection, but not poison doses,
    // confusion economics, coating combinations or compound forecasts.
    const cold=r.slowDamageBp>10000?Math.log(r.slowDamageBp/10000)*(s.towers.some(t=>t.type==="frost")?0.65:0.3):0;
    return {...offer,score:offer.score+cold,reason:offer.reason+(cold?"; understands basic Frost activation":"")};
  }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}

/** Public current/next-wave composition only; no numeric outcome simulation. */
export function learnerTarget(data:GameData,s:State):string|undefined {
  if(s.towers.length<3)return;
  if(s.relics.some(id=>data.relics.find(r=>r.id===id)!.slowDamageBp>10000)&&!s.towers.some(t=>t.type==="frost"))return "frost";
  const preview=composeWave(data,s.seed,Math.min(data.economy.maxWaves,s.wave+(s.inWave?0:1)),s.raided);
  const choices=data.towers.filter(t=>!t.coating&&t.damageType!=="kinetic").map(t=>{
    const copies=s.relics.filter(id=>{const r=data.relics.find(r=>r.id===id)!;return r.damageType===t.damageType&&r.damageBp>10000;}).length;
    const invested=s.towers.filter(x=>x.type===t.id).reduce((n,x)=>n+x.spent,0);
    const matchup=preview.reduce((n,e)=>n+damageMultiplier(data,t,data.enemyById.get(e.type)!),0)/Math.max(1,preview.length)/10000;
    // One matching purchase promptly, then a bounded share of future spending.
    // Two copies justify a larger commitment, not permanent first-card lock-in.
    const target=Math.max(t.cost,Math.min(0.6,0.25+copies*0.1)*s.stats.goldSpent);
    return {id:t.id,copies,invested,target,score:copies*matchup*(1-invested/Math.max(1,target))};
  }).filter(x=>x.copies>0&&x.invested<x.target).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  return choices[0]?.id;
}

function safeBuild(data:GameData,s:State,id:string):Command|undefined {
  const type=data.towerById.get(id);if(!type||s.gold<type.cost)return;
  const path=pathFromEntry(s.grid,s.dist),r2=(type.ladder[0]!.rangeFp/SCALE)**2;
  const distance=(a:number,b:number)=>(a%s.grid.width-b%s.grid.width)**2+(Math.floor(a/s.grid.width)-Math.floor(b/s.grid.width))**2;
  const ranked=Array.from({length:s.blocked.length},(_,cell)=>({cell,coverage:s.blocked[cell]?0:path.filter(p=>distance(cell,p)<=r2).length}))
    .filter(c=>c.coverage>0).sort((a,b)=>b.coverage-a.coverage||a.cell-b.cell);
  for(const {cell} of ranked) {
    if(!canBuild(s,cell).ok)continue;
    const cmd={kind:"build" as const,cell,type:id};
    if(assessBuildRoute(data,s,cmd).safe)return cmd;
  }
}

export function learnerPolicy():Policy {
  const base=raiderPolicy("synergy-rookie");let priorLeaks=0;
  return {name:"learner-v1",decide(data,s,rng) {
    if(s.tick===0)priorLeaks=0;
    if(s.tick%40)return [];
    if(s.relicOffers.length){const pick=learnerOffers(data,s)[0];return pick?[{kind:"pickRelic",id:pick.id}]:[];}
    const leaked=s.stats.leaks>priorLeaks;priorLeaks=s.stats.leaks;
    const emergency=s.enemies.some(e=>e.hp>0&&s.dist[e.cell]!<=4)||(leaked&&s.lives<=3);
    const target=learnerTarget(data,s);
    if(target&&!emergency) {
      const command=safeBuild(data,s,target);
      if(command)return [command];
      if(s.gold<(data.towerById.get(target)?.cost??0)) {
        // Save actual income, but do not deadlock between waves waiting for it.
        return !s.inWave&&s.wave>0?[{kind:"callWave"}]:[];
      }
    }
    // Public near-core emergency releases saving; only affordable, legal actions.
    return preserveKillZone(data,s,base.decide(data,s,rng));
  }};
}
