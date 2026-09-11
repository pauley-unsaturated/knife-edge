/** Pure reusable checks for frozen engine configurations. No filesystem, CLI,
 * acceptance bands, or hidden tuning: CI supplies its own observed thresholds. */
import {
  createState, fnv1a, runReplay,
  type GameData, type RawGameData,
} from "@knife-edge/sim";
import { inspectReplay, type PatchDecision, type Rejection, type WaveCheckpoint } from "./exploration.js";
import type { Policy } from "./policy.js";
import { runPolicy, summarize, type RunSummary } from "./runner.js";

export interface CheckedEngineRun extends RunSummary {
  replayVerified: boolean;
  boardFingerprint: number;
  waves: WaveCheckpoint[];
  earlyWaves: { wave: number; reached: boolean; completed: boolean; leaks: number | null; core: number | null }[];
  patchDecisions: PatchDecision[];
  chosenDrops: string[];
  statusDrops: string[];
  typeCounts: Record<string, number>;
  typeInvestment: Record<string, number>;
  levelCounts: Record<string, number>;
  upgrades: number;
  supportBuilds: number;
  rerolls: number;
  rerollFees: number;
  rejectedCommands: Rejection[];
}

/** Neutralizes patch effects only. Retains offers/weights, reroll prices,
 * sacrifices, baseline interest and tower coating mechanics for matched rules. */
export function neutralEnginePatches(raw: RawGameData): RawGameData {
  const next = structuredClone(raw);
  next.version += "/neutral-patches";
  next.relics = next.relics.map((r) => ({
    ...r, damageBp: 10000, slowDamageBp: 10000, interestBp: 0,
    lowLifeDamageBp: 10000, interestCapBonusGold: 0, interestRateMultiplierBp: 10000,
    deathBurstBp: 0, poisonDamageBp: 0, poisonTicks: 0,
    confusionDamageBp: 0, confusionTicks: 0, hitSlowBp: 10000, hitSlowTicks: 0,
    description: `Neutral-patch diagnostic: effects disabled; sacrifice cost retained. ${r.name}`,
  }));
  return next;
}

/** Runs a fresh policy, traces exact checkpoints, and independently replays all
 * commands. Returns failures as evidence; assertEngineRun supplies strict gates. */
export function runEngineValidation(data: GameData, policy: Policy, seed: number, maxTicks = 400_000): CheckedEngineRun {
  if (!Number.isInteger(maxTicks) || maxTicks < 1 || maxTicks > 400_000)
    throw new Error("validation maxTicks must be 1..400000");
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("validation seed must be uint32");
  const run = runPolicy(data, policy, seed, maxTicks);
  const inspected = inspectReplay(data, run.replay, maxTicks);
  let upgrades = 0, supportBuilds = 0, rerolls = 0, rerollFees = 0;
  const replayed = runReplay(data, run.replay, maxTicks, (_, events) => {
    for (const e of events) {
      if (e.kind === "upgrade") upgrades++;
      if (e.kind === "build" && data.towerById.get(e.type)?.coating) supportBuilds++;
      if (e.kind === "reroll") { rerolls++; rerollFees += e.gold; }
    }
  });
  const typeCounts: Record<string, number> = {};
  const typeInvestment: Record<string, number> = {};
  const levelCounts: Record<string, number> = {};
  for (const tower of replayed.state.towers) {
    typeCounts[tower.type] = (typeCounts[tower.type] ?? 0) + 1;
    typeInvestment[tower.type] = (typeInvestment[tower.type] ?? 0) + tower.spent;
    levelCounts[tower.level] = (levelCounts[tower.level] ?? 0) + 1;
  }
  const grid = createState(data, seed).grid;
  return {
    ...run,
    replayVerified: inspected.witness.replayVerified && inspected.witness.finalHash === run.finalHash &&
      replayed.finalHash === run.finalHash && replayed.ticks === run.ticks,
    boardFingerprint: fnv1a(JSON.stringify({ width: grid.width, height: grid.height, entry: grid.entry, core: grid.core, obstacle: Array.from(grid.obstacle) })),
    waves: inspected.waves,
    earlyWaves: [1, 2, 3].map((wave) => {
      const observation = inspected.waves.find((w) => w.wave === wave);
      return { wave, reached: observation !== undefined, completed: observation?.completed ?? false,
        leaks: observation?.leaks ?? null, core: observation?.lives ?? null };
    }),
    patchDecisions: inspected.decisions,
    chosenDrops: [...replayed.state.relics],
    statusDrops: replayed.state.relics.filter((id) => {
      const r = data.relics.find((p) => p.id === id)!;
      return !!(r.poisonDamageBp || r.confusionDamageBp || r.deathBurstBp || (r.hitSlowBp ?? 10000) < 10000);
    }),
    typeCounts, typeInvestment, levelCounts,
    upgrades, supportBuilds, rerolls, rerollFees,
    rejectedCommands: inspected.witness.rejections,
  };
}

export function assertEngineRun(run: CheckedEngineRun, allowTimeout = false): void {
  const label = `${run.policy}/seed${run.seed}`;
  if (!run.replayVerified) throw new Error(`Replay verification failed: ${label}`);
  if (run.rejectedCommands.length) throw new Error(`${run.rejectedCommands.length} rejected commands: ${label}`);
  if (!allowTimeout && run.outcome === "timeout") throw new Error(`Run did not reach a terminal outcome: ${label}`);
}

export function summarizeEngineValidation(rows: readonly CheckedEngineRun[]) {
  return {
    ...summarize([...rows]),
    allReplaysVerified: rows.every((r) => r.replayVerified),
    rejectedCommands: rows.reduce((n, r) => n + r.rejectedCommands.length, 0),
    timeouts: rows.filter((r) => r.outcome === "timeout").length,
    earlyWaves: [1, 2, 3].map((wave) => {
      const observations = rows.map((r) => r.earlyWaves.find((w) => w.wave === wave)!).filter((w) => w.reached);
      return { wave, reached: observations.length, completed: observations.filter((w) => w.completed).length,
        leakRuns: observations.filter((w) => (w.leaks ?? 0) > 0).length,
        leaks: observations.reduce((n, w) => n + (w.leaks ?? 0), 0) };
    }),
    supportRuns: rows.filter((r) => r.supportBuilds > 0).length,
    supportBuilds: rows.reduce((n, r) => n + r.supportBuilds, 0),
    upgradedRuns: rows.filter((r) => r.upgrades > 0).length,
    upgrades: rows.reduce((n, r) => n + r.upgrades, 0),
    rerollRuns: rows.filter((r) => r.rerolls > 0).length,
    rerolls: rows.reduce((n, r) => n + r.rerolls, 0),
    rerollFees: rows.reduce((n, r) => n + r.rerollFees, 0),
  };
}
