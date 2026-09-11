/** Adaptive, identical-prefix opportunity-cost tests. No free resources or
 * knowledge of unseen offers. Witness selection is diagnostic, not a win rate. */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { canBuild, cloneState, deriveData, hashState, makeReplay, rerollCost, runReplay, seedRng, step, validateReplay, type Command, type Replay, type State, type TimedCommand } from "../../packages/sim/src/index.ts";
import { engineerPolicy, evaluateEngineerOffers } from "../../tools/balance/src/policies/engineer.ts";

const folder = process.argv[2];
if (!folder) throw new Error("Usage: engine-choices.ts replay-folder [limit=8]");
const limit = Number(process.argv[3] ?? 8);
const sourcePolicy = process.argv[4] ?? "engineer";
if (!/^[a-z-]+$/.test(sourcePolicy)) throw new Error("Invalid policy name");
const kind = process.argv[5] ?? "all";
const out = `${folder}/choices-${sourcePolicy}-${kind}`;
mkdirSync(out, { recursive: true });
const reports: unknown[] = [];
let count = 0;
for (const file of readdirSync(folder).filter(f => new RegExp(`^${sourcePolicy}-\\d+\\.replay\\.json$`).test(f)).sort()) {
  const replay = validateReplay(JSON.parse(readFileSync(`${folder}/${file}`, "utf8")));
  const data = deriveData(replay.data!);
  const candidates = replay.commands.filter(c => c.cmd.kind === "reroll" || kind !== "reroll" && c.cmd.kind === "build" && ["sprayer", "solvent"].includes(c.cmd.type));
  for (const at of candidates.slice(0, 2)) {
    if (count++ >= limit) break;
    const prefix = replay.commands.filter(c => c.tick < at.tick);
    const checkpoint = runReplay(data, { ...replay, commands: prefix, endTick: at.tick }, 400000).state;
    const choices: { name: string; command?: Command }[] = [{ name: "driver", command: at.cmd }];
    if (at.cmd.kind === "reroll") {
      const best = evaluateEngineerOffers(data, checkpoint)[0];
      if (best) choices.push({ name: "keep-visible", command: { kind: "pickRelic", id: best.id } });
    } else {
      choices.push({ name: "wait" });
      for (const id of ["bolt", "ember", "arc", at.cmd.type === "sprayer" ? "solvent" : "sprayer"]) {
        const t = data.towerById.get(id);
        if (t && t.cost <= checkpoint.gold && canBuild(checkpoint, at.cmd.cell).ok)
          choices.push({ name: `build-${id}`, command: { ...at.cmd, type: id } });
      }
      const upgrade = checkpoint.towers.filter(t => data.towerById.get(t.type)!.ladder[t.level]?.cost! <= checkpoint.gold)
        .sort((a, b) => b.spent - a.spent)[0];
      if (upgrade) choices.push({ name: "upgrade-investment", command: { kind: "upgrade", cell: upgrade.cell } });
    }
    const results = choices.map(choice => {
      const state = cloneState(checkpoint), commands: TimedCommand[] = [...prefix];
      const policy = engineerPolicy(), rng = seedRng(replay.seed ^ 0x61537);
      const rejected: unknown[] = [];
      const apply = (batch: Command[]) => {
        commands.push(...batch.map(cmd => ({ tick: state.tick, cmd })));
        for (const e of step(data, state, batch)) if (e.kind === "rejected") rejected.push({ tick: state.tick - 1, ...e });
      };
      apply(choice.command ? [choice.command] : []);
      // Enforce the chosen spend/keep alternative for this decision only. All
      // subsequent builds/offers can adapt; no fixed future schedule is reused.
      while (state.outcome === "playing" && state.tick < 400000) apply(policy.decide(data, state, rng));
      const witness = makeReplay(data, state, commands);
      if (runReplay(data, witness, 400000).finalHash !== hashState(state)) throw new Error("Adaptive replay mismatch");
      const name = `${replay.seed}-${at.tick}-${choice.name}.replay.json`;
      writeFileSync(`${out}/${name}`, JSON.stringify(witness));
      return { choice: choice.name, command: choice.command, outcome: state.outcome, wave: state.stats.wavesCleared, lives: state.lives, gold: state.gold, spent: state.stats.goldSpent, rejects: rejected, file: name };
    });
    const report = { seed: replay.seed, tick: at.tick, wave: checkpoint.wave, gold: checkpoint.gold, lives: checkpoint.lives, relics: checkpoint.relics, towers: checkpoint.towers, rerollCost: rerollCost(data, checkpoint), offers: evaluateEngineerOffers(data, checkpoint), results };
    reports.push(report);
    console.log(JSON.stringify({ seed: replay.seed, wave: checkpoint.wave, command: at.cmd, results }));
    writeFileSync(`${out}/report.json`, JSON.stringify(reports, null, 2));
  }
  if (count >= limit) break;
}
