import { expect, it } from "vitest";
import { deriveData, rawData } from "@knife-edge/sim";
import { loadData } from "../../../packages/sim/test/helpers.js";
import { assertEngineRun, neutralEnginePatches, runEngineValidation, summarizeEngineValidation } from "../src/engine-validation.js";
import { makePolicy } from "../src/policies/index.js";

function fixture() {
  const raw = rawData(loadData());
  raw.version = "frozen-validation-unit-test";
  raw.economy.maxWaves = 2;
  raw.composer.budgetBase = 3;
  raw.composer.growthBp = 10000;
  delete raw.composer.openingBudgets;
  raw.relicRules.everyWaves = 1;
  raw.relicRules.firstOfferWave = 1;
  raw.towers = raw.towers.map((t) => ({ ...t, damage: t.damage * 100 }));
  return deriveData(raw);
}

it("frozen validation traces exact early-wave coverage and independently checks replays", () => {
  const data = fixture();
  const row = runEngineValidation(data, makePolicy("greedy-relics"), 7, 10000);
  expect(() => assertEngineRun(row)).not.toThrow();
  expect(row.outcome).toBe("won");
  expect(row.replayVerified).toBe(true);
  expect(row.earlyWaves).toEqual([
    { wave: 1, reached: true, completed: true, leaks: 0, core: data.economy.lives },
    { wave: 2, reached: true, completed: true, leaks: 0, core: data.economy.lives },
    { wave: 3, reached: false, completed: false, leaks: null, core: null },
  ]);
  const summary = summarizeEngineValidation([row]);
  expect(summary.earlyWaves[2]).toEqual({ wave: 3, reached: 0, completed: 0, leakRuns: 0, leaks: 0 });
  expect(summary.winRate).toBe(1);
  expect(row.patchDecisions).toHaveLength(1);
  expect(() => assertEngineRun({ ...row, replayVerified: false })).toThrow("verification");
  expect(() => assertEngineRun({ ...row, outcome: "timeout" })).toThrow("terminal");
});

it("neutral controls preserve costs, weights, and input data while disabling patch payoffs", () => {
  const raw = rawData(fixture());
  raw.relics[0]!.sacrificeLives = 3;
  raw.relics[0]!.offerWeight = 2;
  const original = JSON.stringify(raw);
  const neutral = neutralEnginePatches(raw);
  expect(JSON.stringify(raw)).toBe(original);
  expect(neutral.relicRules).toEqual(raw.relicRules);
  expect(neutral.economy).toEqual(raw.economy);
  expect(neutral.relics[0]!.sacrificeLives).toBe(3);
  expect(neutral.relics[0]!.offerWeight).toBe(2);
  expect(neutral.relics.every((r) => r.damageBp === 10000 && r.slowDamageBp === 10000 && r.interestBp === 0 && r.deathBurstBp === 0 && r.poisonDamageBp === 0 && r.confusionDamageBp === 0 && r.hitSlowTicks === 0)).toBe(true);
  expect(() => deriveData(neutral)).not.toThrow();
});

it("records invalid policy inputs as evidence and rejects them at the strict gate", () => {
  const row = runEngineValidation(fixture(), {
    name: "invalid-command-test", decide: (_, s) => s.tick === 0 ? [{ kind: "build", type: "missing", cell: 1 }] : [],
  }, 7, 10000);
  expect(row.replayVerified).toBe(true);
  expect(row.rejectedCommands).toHaveLength(1);
  expect(() => assertEngineRun(row)).toThrow("rejected commands");
});
