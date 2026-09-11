/** Isolated wave-2 budget probe. Hypothesis before runs: the smallest increase
 * from 200 to 220/235/250 can make one extra purchase matter without making
 * wave 1 dangerous or changing wave 3's 250 budget. All other HP7 rules stay
 * fixed. These are first-three-wave prefixes, not full-run win rates.
 * pnpm exec tsx experiments/0004-raid-heat/opening.ts
 * pnpm exec tsx experiments/0004-raid-heat/opening.ts armor
 * Armor mode holds wave2 budget200/wave3 budget250 fixed and changes ONLY the
 * armored unlock from3 to2. Hypothesis: kinetic resistance creates an early
 * preview-driven investment decision without starving a sensible opener.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  canBuild, cloneState, createState, deriveData, fnv1a, makeReplay, runReplay,
  seedRng, step, withDifficulty, type Command, type GameData, type State,
  type TimedCommand,
} from "../../packages/sim/src/index.ts";
import { makePolicy } from "../../tools/balance/src/policies/index.ts";

const armorMode = process.argv[2] === "armor";
if (process.argv[2] && !armorMode) throw new Error("Expected optional 'armor' mode");
const out = new URL(`./out/opening-${armorMode ? "armored2-" : ""}hp7-1-16/`, import.meta.url);
mkdirSync(out, { recursive: true });
const source = JSON.parse(readFileSync(new URL("./out/pressure-1-16/hp-10700/data.json", import.meta.url), "utf8"));
const driverHash = fnv1a(["engineer", "raider", "greedy", "path-guard"].map(name =>
  readFileSync(new URL(`../../tools/balance/src/policies/${name}.ts`, import.meta.url), "utf8")).join("\n"));
const manifest = { source, driverHash, budgets: armorMode ? [200] : [200, 220, 235, 250], policies: ["engineer", "engineer-rookie"], seeds: "1..16",
  ...(armorMode ? { armoredUnlockWaves: [3, 2] } : {}),
  hypothesis: armorMode ? "Only unlock armored enemies one wave earlier: wave2 preview should make damage-type investment matter, with a free first wave and recoverable resource timing. Budgets200/250 remain unchanged." : "Wave2 should punish taking no further actions after the free first wave, but one affordable extra purchase should recover; wave3 unchanged.",
  method: "Normal driver through wave3, then paired replay continuations from its exact wave1 checkpoint: no further input, or its next chosen purchase once affordable. Counterfactual waves start automatically; no later patches, purchases, or early-call gold. Prefix replays end after wave3 or death, not full clears." };
const manifestPath = new URL("manifest.json", out);
if (existsSync(manifestPath) && JSON.stringify(JSON.parse(readFileSync(manifestPath, "utf8"))) !== JSON.stringify(manifest))
  throw new Error("Opening output already exists with different frozen inputs");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

type Checkpoint = { wave: number; lives: number; gold: number; leaks: number; tick: number };
type OpeningResult = { outcome: State["outcome"]; wavesCleared: number; lives: number; gold: number; goldSpent: number;
  rejections: number; checkpoints: Checkpoint[]; replayFile: string; replayVerified: boolean;
  purchase?: Command | null; purchaseTick?: number | null };
function price(data: GameData, s: State, cmd: Command): number {
  if (cmd.kind === "build") return data.towerById.get(cmd.type)!.cost;
  if (cmd.kind === "upgrade") {
    const tower = s.towers.find(t => t.cell === cmd.cell);
    return tower ? data.towerById.get(tower.type)!.ladder[tower.level]?.cost ?? Infinity : Infinity;
  }
  return Infinity;
}
const reports = [];
let witnesses = 0;
for (const setting of armorMode ? [3, 2] : manifest.budgets) {
  const budget = armorMode ? 200 : setting;
  const tag = armorMode ? `armor-${setting}` : `${budget}`;
  const raw = structuredClone(source);
  raw.version += `/opening-${tag}`;
  raw.composer.openingBudgets[1] = budget;
  if (armorMode) raw.enemies.find((enemy: { id: string }) => enemy.id === "armored").unlockWave = setting;
  const data = deriveData(withDifficulty(raw, "medium"));
  for (const policyName of manifest.policies) {
    const rows: { seed: number; normal: OpeningResult; frozen: OpeningResult | null; onePurchase: OpeningResult | null }[] = [];
    for (let seed = 1; seed <= 16; seed++) {
      const policy = makePolicy(policyName);
      let h = 0;
      for (const char of policy.name) h = (h * 31 + char.charCodeAt(0)) >>> 0;
      const rng = seedRng((seed ^ h) >>> 0);
      const s = createState(data, seed);
      const commands: TimedCommand[] = [];
      const waves: Checkpoint[] = [];
      let frozen: { state: State; prefix: TimedCommand[] } | undefined;
      let rejections = 0;
      while (s.outcome === "playing" && s.stats.wavesCleared < 3 && s.tick < 20_000) {
        const cmds = policy.decide(data, s, rng);
        commands.push(...cmds.map(cmd => ({ tick: s.tick, cmd })));
        const events = step(data, s, cmds);
        rejections += events.filter(e => e.kind === "rejected").length;
        for (const e of events) if (e.kind === "waveEnd") {
          waves.push({ wave: e.wave, lives: s.lives, gold: s.gold, leaks: s.stats.leaks, tick: s.tick });
          if (e.wave === 1) frozen = { state: cloneState(s), prefix: [...commands] };
        }
      }
      const persist = (suffix: string, state: State, inputs: TimedCommand[], checkpoints: Checkpoint[], rejected: number) => {
        const replay = makeReplay(data, state, inputs);
        const verified = runReplay(data, replay, 20_000);
        if (verified.finalHash !== replay.finalHash || verified.ticks !== state.tick) throw new Error("Opening replay mismatch");
        const replayFile = `${policyName}-${tag}-${seed}-${suffix}.replay.json`;
        writeFileSync(new URL(replayFile, out), JSON.stringify(replay));
        witnesses++;
        return { outcome: state.outcome, wavesCleared: state.stats.wavesCleared, lives: state.lives, gold: state.gold,
          goldSpent: state.stats.goldSpent, rejections: rejected, checkpoints, replayFile, replayVerified: true };
      };
      const normal = persist("normal", s, commands, waves, rejections);
      const purchase = frozen ? commands.find(c => c.tick >= frozen!.state.tick && (c.cmd.kind === "build" || c.cmd.kind === "upgrade"))?.cmd : undefined;
      const continuation = (onePurchase: boolean) => {
        if (!frozen) return null;
        const state = cloneState(frozen.state), inputs = [...frozen.prefix];
        const checkpoints = waves.filter(w => w.wave === 1);
        let spent = false, rejected = 0, purchaseTick: number | null = null;
        while (state.outcome === "playing" && state.stats.wavesCleared < 3 && state.tick < 20_000) {
          const cmds: Command[] = [];
          if (onePurchase && purchase && !spent && state.tick % 20 === 0 && state.gold >= price(data, state, purchase) &&
              (purchase.kind !== "build" || canBuild(state, purchase.cell).ok)) {
            cmds.push(purchase); spent = true; purchaseTick = state.tick;
          }
          inputs.push(...cmds.map(cmd => ({ tick: state.tick, cmd })));
          const events = step(data, state, cmds);
          rejected += events.filter(e => e.kind === "rejected").length;
          for (const e of events) if (e.kind === "waveEnd")
            checkpoints.push({ wave: e.wave, lives: state.lives, gold: state.gold, leaks: state.stats.leaks, tick: state.tick });
        }
        return { ...persist(onePurchase ? "one-purchase" : "frozen", state, inputs, checkpoints, rejected), purchase: onePurchase ? purchase ?? null : null, purchaseTick };
      };
      rows.push({ seed, normal, frozen: continuation(false), onePurchase: continuation(true) });
    }
    const arms = ["normal", "frozen", "onePurchase"] as const;
    const report = { budget, ...(armorMode ? { armoredUnlockWave: setting } : {}), policy: policyName, driverHash, rows,
      arms: Object.fromEntries(arms.map(arm => {
        const runs = rows.flatMap(row => row[arm] ? [row[arm]!] : []);
        return [arm, { runs: runs.length, rejections: runs.reduce((n, row) => n + row.rejections, 0),
          waves: [1, 2, 3].map(wave => {
            const checks = runs.flatMap(row => row.checkpoints.filter(w => w.wave === wave));
            const lives = checks.map(w => w.lives).sort((a, b) => a - b);
            return { wave, reachedEnd: checks.length, perfect: checks.filter(w => w.leaks === 0 && w.lives > 0).length,
              alive: checks.filter(w => w.lives > 0).length, minCore: lives[0] ?? null,
              medianCore: lives[Math.floor((lives.length - 1) / 2)] ?? null };
          }),
        }];
      })),
    };
    reports.push(report);
    writeFileSync(new URL(`${policyName}-${tag}.report.json`, out), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, rows: undefined }));
  }
}
writeFileSync(new URL("summary.json", out), JSON.stringify({ manifest, witnesses, reports }, null, 2));
console.log(JSON.stringify({ done: out.href, witnesses }));
