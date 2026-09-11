import { expect, it } from "vitest";
import { deriveData, rawData, rollOffers, runReplay, validateReplay } from "@knife-edge/sim";
import { loadData } from "../../../packages/sim/test/helpers.js";
import { analyzeExploration, inspectReplay } from "../src/exploration.js";
import type { Policy } from "../src/policy.js";
import { makePolicy } from "../src/policies/index.js";
import { runPolicy } from "../src/runner.js";

function fixture() {
  const raw = rawData(loadData());
  raw.version = "exploration-test";
  raw.economy.maxWaves = 5;
  raw.economy.waveIntervalSec = 1;
  raw.composer.budgetBase = 3;
  raw.composer.growthBp = 10000;
  raw.composer.hpGrowthBp = 10000;
  delete raw.composer.openingBudgets;
  raw.relicRules.everyWaves = 1;
  raw.relicRules.firstOfferWave = 1;
  raw.relicRules.offerCount = 3;
  raw.relics = raw.relics.slice(0, 3).map((r, i) => ({
    ...r,
    damageBp: 10000 + 1000 * i,
    sacrificeLives: 0,
  }));
  for (const tower of raw.towers) tower.damage *= 100;
  return deriveData(raw);
}

it("exports replay-verified fixed-schedule witnesses and wave decision telemetry", () => {
  const data = fixture();
  const run = runPolicy(data, makePolicy("greedy-relics"), 7, 10000);
  expect(run.outcome).toBe("won");
  const original = JSON.stringify(run.replay);
  const report = analyzeExploration(data, run.replay, { maxTicks: 10000 });
  expect(JSON.stringify(run.replay)).toBe(original);
  expect(report.verification).toEqual({
    expectedHash: run.finalHash,
    matchesExpectedHash: true,
    matchesIndependentReplay: true,
  });
  expect(report.waves).toHaveLength(5);
  expect(report.patchDecisions).toHaveLength(4);
  expect(report.choiceBranches).toHaveLength(3);
  expect(report.frozenDefense.map((f) => f.checkpointTick !== null)).toEqual([true, false, false]);
  for (const wave of report.waves) {
    expect(wave.completed).toBe(true);
    expect(Object.values(wave.spendByType).reduce((sum, n) => sum + n, 0)).toBe(wave.goldSpent);
    if (wave.wave < 5) {
      expect(wave.patchOffers).toHaveLength(3);
      expect(wave.patchChoices).toHaveLength(1);
    }
  }
  for (const branch of report.choiceBranches) {
    expect(branch.alternatives).toHaveLength(3);
    expect(branch.alternatives.every((a) => !a.pickRejected)).toBe(true);
    expect(branch.alternatives.find((a) => a.wasOriginal)!.result.finalHash).toBe(run.finalHash);
  }
  const witnesses = [
    report.original,
    report.noPatches,
    ...report.frozenDefense.flatMap((f) => f.result ? [f.result] : []),
    ...report.choiceBranches.flatMap((b) => b.alternatives.map((a) => a.result)),
  ];
  for (const witness of witnesses) {
    expect(witness.replayVerified).toBe(true);
    expect(validateReplay(witness.replay)).toBe(witness.replay);
    expect(runReplay(data, witness.replay, 10000).finalHash).toBe(witness.finalHash);
  }
  expect(report.noPatches.replay.commands.some((c) => c.cmd.kind === "pickRelic")).toBe(false);
  const freeze = report.frozenDefense[0]!;
  expect(freeze.result!.replay.commands.every((c) => c.tick < freeze.checkpointTick!)).toBe(true);
});

it("flags an incorrect source hash without hiding deterministic replay results", () => {
  const data = fixture();
  const run = runPolicy(data, makePolicy("greedy-relics"), 7, 10000);
  const report = analyzeExploration(data, { ...run.replay, finalHash: (run.finalHash ^ 1) >>> 0 }, {
    maxTicks: 10000,
    freezeWaves: [],
    choiceLimit: 0,
  });
  expect(report.verification.matchesExpectedHash).toBe(false);
  expect(report.verification.matchesIndependentReplay).toBe(true);
  expect(() => analyzeExploration(data, run.replay, { maxTicks: 1 })).toThrow("horizon");
});

it("only branches to sacrifices the player could afford at the actual decision", () => {
  const raw = rawData(fixture());
  raw.relics[0]!.sacrificeLives = raw.economy.lives;
  const data = deriveData(raw);
  const run = runPolicy(data, makePolicy("greedy-relics"), 7, 10000);
  const report = analyzeExploration(data, run.replay, {
    maxTicks: 10000,
    freezeWaves: [],
    choiceLimit: 1,
  });
  const branch = report.choiceBranches[0]!;
  expect(branch.decision.offers).toContain(raw.relics[0]!.id);
  expect(branch.decision.affordableOffers).not.toContain(raw.relics[0]!.id);
  expect(branch.alternatives).toHaveLength(2);
});

it("ordered same-tick reroll and pick report the paid bank and actual rerolled offers", () => {
  const raw = rawData(fixture());
  Object.assign(raw.relicRules, { rerollBaseGold: 1, rerollGrowthBp: 15000, maxRerolls: 2 });
  const data = deriveData(raw);
  const base = makePolicy("greedy-relics");
  let expected: { bank: number; offers: string[]; chosen: string } | undefined;
  const policy: Policy = {
    name: "ordered-reroll-test",
    decide(d, s, rng) {
      const commands = base.decide(d, s, rng);
      if (!expected && commands.some((c) => c.kind === "pickRelic") && s.gold >= 1) {
        const offers = rollOffers(d, s.seed, s.wave, (s.offerRerolls ?? 0) + 1);
        expected = { bank: s.gold - 1, offers, chosen: offers[0]! };
        return [{ kind: "reroll" }, { kind: "pickRelic", id: offers[0]! }];
      }
      return commands;
    },
  };
  const row = runPolicy(data, policy, 7, 10000);
  expect(expected).toBeDefined();
  const inspection = inspectReplay(data, row.replay, 10000);
  expect(inspection.witness.finalHash).toBe(row.finalHash);
  const decision = inspection.decisions.find((d) => row.replay.commands[d.commandIndex - 1]?.cmd.kind === "reroll")!;
  expect(decision.bank).toBe(expected!.bank);
  expect(decision.offers).toEqual(expected!.offers);
  expect(decision.chosen).toBe(expected!.chosen);
  expect(inspection.witness.rejections).toEqual([]);
});
