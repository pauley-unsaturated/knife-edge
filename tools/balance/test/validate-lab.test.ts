import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { deriveData, type RawGameData } from "@knife-edge/sim";
import { checkLabBands, checkLabResources, checkLabRules, labSampleCount } from "../src/validate-lab.js";
import type { CheckedEngineRun, summarizeEngineValidation } from "../src/engine-validation.js";

const raw = () => JSON.parse(readFileSync("data/game.json", "utf8")) as RawGameData;
const report = (winRate: number, wavesP50 = 12) => ({ winRate, wavesP50, policy: "test" }) as ReturnType<typeof summarizeEngineValidation>;

it("lab gate bounds work and imports without executing a sweep", () => {
  expect(labSampleCount()).toBe(8);
  expect(labSampleCount("40")).toBe(40);
  for (const n of ["0", "7", "201", "NaN", "8.5"]) expect(() => labSampleCount(n)).toThrow();
});

it("all shipped labs preserve geometric late pressure and ordered affordability", () => {
  for (const path of ["data/game.json", "data/compound.json", "data/pact.json"]) {
    const config = JSON.parse(readFileSync(path, "utf8")) as RawGameData;
    expect(checkLabRules(config).pressureProxyRatio).toBeGreaterThan(1.5);
  }
  const flat = raw(); flat.composer.hpGrowthBp = 10000;
  expect(() => checkLabRules(flat)).toThrow("geometrically");
  const reversed = raw(); reversed.difficulties.easy.defenseCostBp = reversed.difficulties.hard.defenseCostBp;
  expect(() => checkLabRules(reversed)).toThrow("prices");
});

it("resource gate rejects leaked openings, overdrafts, fake income and invalid replay inputs", () => {
  const data = deriveData(raw());
  const row = { policy: "test", seed: 1, outcome: "won", replayVerified: true, rejectedCommands: [],
    gold: 20, goldSpent: 100, goldEarned: 0, lives: 12, rerollFees: 25,
    earlyWaves: [{ wave: 1, reached: true, completed: true, leaks: 0, core: 12 }], waves: [{ bank: 20 }],
  } as unknown as CheckedEngineRun;
  expect(() => checkLabResources(data, row)).not.toThrow();
  expect(() => checkLabResources(data, { ...row, outcome: "lost", lives: -1 })).not.toThrow();
  expect(() => checkLabResources(data, { ...row, outcome: "won", lives: -1 })).toThrow("terminal outcome");
  expect(() => checkLabResources(data, { ...row, gold: 30 }, 10)).not.toThrow();
  expect(() => checkLabResources(data, { ...row, gold: 30 })).toThrow("cash conservation");
  expect(() => checkLabResources(data, { ...row, gold: -1 })).toThrow("nonnegative");
  expect(() => checkLabResources(data, { ...row, replayVerified: false })).toThrow("verification");
  expect(() => checkLabResources(data, { ...row, earlyWaves: [{ wave: 1, reached: true, completed: true, leaks: 1, core: 11 }] })).toThrow("first wave");
});

it("broad bands catch collapsed difficulty and neutral-engine bypass without claiming fun", () => {
  expect(() => checkLabBands(report(0.75), report(0.5), report(0.25), [report(0), report(0.125)])).not.toThrow();
  expect(() => checkLabBands(report(0.25), report(0.5), report(0.25), [])).toThrow("Easy");
  expect(() => checkLabBands(report(0.75), report(0), report(0.25), [])).toThrow("Medium");
  expect(() => checkLabBands(report(1), report(1), report(1), [])).toThrow("Hard");
  expect(() => checkLabBands(report(1), report(0.5), report(0.25), [report(0.5)])).toThrow("too strong");
  expect(() => checkLabBands(report(1), report(0.5), report(0.25), [report(0, 17)])).toThrow("late wall");
});
