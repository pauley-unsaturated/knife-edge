/** Verify the retained causal checkpoints, independent of ignored sweep output. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { deriveData, runReplay, validateReplay } from "../../../../packages/sim/src/index.ts";
const root=new URL("./",import.meta.url);
const manifest=JSON.parse(readFileSync(new URL("provenance.json",root),"utf8"));
for(const entry of manifest.keepers) {
  const text=readFileSync(new URL(entry.file,root),"utf8");
  if(createHash("sha256").update(text).digest("hex")!==entry.sha256)throw new Error(`File fingerprint changed: ${entry.file}`);
  const replay=validateReplay(JSON.parse(text));
  const rejects:unknown[]=[];
  const result=runReplay(deriveData(replay.data!),replay,400000,(tick,events)=>{for(const e of events)if(e.kind==="rejected")rejects.push({tick,...e});});
  if(rejects.length||result.finalHash!==entry.finalHash||result.ticks!==entry.endTick)throw new Error(`Invalid checkpoint: ${entry.file}`);
  const expected=entry.file.includes("-win-")?"won":"lost";
  if(result.state.outcome!==expected)throw new Error(`Outcome changed: ${entry.file}`);
  console.log(JSON.stringify({file:entry.file,outcome:result.state.outcome,wavesCleared:result.state.stats.wavesCleared,core:result.state.lives,verified:true,rejected:0}));
}
