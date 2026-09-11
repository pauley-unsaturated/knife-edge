/**
 * Replays and hashing. A replay is (data version, seed, timed commands); running it through
 * `step` reproduces a run exactly. Hashes are FNV-1a 32-bit over a canonical string.
 */
import {
  rawData,
  validateData,
  type GameData,
  type RawGameData,
} from "./data.js";
import {
  createState,
  step,
  type Event,
  type State,
  type TimedCommand,
} from "./world.js";

export interface Replay {
  dataVersion: string;
  seed: number;
  commands: TimedCommand[];
  data?: RawGameData;
  endTick?: number;
  finalHash?: number;
  /** Isolated-wave balance probe. Omitted for ordinary runs. */
  initialWave?: number;
}

export function replayState(data: GameData, replay: Replay): State {
  const state = createState(data, replay.seed);
  if (replay.initialWave !== undefined) state.wave = replay.initialWave - 1;
  return state;
}

export function makeReplay(
  data: GameData,
  s: State,
  commands: TimedCommand[],
): Replay {
  return {
    dataVersion: data.version,
    data: rawData(data),
    seed: s.seed,
    commands: commands.map((c) => ({ tick: c.tick, cmd: { ...c.cmd } })),
    endTick: s.tick,
    finalHash: hashState(s),
  };
}

/** JSON is untrusted. Bound playback and reject malformed/out-of-order commands. */
export function validateReplay(value: unknown): Replay {
  if (!value || typeof value !== "object") throw new Error("invalid replay");
  const r = value as Replay;
  if (
    typeof r.dataVersion !== "string" ||
    !Number.isSafeInteger(r.seed) ||
    r.seed < 0 ||
    r.seed > 0xffffffff
  )
    throw new Error("invalid replay header");
  if (!Array.isArray(r.commands) || r.commands.length > 100000)
    throw new Error("invalid command list");
  if (r.data) {
    validateData(r.data);
    if (r.data.version !== r.dataVersion)
      throw new Error("embedded data version mismatch");
  }
  if (
    r.initialWave !== undefined &&
    (!r.data ||
      !Number.isInteger(r.initialWave) ||
      r.initialWave < 1 ||
      r.initialWave > r.data.economy.maxWaves)
  )
    throw new Error("invalid probe wave");
  if (
    r.endTick !== undefined &&
    (!Number.isSafeInteger(r.endTick) || r.endTick < 0 || r.endTick > 400000)
  )
    throw new Error("invalid end tick");
  if (
    r.finalHash !== undefined &&
    (!Number.isInteger(r.finalHash) ||
      r.finalHash < 0 ||
      r.finalHash > 0xffffffff)
  )
    throw new Error("invalid hash");
  let previous = -1;
  for (const timed of r.commands) {
    if (
      !timed ||
      !Number.isSafeInteger(timed.tick) ||
      timed.tick < previous ||
      timed.tick > 400000 ||
      timed.tick < 0 ||
      (r.endTick !== undefined && timed.tick >= r.endTick)
    )
      throw new Error("invalid command tick");
    previous = timed.tick;
    const cmd = timed.cmd;
    if (
      !cmd ||
      !["build", "upgrade", "sell", "callWave", "target", "pickRelic", "raid", "reroll"].includes(
        cmd.kind,
      )
    )
      throw new Error("unknown replay command");
    if (
      (cmd.kind === "build" || cmd.kind === "upgrade" || cmd.kind === "sell" || cmd.kind === "target") &&
      (!Number.isInteger(cmd.cell) || cmd.cell < 0 || cmd.cell >= 1200)
    )
      throw new Error("invalid command cell");
    if (cmd.kind === "build" && typeof cmd.type !== "string")
      throw new Error("invalid tower");
    if ((cmd.kind === "pickRelic" || cmd.kind === "raid") && typeof cmd.id !== "string")
      throw new Error("invalid relic");
    if (
      cmd.kind === "target" &&
      !["first", "last", "strongest", "weakest"].includes(cmd.priority)
    )
      throw new Error("invalid priority");
  }
  return r;
}

export function fnv1a(str: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Canonical, order-stable snapshot of everything that matters for determinism. */
export function canonical(s: State): string {
  return JSON.stringify({
    seed: s.seed,
    tick: s.tick,
    gold: s.gold,
    lives: s.lives,
    wave: s.wave,
    waveTimer: s.waveTimer,
    inWave: s.inWave,
    rng: s.rng,
    grid: {
      width: s.grid.width,
      height: s.grid.height,
      entry: s.grid.entry,
      core: s.grid.core,
      obstacle: Array.from(s.grid.obstacle),
    },
    blocked: Array.from(s.blocked),
    dist: Array.from(s.dist),
    spawnQueue: s.spawnQueue,
    spawnCooldown: s.spawnCooldown,
    nextEnemyId: s.nextEnemyId,
    enemies: s.enemies,
    towers: s.towers,
    stats: s.stats,
    outcome: s.outcome,
    relics: s.relics,
    relicOffers: s.relicOffers,
    ...(s.raided ? { raided: s.raided } : {}),
    ...(s.offerRerolls !== undefined ? { offerRerolls: s.offerRerolls } : {}),
  });
}

export function hashState(s: State): number {
  return fnv1a(canonical(s));
}

export interface RunResult {
  state: State;
  /** Hash at each wave end, in order, then the final state. */
  waveHashes: number[];
  finalHash: number;
  ticks: number;
}

/** Run a replay to completion (or maxTicks). Deterministic by construction. */
export function runReplay(
  data: GameData,
  replay: Replay,
  maxTicks: number,
  onEvents?: (tick: number, ev: Event[]) => void,
): RunResult {
  validateReplay(replay);
  if (replay.dataVersion !== data.version)
    throw new Error(
      `replay data version ${replay.dataVersion} != ${data.version}`,
    );
  const s = replayState(data, replay);
  const cmds = [...replay.commands].sort((a, b) => a.tick - b.tick);
  let ci = 0;
  const waveHashes: number[] = [];
  while (
    s.outcome === "playing" &&
    s.tick < Math.min(maxTicks, replay.endTick ?? maxTicks)
  ) {
    const batch = [];
    while (ci < cmds.length && (cmds[ci] as TimedCommand).tick === s.tick)
      batch.push((cmds[ci++] as TimedCommand).cmd);
    const ev = step(data, s, batch);
    if (ev.some((e) => e.kind === "waveEnd")) waveHashes.push(hashState(s));
    if (onEvents && ev.length) onEvents(s.tick - 1, ev);
  }
  return { state: s, waveHashes, finalHash: hashState(s), ticks: s.tick };
}
