import { expect, it } from "vitest";
import { runReplay } from "@knife-edge/sim";
import { loadData } from "../../../packages/sim/test/helpers.js";
import { apprenticePolicy, deliberateEngineerPolicy } from "../src/policies/learning.js";
import { runPolicy } from "../src/runner.js";

it("new learning profiles replay deterministically without changing historical policy names", () => {
  const data = loadData();
  for (const factory of [apprenticePolicy, deliberateEngineerPolicy]) {
    const a = runPolicy(data,factory(),7,2000);
    const b = runPolicy(data,factory(),7,2000);
    expect(a.finalHash).toBe(b.finalHash);
    expect(runReplay(data,a.replay,2000).finalHash).toBe(a.finalHash);
    expect(a.policy).toMatch(/^engineer-(apprentice|deliberate)$/);
  }
});

it("deliberate execution uses only 80-tick decision boundaries", () => {
  const run = runPolicy(loadData(),deliberateEngineerPolicy(),7,2000);
  expect(run.replay.commands.length).toBeGreaterThan(0);
  expect(run.replay.commands.every(c=>c.tick%80===0)).toBe(true);
});
