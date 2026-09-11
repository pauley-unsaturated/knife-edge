import { expect, it } from "vitest";
import { deriveData, rawData, runReplay } from "@knife-edge/sim";
import { loadData } from "../../../packages/sim/test/helpers.js";
import { makePolicy } from "../src/policies/index.js";
import { runPolicy } from "../src/runner.js";

it("execution profiles obey reaction cadence and action caps, with reproducible misses", () => {
  const data = loadData();
  for (const name of ["deliberate", "hesitant", "rushed4x"]) {
    const profile = data.playerProfiles![name]!;
    const run = runPolicy(data, makePolicy(`player-${name}`), 7, 4000);
    const counts = new Map<number, number>();
    for (const c of run.replay.commands) {
      expect(c.tick % profile.decisionTicks).toBe(0);
      counts.set(c.tick, (counts.get(c.tick) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(
      profile.maxActions,
    );
    expect(
      runPolicy(data, makePolicy(`player-${name}`), 7, 4000).finalHash,
    ).toBe(run.finalHash);
    expect(runReplay(data, run.replay, 4000).finalHash).toBe(run.finalHash);
  }
});

it("100% missed opportunities results in no commands", () => {
  const raw = rawData(loadData());
  raw.playerProfiles = {
    hesitant: { decisionTicks: 20, maxActions: 1, missChanceBp: 10000 },
  };
  const run = runPolicy(
    deriveData(raw),
    makePolicy("player-hesitant"),
    7,
    2000,
  );
  expect(run.replay.commands).toEqual([]);
  expect(run.outcome).toBe("lost");
});
