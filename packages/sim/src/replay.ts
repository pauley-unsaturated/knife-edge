/**
 * Replays and hashing. A replay is (data version, seed, timed commands); running it through
 * `step` reproduces a run exactly. Hashes are FNV-1a 32-bit over a canonical string.
 */
import type { GameData } from "./data.js";
import { createState, step, type Event, type State, type TimedCommand } from "./world.js";

export interface Replay {
  dataVersion: string;
  seed: number;
  commands: TimedCommand[];
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
  const parts: string[] = [
    `t${s.tick}`, `g${s.gold}`, `l${s.lives}`, `w${s.wave}`, `wt${s.waveTimer}`, `iw${s.inWave ? 1 : 0}`,
    `r${s.rng.a},${s.rng.b},${s.rng.c},${s.rng.d}`, `q${s.spawnQueue.join(",")}`,
  ];
  for (const e of s.enemies) parts.push(`e${e.id}:${e.type}:${e.hp}:${e.cell}:${e.next}:${e.progress}`);
  for (const t of s.towers) parts.push(`T${t.cell}:${t.type}:${t.level}:${t.spent}:${t.cooldown}`);
  parts.push(`k${s.stats.kills},${s.stats.leaks},${s.stats.goldEarned},${s.stats.goldSpent}`);
  return parts.join("|");
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
export function runReplay(data: GameData, replay: Replay, maxTicks: number, onEvents?: (tick: number, ev: Event[]) => void): RunResult {
  if (replay.dataVersion !== data.version) throw new Error(`replay data version ${replay.dataVersion} != ${data.version}`);
  const s = createState(data, replay.seed);
  const cmds = [...replay.commands].sort((a, b) => a.tick - b.tick);
  let ci = 0;
  const waveHashes: number[] = [];
  while (s.outcome === "playing" && s.tick < maxTicks) {
    const batch = [];
    while (ci < cmds.length && (cmds[ci] as TimedCommand).tick === s.tick) batch.push((cmds[ci++] as TimedCommand).cmd);
    const ev = step(data, s, batch);
    if (ev.some((e) => e.kind === "waveEnd")) waveHashes.push(hashState(s));
    if (onEvents && ev.length) onEvents(s.tick - 1, ev);
  }
  return { state: s, waveHashes, finalHash: hashState(s), ticks: s.tick };
}
