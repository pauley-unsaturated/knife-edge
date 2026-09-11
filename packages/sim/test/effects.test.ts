import { expect, it } from "vitest";
import { createState, deriveData, nextStep, rawData, step, type Enemy, type RawRelic } from "../src/index.js";
import { applyOnHitEffects, tickEffects } from "../src/effects.js";
import { loadData } from "./helpers.js";

function fixture(effects: Partial<RawRelic> = {}) {
  const raw = rawData(loadData());
  raw.grid.obstacles = 0;
  raw.effectRules = { minSlowBp: 2500, confusionIntervalTicks: 4, confusionRadiusFp: 2048, poisonStackCap: 8,
    wetLightningBp: 15000, wetSlowBp: 7500, oilHitBp: 17500, oilBurnBp: 5000, oilBurnTicks: 60 };
  raw.relics.push({ id: "status-test", name: "Status", description: "Test", damageType: "all", damageBp: 10000, slowDamageBp: 10000, interestBp: 0, ...effects });
  const data = deriveData(raw), s = createState(data, 7);
  s.tick = 10;
  s.wave = 1;
  s.inWave = true;
  s.relics = ["status-test"];
  const make = (id: number, offset: number, hp = 100): Enemy => {
    const cell = s.grid.entry + offset;
    return { id, type: "grunt", cell, next: nextStep(s.grid, s.dist, cell), hp, maxHp: hp, progress: 0, slowBp: 10000, slowUntil: 0, revealedUntil: 0 };
  };
  return { data, s, make };
}

it("poison uses integer fixed-point DPS without a hidden one-damage-per-tick floor", () => {
  const { data, s, make } = fixture({ poisonDamageBp: 5000, poisonTicks: 10 });
  const e = make(1, 2);
  s.enemies = [e];
  applyOnHitEffects(data, s, e, 10); // 5 damage over 10 ticks = 0.5 HP/tick.
  expect(e.poisonDpt).toBe(5000);
  for (s.tick = 10; s.tick < 20; s.tick++) {
    tickEffects(data, s);
    expect(Number.isInteger(e.hp)).toBe(true);
  }
  expect(e.hp).toBe(95);
  tickEffects(data, s);
  expect(e.hp).toBe(95);
  expect(e.poisonDpt).toBeUndefined();
  expect(e.poisonUntil).toBeUndefined();
});

it("poison hit stacks are bounded and weaker refresh never erases stronger potency", () => {
  const { data, s, make } = fixture({ poisonDamageBp: 5000, poisonTicks: 10 });
  const e = make(1, 2);
  applyOnHitEffects(data, s, e, 20);
  s.tick++;
  for (let n = 0; n < 20; n++) applyOnHitEffects(data, s, e, 4);
  expect(e.poisonDpt).toBe(16000); // 8 × the weaker incoming dose ceiling.
  expect(e.poisonStacks).toBe(8);
  expect(e.poisonUntil).toBe(21);
  for (let n = 0; n < 20; n++) applyOnHitEffects(data, s, e, 20);
  expect(e.poisonDpt).toBe(80000);
  expect(e.poisonStacks).toBe(8);
  applyOnHitEffects(data, s, e, 1);
  expect(e.poisonDpt).toBe(80000);
  s.tick = 21;
  applyOnHitEffects(data, s, e, 4);
  expect(e.poisonDpt).toBe(2000);
  expect(e.poisonStacks).toBe(1);
});

it("multiple poison copies increase each incoming dose's potency", () => {
  const { data, s, make } = fixture({ poisonDamageBp: 5000, poisonTicks: 10 });
  const e = make(1, 2);
  applyOnHitEffects(data, s, e, 10);
  const single = e.poisonDpt!;
  s.relics.push("status-test");
  applyOnHitEffects(data, s, e, 10);
  expect(e.poisonDpt).toBeGreaterThan(single);
});

it("stacked rare slows clamp to the floor and combine with Frost by strongest effect", () => {
  const { data, s, make } = fixture({ hitSlowBp: 5000, hitSlowTicks: 10 });
  const e = make(1, 2);
  s.relics.push("status-test", "status-test");
  applyOnHitEffects(data, s, e, 5);
  expect(e.slowBp).toBe(2500);
  expect(e.slowUntil).toBeGreaterThanOrEqual(40);
  const expiry = e.slowUntil;
  e.slowBp = 2000; // Already stronger native slow: no second multiplication.
  applyOnHitEffects(data, s, e, 5);
  expect(e.slowBp).toBe(2000);
  s.tick = expiry;
  s.relics = ["status-test"];
  applyOnHitEffects(data, s, e, 5);
  expect(e.slowBp).toBe(5000);
});

it("confusion strikes the nearest living other enemy with stable ID tie-breaking", () => {
  const { data, s, make } = fixture({ confusionDamageBp: 2500, confusionTicks: 20 });
  const source = make(3, 3), lowerId = make(1, 2), higherId = make(2, 4), dead = make(4, 3, 0), far = make(5, 8);
  s.enemies = [higherId, source, far, lowerId, dead];
  applyOnHitEffects(data, s, source, 5);
  s.tick = 14;
  tickEffects(data, s);
  expect(lowerId.hp).toBe(75);
  expect(higherId.hp).toBe(100);
  expect(source.hp).toBe(100);
  expect(far.hp).toBe(100);
  expect(lowerId.poisonDpt).toBeUndefined();
  expect(lowerId.confusedUntil).toBeUndefined();
});

it("refresh does not postpone confusion strikes and expiration prevents later attacks", () => {
  const { data, s, make } = fixture({ confusionDamageBp: 2500, confusionTicks: 8 });
  const source = make(1, 2), target = make(2, 3);
  s.enemies = [source, target];
  applyOnHitEffects(data, s, source, 5);
  for (s.tick = 11; s.tick <= 14; s.tick++) {
    applyOnHitEffects(data, s, source, 5);
    tickEffects(data, s);
  }
  expect(target.hp).toBe(75);
  s.tick = source.confusedUntil!;
  tickEffects(data, s);
  expect(target.hp).toBe(75);
  expect(source.confusedUntil).toBeUndefined();
  expect(source.confusionNextTick).toBeUndefined();
});

it("poison-killed enemies cannot attack and effect functions never award bounty", () => {
  const { data, s, make } = fixture();
  const deadSource = make(1, 2, 1), survivor = make(2, 3);
  Object.assign(deadSource, { poisonDpt: 10000, poisonUntil: 20, confusedUntil: 20, confusionNextTick: 10, confusionDamageBp: 10000 });
  s.enemies = [deadSource, survivor];
  const gold = s.gold;
  tickEffects(data, s);
  expect(deadSource.hp).toBe(0);
  expect(survivor.hp).toBe(100);
  expect(s.gold).toBe(gold);
  expect(s.stats.kills).toBe(0);
});

it("world cleanup pays each effect kill once, including explosion cascades", () => {
  const { data, s, make } = fixture();
  data.relics.push({ id: "burst-test", name: "Burst", description: "Test", damageType: "all", damageBp: 10000, slowDamageBp: 10000, interestBp: 0, deathBurstBp: 10000, deathBurstRadiusFp: 2048 });
  s.relics = ["burst-test"];
  const source = make(1, 2, 1), target = make(2, 3, 1), far = make(3, 8, 100);
  Object.assign(source, { poisonDpt: 10000, poisonUntil: 20, confusedUntil: 20, confusionNextTick: 10, confusionDamageBp: 10000 });
  s.enemies = [source, target, far];
  const gold = s.gold;
  const events = step(data, s);
  expect(events.filter(e => e.kind === "kill")).toHaveLength(2);
  expect(events.filter(e => e.kind === "burst")).toHaveLength(2);
  expect(s.gold - gold).toBe(2 * (data.economy.bountyBase + data.economy.bountyPerWave));
  expect(s.enemies.map(e => e.id)).toEqual([3]);
});

it("one splash shot applies exactly one poison dose per actual target", () => {
  const { data, s, make } = fixture({ poisonDamageBp: 5000, poisonTicks: 10 });
  const primary = make(1, 3, 1000), splash = make(2, 4, 1000);
  s.enemies = [primary, splash];
  s.towers = [{ cell: primary.cell - s.grid.width, type: "mortar", level: 1, spent: data.towerById.get("mortar")!.cost, cooldown: 0, priority: "first" }];
  const hits = step(data, s).filter(e => e.kind === "hit");
  expect(hits).toHaveLength(2);
  for (const enemy of s.enemies) {
    expect(enemy.poisonStacks).toBe(1);
    expect(enemy.poisonDpt).toBeGreaterThan(0);
  }
});

it("native Frost cannot shorten the longer rare slow applied by that hit", () => {
  const { data, s, make } = fixture({ hitSlowBp: 7500, hitSlowTicks: 100 });
  const target = make(1, 3, 1000);
  s.enemies = [target];
  s.towers = [{ cell: target.cell - s.grid.width, type: "frost", level: 1, spent: data.towerById.get("frost")!.cost, cooldown: 0, priority: "first" }];
  const appliedAt = s.tick;
  step(data, s);
  expect(target.slowBp).toBe(data.towerById.get("frost")!.slowBp);
  expect(target.slowUntil).toBe(appliedAt + 100);
});

it("legacy data and enemies gain no optional fields or behavior", () => {
  const data = loadData(), s = createState(data, 7);
  const e: Enemy = { id: 1, type: "grunt", cell: s.grid.entry, next: -1, hp: 100, maxHp: 100, progress: 0, slowBp: 10000, slowUntil: 0, revealedUntil: 0 };
  s.enemies = [e];
  const before = JSON.stringify(s);
  applyOnHitEffects(data, s, e, 5);
  tickEffects(data, s);
  expect(JSON.stringify(s)).toBe(before);
});
