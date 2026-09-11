import { expect, it } from "vitest";
import {
  canBuild, canonical, createState, deriveData, pathFromEntry, rawData, runReplay,
  seedRng, step, type GameData, type State,
} from "@knife-edge/sim";
import { loadData } from "../../../packages/sim/test/helpers.js";
import { engineerPolicy, evaluateEngineerOffers, planCoating } from "../src/policies/engineer.js";
import { runPolicy } from "../src/runner.js";

function fixture(): GameData {
  const raw = rawData(loadData());
  raw.version = "engineer-test";
  raw.effectRules = {
    minSlowBp: 2500, poisonStackCap: 5, confusionIntervalTicks: 20,
    confusionRadiusFp: 2048, wetLightningBp: 15000, wetSlowBp: 7500,
    oilHitBp: 17500, oilBurnBp: 5000, oilBurnTicks: 60,
  };
  for (const [id, coating, cost] of [["sprayer", "wet", 36], ["solvent", "oil", 40]] as const) {
    if (raw.towers.some((t) => t.id === id)) continue;
    raw.towers.push({ ...raw.towers[0]!, id, coating, cost, coatingTicks: 100,
      damage: 1, damageType: "support", cooldownTicks: 10, rangeCells: 4,
      targets: 1, slowTicks: 0, slowBp: 10000, auraBp: 0 });
  }
  raw.relics = [
    { id: "off-lane", name: "Off lane", description: "Tiny thermal boost", damageType: "thermal", damageBp: 10100, slowDamageBp: 10000, interestBp: 0 },
    { id: "chain-reaction", name: "Chain", description: "Death burst", damageType: "all", damageBp: 10000, slowDamageBp: 10000, interestBp: 0, deathBurstBp: 9000, deathBurstRadiusFp: 2048 },
    { id: "poison", name: "Poison", description: "Poison", damageType: "all", damageBp: 10000, slowDamageBp: 10000, interestBp: 0, poisonDamageBp: 18000, poisonTicks: 100 },
  ];
  Object.assign(raw.relicRules, { offerCount: 1, firstOfferWave: 1, everyWaves: 1,
    rerollBaseGold: 12, rerollGrowthBp: 15000, maxRerolls: 2 });
  return deriveData(raw);
}

function placeNearPath(data: GameData, s: State, type: string): void {
  const path = pathFromEntry(s.grid, s.dist);
  const distance2 = (a: number, b: number) => ((a % s.grid.width) - (b % s.grid.width)) ** 2 +
    (Math.floor(a / s.grid.width) - Math.floor(b / s.grid.width)) ** 2;
  const candidates = Array.from({ length: s.blocked.length }, (_, cell) => ({
    cell, coverage: path.filter((p) => distance2(cell, p) <= 9).length,
  })).sort((a, b) => b.coverage - a.coverage || a.cell - b.cell);
  const cell = candidates.find((c) => canBuild(s, c.cell).ok)!.cell;
  expect(step(data, s, [{ kind: "build", cell, type }]).some((e) => e.kind === "rejected")).toBe(false);
}

it("coaters require existing matching investment and legal firing-lane overlap", () => {
  const data = fixture();
  const s = createState(data, 7);
  s.gold = 10000;
  expect(planCoating(data, s)).toBeUndefined();
  placeNearPath(data, s, "bolt");
  placeNearPath(data, s, "bolt");
  expect(planCoating(data, s)).toBeUndefined();
  placeNearPath(data, s, "arc");
  placeNearPath(data, s, "arc");
  const before = canonical(s);
  const plan = planCoating(data, s)!;
  expect(canonical(s)).toBe(before);
  expect(plan.command.kind === "build" && plan.command.type).toBe("sprayer");
  expect(plan.value).toBeGreaterThan(0);
  expect(plan.matchingInvestment).toBeGreaterThanOrEqual(plan.cost * 2);
  expect(step(data, s, [plan.command]).some((e) => e.kind === "rejected")).toBe(false);
});

it("rerolls pay actual gold, retain a defense budget, and never inspect the next seeded offer", () => {
  const data = fixture();
  const s = createState(data, 7);
  s.wave = 2;
  s.relicOffers = ["off-lane"];
  s.gold = 200;
  const expected = engineerPolicy().decide(data, s, seedRng(1));
  expect(expected).toEqual([{ kind: "reroll" }]);
  const changed = deriveData({ ...rawData(data), relicRules: { ...data.relicRules, offerSeedOffset: 999 } });
  expect(engineerPolicy().decide(changed, s, seedRng(1))).toEqual(expected);
  const before = s.gold;
  const events = step(data, s, expected);
  expect(events.some((e) => e.kind === "rejected")).toBe(false);
  expect(s.gold).toBe(before - 12);
  expect(s.offerRerolls).toBe(1);
  s.tick = 20;
  s.gold = 11;
  s.relicOffers = ["off-lane"];
  expect(engineerPolicy().decide(data, s, seedRng(1))).toEqual([{ kind: "pickRelic", id: "off-lane" }]);
});

it("no-reroll control accepts the offer; fishing stops when the desired burst is offered", () => {
  const data = fixture();
  const s = createState(data, 7);
  s.wave = 2;
  s.gold = 200;
  s.relicOffers = ["off-lane"];
  expect(engineerPolicy("engineer-no-reroll").decide(data, s, seedRng(1))).toEqual([{ kind: "pickRelic", id: "off-lane" }]);
  expect(engineerPolicy("engineer-fish").decide(data, s, seedRng(1))).toEqual([{ kind: "reroll" }]);
  s.relicOffers = ["chain-reaction"];
  expect(engineerPolicy("engineer-fish").decide(data, s, seedRng(1))).toEqual([{ kind: "pickRelic", id: "chain-reaction" }]);
  s.relicOffers = ["off-lane", "poison"];
  expect(evaluateEngineerOffers(data, s)[0]!.id).toBe("poison");
});

it("engineer policy commands remain deterministic and replayable", () => {
  const raw = rawData(fixture());
  raw.economy.maxWaves = 3;
  const data = deriveData(raw);
  for (const name of ["engineer", "engineer-no-reroll", "engineer-fish", "engineer-rookie", "engineer-prepared"]) {
    const row = runPolicy(data, engineerPolicy(name), 7, 4000);
    const rejects: unknown[] = [];
    const replay = runReplay(data, row.replay, 4000, (_, events) => rejects.push(...events.filter((e) => e.kind === "rejected")));
    expect(replay.finalHash).toBe(row.finalHash);
    expect(runPolicy(data, engineerPolicy(name), 7, 4000).finalHash).toBe(row.finalHash);
    expect(rejects).toEqual([]);
  }
});

it("prepared engineer reserves only a real fee before a known safe drop wave", () => {
  const raw = rawData(fixture());
  raw.towers = raw.towers.filter((t) => t.id === "bolt").map((t) => ({ ...t, damage: t.damage * 1000, levels: 1 }));
  raw.relicRules.firstOfferWave = 2;
  const data = deriveData(raw);
  const s = createState(data, 7);
  s.gold = 1000;
  placeNearPath(data, s, "bolt");
  placeNearPath(data, s, "bolt");
  s.tick = 20;
  s.wave = 1;
  s.gold = data.towers[0]!.cost + data.relicRules.rerollBaseGold! - 1;
  const before = canonical(s);
  const normal = engineerPolicy().decide(data, s, seedRng(1));
  const prepared = engineerPolicy("engineer-prepared").decide(data, s, seedRng(1));
  expect(canonical(s)).toBe(before);
  expect(normal.some((c) => c.kind === "build")).toBe(true);
  expect(prepared.some((c) => c.kind === "build" || c.kind === "upgrade")).toBe(false);
  expect(prepared).toContainEqual({ kind: "callWave" });
  const changed = deriveData({ ...rawData(data), relicRules: { ...data.relicRules, offerSeedOffset: 9876 } });
  expect(engineerPolicy("engineer-prepared").decide(changed, s, seedRng(1))).toEqual(prepared);
  s.relicOffers = ["off-lane"];
  s.gold = data.relicRules.rerollBaseGold! + Math.ceil(data.towers[0]!.cost / 2);
  expect(engineerPolicy().decide(data, s, seedRng(1))).toEqual([{ kind: "pickRelic", id: "off-lane" }]);
  const paid = engineerPolicy("engineer-prepared").decide(data, s, seedRng(1));
  expect(paid).toEqual([{ kind: "reroll" }]);
  expect(step(data, s, paid).some((e) => e.kind === "rejected")).toBe(false);
  expect(s.gold).toBe(Math.ceil(data.towers[0]!.cost / 2));
  const unsafe = createState(data, 7);
  unsafe.tick = 20;
  unsafe.wave = 1;
  unsafe.gold = data.towers[0]!.cost + data.relicRules.rerollBaseGold! - 1;
  expect(engineerPolicy("engineer-prepared").decide(data, unsafe, seedRng(1))).toEqual(engineerPolicy().decide(data, unsafe, seedRng(1)));
});
