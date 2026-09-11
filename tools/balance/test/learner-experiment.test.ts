import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createState, deriveData, runReplay, seedRng, withDifficulty } from "../../../packages/sim/src/index.ts";
import { runPolicy } from "../src/runner.ts";
import { learnerPolicy } from "../../../experiments/0004-raid-heat/learner-controller.ts";

const data=deriveData(withDifficulty(JSON.parse(readFileSync(new URL("../../../experiments/0004-raid-heat/candidate-v4/raid.json",import.meta.url),"utf8")),"easy"));
it("spends real income on owned typed boosts, with deterministic legal 40-tick commands",()=>{
  for(const seed of [1,4,5]) {
    const a=runPolicy(data,learnerPolicy(),seed),b=runPolicy(data,learnerPolicy(),seed);
    expect(a.finalHash).toBe(b.finalHash);
    let rejected=0;const replayed=runReplay(data,a.replay,400000,(_tick,events)=>{rejected+=events.filter(e=>e.kind==="rejected").length;});
    expect(replayed.finalHash).toBe(a.finalHash);expect(rejected).toBe(0);
    expect(a.replay.commands.every(c=>c.tick%40===0)).toBe(true);
    const id=seed===5?"conductive":"hot-wire",type=seed===5?"arc":"ember";
    const pick=a.replay.commands.find(c=>c.cmd.kind==="pickRelic"&&c.cmd.id===id)!;
    const purchase=a.replay.commands.find(c=>c.tick>pick.tick&&c.cmd.kind==="build"&&c.cmd.type===type)!;
    expect(purchase.tick-pick.tick).toBeLessThanOrEqual(400);
    if(seed===4) {
      const cold=a.replay.commands.find(c=>c.cmd.kind==="pickRelic"&&c.cmd.id==="cold-front")!;
      const frost=a.replay.commands.find(c=>c.tick>cold.tick&&c.cmd.kind==="build"&&c.cmd.type==="frost")!;
      expect(frost.tick-cold.tick).toBeLessThanOrEqual(400);
    }
  }
});
it("does not mutate cash/state or act between its decision boundaries",()=>{
  const state=createState(data,1);state.tick=20;const before=structuredClone(state);
  expect(learnerPolicy().decide(data,state,seedRng(1))).toEqual([]);
  expect(state).toEqual(before);
});
