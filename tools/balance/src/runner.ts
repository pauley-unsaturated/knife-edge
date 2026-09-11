import {
  createState, hashState, seedRng, step,
  type GameData, type Replay, type TimedCommand,
} from "@knife-edge/sim";
import type { Policy } from "./policy.js";

export interface RunSummary {
  policy: string;
  seed: number;
  outcome: "won" | "lost" | "timeout";
  wavesCleared: number;
  ticks: number;
  /** Minutes of play at 1x speed. */
  minutesAt1x: number;
  gold: number;
  lives: number;
  kills: number;
  leaks: number;
  goldEarned: number;
  goldSpent: number;
  interestEarned: number;
  earlyBonusEarned: number;
  towers: number;
  finalHash: number;
  /** Gold banked at the start of each wave (the budget curve). */
  goldAtWaveStart: number[];
  replay: Replay;
}

/**
 * Drive one run with a policy. The policy gets a separate RNG seeded from (seed, policy name)
 * so bot randomness never touches the world stream. Every command is recorded so the run is
 * a replay a human can watch (constraint C9).
 */
export function runPolicy(data: GameData, policy: Policy, seed: number, maxTicks = 400_000): RunSummary {
  const s = createState(data, seed);
  let h = 0;
  for (let i = 0; i < policy.name.length; i++) h = (h * 31 + policy.name.charCodeAt(i)) >>> 0;
  const rng = seedRng((seed ^ h) >>> 0);
  const commands: TimedCommand[] = [];
  const goldAtWaveStart: number[] = [];
  while (s.outcome === "playing" && s.tick < maxTicks) {
    const cmds = policy.decide(data, s, rng);
    for (const cmd of cmds) commands.push({ tick: s.tick, cmd });
    const ev = step(data, s, cmds);
    for (const e of ev) if (e.kind === "waveStart") goldAtWaveStart.push(s.gold);
  }
  return {
    policy: policy.name,
    seed,
    outcome: s.outcome === "playing" ? "timeout" : s.outcome,
    wavesCleared: s.stats.wavesCleared,
    ticks: s.tick,
    minutesAt1x: Math.round((s.tick / data.economy.tickRate / 60) * 10) / 10,
    gold: s.gold,
    lives: s.lives,
    kills: s.stats.kills,
    leaks: s.stats.leaks,
    goldEarned: s.stats.goldEarned,
    goldSpent: s.stats.goldSpent,
    interestEarned: s.stats.interestEarned,
    earlyBonusEarned: s.stats.earlyBonusEarned,
    towers: s.towers.length,
    finalHash: hashState(s),
    goldAtWaveStart,
    replay: { dataVersion: data.version, seed, commands },
  };
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] as number;
}

export interface BatchReport {
  policy: string;
  runs: number;
  winRate: number;
  wavesP5: number;
  wavesP50: number;
  wavesP95: number;
  minutesP50: number;
  meanInterestShare: number;
}

export function summarize(results: RunSummary[]): BatchReport {
  const waves = results.map((r) => r.wavesCleared).sort((a, b) => a - b);
  const minutes = results.map((r) => r.minutesAt1x).sort((a, b) => a - b);
  const wins = results.filter((r) => r.outcome === "won").length;
  const interestShare = results.map((r) => (r.goldEarned > 0 ? r.interestEarned / r.goldEarned : 0));
  return {
    policy: results[0]?.policy ?? "?",
    runs: results.length,
    winRate: results.length ? wins / results.length : 0,
    wavesP5: percentile(waves, 5),
    wavesP50: percentile(waves, 50),
    wavesP95: percentile(waves, 95),
    minutesP50: percentile(minutes, 50),
    meanInterestShare: interestShare.reduce((a, b) => a + b, 0) / Math.max(1, interestShare.length),
  };
}
