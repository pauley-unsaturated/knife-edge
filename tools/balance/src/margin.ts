import {
  cloneState,
  createState,
  deriveData,
  hashState,
  makeReplay,
  rawData,
  seedRng,
  step,
  type GameData,
  type Replay,
  type TimedCommand,
} from "@knife-edge/sim";
import { greedyPolicy } from "./policies/greedy.js";

export interface DefenseProbe {
  cost: number | null;
  replay: Replay | null;
  attempts: number;
}

/**
 * Cheapest zero-leak prefix found along one greedy build order on this exact board.
 * This is an UPPER bound on the optimum, so the reported margin is a LOWER bound.
 * No interest, kills or early-call gold can pay for the defense during the probe.
 */
export function probeDefense(
  data: GameData,
  seed: number,
  wave: number,
  spendLimit: number,
): DefenseProbe {
  const raw = rawData(data);
  const probeData = deriveData({
    ...raw,
    version: `${raw.version}/probe${wave}`,
    economy: {
      ...raw.economy,
      startGold: 100000,
      waveIntervalSec: 100000,
      maxWaves: wave,
      earlyCallBonusPerSec: 0,
      interestBp: 0,
      bountyBase: 0,
      bountyPerWave: 0,
    },
    relicRules: { ...raw.relicRules, everyWaves: 0 },
  });
  const layout = createState(probeData, seed);
  layout.wave = wave - 1;
  const policy = greedyPolicy({ checkpoint: 1, callEarly: false });
  const rng = seedRng(seed);
  const commands: TimedCommand[] = [];
  for (let attempt = 1; attempt <= 300; attempt++) {
    const buy = policy
      .decide(probeData, layout, rng)
      .find((c) => c.kind === "build" || c.kind === "upgrade");
    if (!buy) return { cost: null, replay: null, attempts: attempt };
    commands.push({ tick: layout.tick, cmd: buy });
    step(probeData, layout, [buy]);
    if (layout.stats.goldSpent > spendLimit)
      return { cost: null, replay: null, attempts: attempt };
    const trial = cloneState(layout);
    const call: TimedCommand = { tick: trial.tick, cmd: { kind: "callWave" } };
    step(probeData, trial, [call.cmd]);
    const end = trial.tick + 20000;
    while (trial.inWave && !trial.stats.leaks && trial.tick < end)
      step(probeData, trial);
    if (!trial.inWave && !trial.stats.leaks) {
      const replay = {
        ...makeReplay(probeData, trial, [...commands, call]),
        initialWave: wave,
      };
      return { cost: layout.stats.goldSpent, replay, attempts: attempt };
    }
  }
  return { cost: null, replay: null, attempts: 300 };
}
