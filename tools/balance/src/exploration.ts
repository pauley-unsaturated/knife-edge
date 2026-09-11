import {
  SCALE,
  hashState,
  makeReplay,
  mulBp,
  replayState,
  rerollCost,
  rollOffers,
  runReplay,
  step,
  validateReplay,
  type Command,
  type GameData,
  type Replay,
  type TimedCommand,
  type Tower,
} from "@knife-edge/sim";

export interface ExplorationOptions {
  /** Counterfactual horizon, in simulation ticks. Defaults to 400,000. */
  maxTicks?: number;
  freezeWaves?: number[];
  choiceLimit?: number;
}

export interface Rejection {
  tick: number;
  command: Command;
  reason: string;
}

export interface WaveCheckpoint {
  wave: number;
  /** State tick after the wave ends, or after the final simulated tick. */
  tick: number;
  completed: boolean;
  lives: number;
  bank: number;
  goldAtStart: number;
  livesAtStart: number;
  goldSpent: number;
  spendByType: Record<string, number>;
  towers: Tower[];
  relics: string[];
  patchOffers: string[];
  patchChoices: string[];
  /** Minimum observed post-tick path distance of a live enemy; leaks set zero.
   * Not a solved defense margin. Null means no surviving enemy was sampled. */
  nearestSurvivorCells: number | null;
  leaks: number;
  finalHash: number;
}

export interface PatchDecision {
  afterWave: number;
  tick: number;
  commandIndex: number;
  chosen: string;
  offers: string[];
  affordableOffers: string[];
  lives: number;
  bank: number;
}

export interface ExplorationWitness {
  outcome: "won" | "lost" | "timeout";
  wavesCleared: number;
  lives: number;
  gold: number;
  goldSpent: number;
  ticks: number;
  finalHash: number;
  rejections: Rejection[];
  replayVerified: boolean;
  replay: Replay;
}

export interface ExplorationReport {
  /** Fixed-command counterfactuals measure dependence, not adaptive player skill.
   * Timing changes may invalidate later commands; inspect rejections. */
  method: string;
  original: ExplorationWitness;
  verification: {
    expectedHash: number | null;
    matchesExpectedHash: boolean | null;
    matchesIndependentReplay: boolean;
  };
  waves: WaveCheckpoint[];
  patchDecisions: PatchDecision[];
  frozenDefense: {
    afterWave: number;
    checkpointTick: number | null;
    /** Null when the original run did not clear this wave. */
    result: ExplorationWitness | null;
  }[];
  noPatches: ExplorationWitness;
  choiceBranches: {
    decision: PatchDecision;
    alternatives: {
      id: string;
      wasOriginal: boolean;
      pickRejected: boolean;
      result: ExplorationWitness;
    }[];
  }[];
}

export interface ReplayInspection {
  witness: ExplorationWitness;
  waves: WaveCheckpoint[];
  decisions: PatchDecision[];
}

/** Trace the real sim, never a damage/economy approximation. */
function trace(
  data: GameData,
  source: Replay,
  commands: TimedCommand[],
  maxTicks: number,
  telemetry: boolean,
): ReplayInspection {
  const s = replayState(data, source);
  const waves: WaveCheckpoint[] = [];
  const decisions: PatchDecision[] = [];
  const rejections: Rejection[] = [];
  const spendByType: Record<string, number> = {};
  const towerTypes = new Map<number, string>();
  let ci = 0;
  let active: {
    wave: number;
    gold: number;
    lives: number;
    leaks: number;
    nearest: number | null;
  } | null = null;
  const checkpoint = (completed: boolean): void => {
    if (!active) return;
    waves.push({
      wave: active.wave,
      tick: s.tick,
      completed,
      lives: s.lives,
      bank: s.gold,
      goldAtStart: active.gold,
      livesAtStart: active.lives,
      goldSpent: s.stats.goldSpent,
      spendByType: { ...spendByType },
      towers: s.towers.map((t) => ({ ...t })),
      relics: [...s.relics],
      patchOffers: [...s.relicOffers],
      patchChoices: [],
      nearestSurvivorCells: active.nearest,
      leaks: s.stats.leaks - active.leaks,
      finalHash: hashState(s),
    });
    active = null;
  };
  while (s.outcome === "playing" && s.tick < maxTicks) {
    const start = ci;
    const batch: Command[] = [];
    while (ci < commands.length && commands[ci]!.tick === s.tick)
      batch.push(commands[ci++]!.cmd);
    const tick = s.tick;
    const preLives = s.lives;
    const preLeaks = s.stats.leaks;
    const preWave = s.wave;
    const preGold = s.gold;
    const preOffers = telemetry ? [...s.relicOffers] : [];
    const preOfferRerolls = s.offerRerolls ?? 0;
    const decisionTowers = telemetry && batch.some((c) => c.kind === "pickRelic")
      ? new Map(s.towers.map((t) => [t.cell, { ...t }]))
      : null;
    const events = step(data, s, batch);
    const rejected = new Set<Command>();
    for (const e of events) {
      if (e.kind === "rejected") {
        rejections.push({ tick, command: { ...e.cmd }, reason: e.reason });
        rejected.add(e.cmd);
      }
    }
    if (!telemetry) continue;
    let decisionLives = preLives;
    let decisionGold = preGold;
    let decisionRerolls = preOfferRerolls;
    let offered = preOffers;
    for (let i = start; i < ci; i++) {
      const cmd = commands[i]!.cmd;
      if (rejected.has(cmd)) continue;
      // Commands in a tick are ordered: purchases or sacrifices before the pick
      // belong to its actual checkpoint, even though no simulation tick elapsed.
      if (decisionTowers && cmd.kind === "build") {
        const cost = data.towerById.get(cmd.type)!.ladder[0]!.cost;
        decisionGold -= cost;
        decisionTowers.set(cmd.cell, {
          cell: cmd.cell, type: cmd.type, level: 1, spent: cost,
          cooldown: 0, priority: "first",
        });
      } else if (decisionTowers && cmd.kind === "upgrade") {
        const tower = decisionTowers.get(cmd.cell)!;
        const cost = data.towerById.get(tower.type)!.ladder[tower.level]!.cost;
        decisionGold -= cost;
        tower.spent += cost;
        tower.level++;
      } else if (decisionTowers && cmd.kind === "sell") {
        const tower = decisionTowers.get(cmd.cell)!;
        decisionGold += mulBp(tower.spent, data.economy.sellRefundBp);
        decisionTowers.delete(cmd.cell);
      } else if (cmd.kind === "raid") {
        decisionGold += data.raids!.hideouts.find((h) => h.id === cmd.id)!.gold;
      } else if (cmd.kind === "callWave") {
        const waveStart = events.find((e) => e.kind === "waveStart");
        if (waveStart?.kind === "waveStart")
          decisionGold += waveStart.interest + waveStart.earlyBonus;
      } else if (cmd.kind === "reroll") {
        decisionGold -= rerollCost(data, { offerRerolls: decisionRerolls })!;
        decisionRerolls++;
        // Reconstruct an already-executed recorded roll, never a hypothetical
        // future offer. Commands within this tick must see the updated offer.
        offered = rollOffers(data, s.seed, preWave, decisionRerolls);
      }
      if (cmd.kind !== "pickRelic") continue;
      const decision: PatchDecision = {
        afterWave: preWave,
        tick,
        commandIndex: i,
        chosen: cmd.id,
        offers: [...offered],
        affordableOffers: offered.filter((id) => {
          const relic = data.relics.find((r) => r.id === id)!;
          return decisionLives > (relic.sacrificeLives ?? 0);
        }),
        lives: decisionLives,
        bank: decisionGold,
      };
      decisions.push(decision);
      waves.find((w) => w.wave === preWave)?.patchChoices.push(cmd.id);
      decisionLives -= data.relics.find((r) => r.id === cmd.id)!.sacrificeLives ?? 0;
      offered = [];
    }
    let eventGold = preGold;
    for (const e of events) {
      if (e.kind === "waveStart") {
        eventGold += e.interest + e.earlyBonus;
        active = {
          wave: e.wave,
          gold: eventGold,
          lives: preLives,
          leaks: preLeaks,
          nearest: null,
        };
      } else if (e.kind === "build") {
        towerTypes.set(e.cell, e.type);
        spendByType[e.type] =
          (spendByType[e.type] ?? 0) + data.towerById.get(e.type)!.ladder[0]!.cost;
        eventGold -= data.towerById.get(e.type)!.ladder[0]!.cost;
      } else if (e.kind === "upgrade") {
        const type = towerTypes.get(e.cell)!;
        spendByType[type] =
          (spendByType[type] ?? 0) + data.towerById.get(type)!.ladder[e.level - 1]!.cost;
        eventGold -= data.towerById.get(type)!.ladder[e.level - 1]!.cost;
      } else if (e.kind === "sell") {
        towerTypes.delete(e.cell);
        eventGold += e.refund;
      } else if (e.kind === "kill") {
        eventGold += e.bounty;
      } else if (e.kind === "raid") {
        eventGold += e.gold;
      } else if (e.kind === "reroll") {
        eventGold -= e.gold;
      }
    }
    if (active) {
      if (events.some((e) => e.kind === "leak")) active.nearest = 0;
      for (const enemy of s.enemies) {
        const remaining = Math.max(0, s.dist[enemy.cell]! - enemy.progress / SCALE);
        active.nearest = active.nearest === null
          ? remaining
          : Math.min(active.nearest, remaining);
      }
    }
    for (const e of events)
      if (e.kind === "waveEnd") checkpoint(s.stats.wavesCleared >= e.wave);
  }
  checkpoint(false);
  // A changed branch may end before the original command schedule; future inputs
  // must not be included in an importable replay whose endTick precedes them.
  const replay = makeReplay(data, s, commands.slice(0, ci));
  if (source.initialWave !== undefined) replay.initialWave = source.initialWave;
  const verified = runReplay(data, replay, maxTicks);
  const finalHash = hashState(s);
  return {
    witness: {
      outcome: s.outcome === "playing" ? "timeout" : s.outcome,
      wavesCleared: s.stats.wavesCleared,
      lives: s.lives,
      gold: s.gold,
      goldSpent: s.stats.goldSpent,
      ticks: s.tick,
      finalHash,
      rejections,
      replayVerified: verified.finalHash === finalHash && verified.ticks === s.tick,
      replay,
    },
    waves,
    decisions,
  };
}

/** Exact trace without policy counterfactuals; reusable by held-out validation. */
export function inspectReplay(
  data: GameData,
  replay: Replay,
  maxTicks = 400_000,
): ReplayInspection {
  validateReplay(replay);
  if (replay.dataVersion !== data.version) throw new Error("inspection data version mismatch");
  if (!Number.isInteger(maxTicks) || maxTicks < 1 || maxTicks > 400_000)
    throw new Error("inspection maxTicks must be 1..400000");
  if (replay.endTick !== undefined && replay.endTick > maxTicks)
    throw new Error("inspection horizon is shorter than the source replay");
  return trace(data, replay, replay.commands, replay.endTick ?? maxTicks, true);
}

/**
 * Replay-backed decision-pressure probes for a runPolicy replay (or human replay).
 * No I/O: callers persist the returned witnesses alongside their experiment.
 * Every variant is replay-verified. These are fixed-schedule interventions, not
 * reoptimized alternate strategies or claims that a human would repeat a mistake.
 */
export function analyzeExploration(
  data: GameData,
  replay: Replay,
  options: ExplorationOptions = {},
): ExplorationReport {
  validateReplay(replay);
  if (replay.dataVersion !== data.version) throw new Error("exploration data version mismatch");
  const maxTicks = options.maxTicks ?? 400_000;
  if (!Number.isInteger(maxTicks) || maxTicks < 1 || maxTicks > 400_000)
    throw new Error("exploration maxTicks must be 1..400000");
  const freezeWaves = options.freezeWaves ?? [4, 8, 12];
  const choiceLimit = options.choiceLimit ?? 3;
  if (!Number.isInteger(choiceLimit) || choiceLimit < 0)
    throw new Error("exploration choiceLimit must be a nonnegative integer");
  if (freezeWaves.some((w) => !Number.isInteger(w) || w < 1))
    throw new Error("exploration freeze waves must be positive integers");
  if (replay.endTick !== undefined && replay.endTick > maxTicks)
    throw new Error("exploration horizon is shorter than the source replay");
  const original = trace(data, replay, replay.commands, replay.endTick ?? maxTicks, true);
  const independent = runReplay(data, replay, maxTicks);
  const variant = (commands: TimedCommand[]): ExplorationWitness =>
    trace(data, replay, commands, maxTicks, false).witness;
  return {
    method: "Fixed-command interventions; later timing and purchases are not reoptimized. Frozen defense removes ALL later inputs (including wave calls and patches), allowing automatic waves. Inspect rejection counts before interpreting alternatives. Nearest-survivor distance is sampled, not a solved defense margin.",
    original: original.witness,
    verification: {
      expectedHash: replay.finalHash ?? null,
      matchesExpectedHash: replay.finalHash === undefined ? null : original.witness.finalHash === replay.finalHash,
      matchesIndependentReplay: original.witness.finalHash === independent.finalHash && original.witness.ticks === independent.ticks,
    },
    waves: original.waves,
    patchDecisions: original.decisions,
    frozenDefense: freezeWaves.map((afterWave) => {
      const checkpoint = original.waves.find((w) => w.wave === afterWave && w.completed);
      return {
        afterWave,
        checkpointTick: checkpoint?.tick ?? null,
        result: checkpoint
          ? variant(replay.commands.filter((c) => c.tick < checkpoint.tick))
          : null,
      };
    }),
    noPatches: variant(replay.commands.filter((c) => c.cmd.kind !== "pickRelic")),
    choiceBranches: original.decisions.slice(0, choiceLimit).map((decision) => ({
      decision,
      alternatives: decision.affordableOffers.map((id) => {
        const commands = replay.commands.map((c, i): TimedCommand =>
          i === decision.commandIndex ? { tick: c.tick, cmd: { kind: "pickRelic", id } } : c,
        );
        const result = variant(commands);
        return {
          id,
          wasOriginal: id === decision.chosen,
          pickRejected: result.rejections.some((r) => r.tick === decision.tick && r.command.kind === "pickRelic" && r.command.id === id),
          result,
        };
      }),
    })),
  };
}
