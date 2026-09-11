import { expect, it } from "vitest";
import { bpRateTick, deriveData, rawData } from "../src/index.js";
import { loadData } from "./helpers.js";

it("phase-safe rate ticks equal the old formula throughout its exact range", () => {
  for (const rate of [0, 1, 4999, 5000, 9999, 10000, 12345678, 987654321]) {
    for (const tick of [0, 1, 17, 9998, 9999, 10000, 19999, 399999, 400000]) {
      expect(bpRateTick(rate, tick)).toBe(Math.floor((tick + 1) * rate / 10000) - Math.floor(tick * rate / 10000));
    }
  }
});

it("large rate ticks match an exact BigInt oracle even when tick times rate overflows", () => {
  for (const rate of [7629400000001, 254313333333, Number.MAX_SAFE_INTEGER]) {
    for (const tick of [0, 1, 9999, 10000, 399999, 400000, 1000000000]) {
      const exact = (BigInt(tick + 1) * BigInt(rate)) / 10000n - (BigInt(tick) * BigInt(rate)) / 10000n;
      expect(bpRateTick(rate, tick)).toBe(Number(exact));
      expect(Number.isSafeInteger(bpRateTick(rate, tick))).toBe(true);
    }
  }
});

function statusRules() {
  const raw = rawData(loadData());
  raw.economy.maxWaves = 60;
  raw.composer.budgetBase = 1;
  raw.composer.growthBp = 10000;
  raw.composer.hpGrowthBp = 10000;
  delete raw.composer.openingBudgets;
  raw.relicRules = { ...raw.relicRules, firstOfferWave: 1, everyWaves: 1, offerCount: 1, responseBp: 0, stackBonusBp: 1000 };
  for (const t of raw.towers) Object.assign(t, { damage: 10000, levels: 10, damageGrowthBp: 25000, auraBp: 10000, adjacencyBonusBp: 10000 });
  for (const row of Object.values(raw.damageMatrix)) for (const tag of Object.keys(row)) row[tag as keyof typeof row] = 10000;
  raw.relics = [{ id: "numeric-dose", name: "Dose", description: "Numeric test", damageType: "all", damageBp: 10000,
    slowDamageBp: 10000, interestBp: 0, poisonDamageBp: 20000, poisonTicks: 2 }];
  raw.effectRules = { minSlowBp: 2500, poisonStackCap: 20, confusionIntervalTicks: 20, confusionRadiusFp: 2048,
    wetLightningBp: 30000, wetSlowBp: 7500, oilHitBp: 30000, oilBurnBp: 20000, oilBurnTicks: 2 };
  return raw;
}

it("validation rejects unsafe post-coating additive poison products and dose caps", () => {
  const raw = statusRules();
  expect(() => deriveData(raw)).toThrow("safe fixed-point bounds (status/coating)");
});

it("duplicate-copy kickers participate in the bound, not just raw per-copy values", () => {
  const raw = statusRules();
  raw.effectRules!.poisonStackCap = 1;
  raw.effectRules!.wetLightningBp = raw.effectRules!.oilHitBp = 10000;
  raw.relics[0]!.poisonTicks = 100;
  raw.relicRules.stackBonusBp = 0;
  expect(() => deriveData(raw)).not.toThrow();
  raw.relicRules.stackBonusBp = 1000;
  expect(() => deriveData(raw)).toThrow("safe fixed-point bounds (status/coating)");
});

it("the dose-cap check includes the addition evaluated before clipping", () => {
  const raw = statusRules();
  raw.relicRules.stackBonusBp = 0;
  raw.effectRules!.wetLightningBp = raw.effectRules!.oilHitBp = 10000;
  raw.relics[0]!.poisonTicks = 2;
  raw.effectRules!.poisonStackCap = 1;
  expect(() => deriveData(raw)).not.toThrow();
  raw.effectRules!.poisonStackCap = 20;
  expect(() => deriveData(raw)).toThrow("safe fixed-point bounds (status/coating)");
});

it("coating multipliers are included before bounding poison's hit-based dose", () => {
  const raw = statusRules();
  raw.relicRules.stackBonusBp = 500;
  raw.effectRules!.poisonStackCap = 1;
  raw.relics[0]!.poisonTicks = 100;
  raw.effectRules!.wetLightningBp = raw.effectRules!.oilHitBp = 10000;
  expect(() => deriveData(raw)).not.toThrow();
  raw.effectRules!.oilHitBp = 30000;
  expect(() => deriveData(raw)).toThrow("safe fixed-point bounds (status/coating)");
});

it("large valid rates remain accepted now that ticking avoids elapsed-tick products", () => {
  const raw = statusRules();
  raw.economy.maxWaves = 18;
  raw.relicRules.everyWaves = 3;
  raw.relicRules.firstOfferWave = 2;
  for (const t of raw.towers) Object.assign(t, { auraBp: 0, adjacencyBonusBp: 0 });
  expect(() => deriveData(raw)).not.toThrow();
});
