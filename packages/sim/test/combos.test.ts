import { expect, it } from "vitest";
import { coatingHit, tickBurn } from "../src/combos.js";
import { createState, deriveData, hashState, nextStep, rawData, step, type Enemy, type TowerType } from "../src/index.js";
import { loadData } from "./helpers.js";

function fixture() {
  const raw = rawData(loadData());
  raw.grid.obstacles = 0;
  raw.effectRules = { minSlowBp: 2500, poisonStackCap: 8, confusionIntervalTicks: 4, confusionRadiusFp: 2048,
    wetLightningBp: 15000, wetSlowBp: 4000, oilHitBp: 17500, oilBurnBp: 5000, oilBurnTicks: 10 };
  const data = deriveData(raw), s = createState(data, 7);
  s.tick = 10;
  s.wave = 1;
  s.inWave = true;
  s.relics = [];
  const water: TowerType = { ...data.towerById.get("bolt")!, id: "water-test", coating: "wet", coatingTicks: 30 };
  const oil: TowerType = { ...data.towerById.get("bolt")!, id: "oil-test", coating: "oil", coatingTicks: 20 };
  const make = (id: number, offset: number, hp = 1000): Enemy => {
    const cell = s.grid.entry + offset;
    return { id, type: "grunt", hp, maxHp: hp, cell, next: nextStep(s.grid, s.dist, cell), progress: 0,
      slowBp: 10000, slowUntil: 0, revealedUntil: 0 };
  };
  return { data, s, water, oil, make };
}

it.each([true, false])("Arc evaluates wet per actual target, wet primary=%s", wetPrimary => {
  const { data, s, water, make } = fixture();
  const primary = make(1, 4), secondary = make(2, 3);
  s.enemies = [primary, secondary];
  coatingHit(data, s, wetPrimary ? primary : secondary, water, 1);
  const arc = data.towerById.get("arc")!;
  s.towers = [{ cell: primary.cell - s.grid.width, type: arc.id, level: 1, spent: arc.cost, cooldown: 0, priority: "first" }];
  const hits = step(data, s).filter(e => e.kind === "hit");
  expect(hits.map(e => e.enemy)).toEqual([primary.id, secondary.id]);
  const dryDamage = arc.ladder[0]!.damage;
  const wetDamage = Math.floor((dryDamage * data.effectRules!.wetLightningBp + 5000) / 10000);
  expect(hits.map(e => e.damage)).toEqual(wetPrimary ? [wetDamage, dryDamage] : [dryDamage, wetDamage]);
});

it("water strengthens Frost only on wet targets and respects the movement floor", () => {
  for (const wet of [false, true]) {
    const { data, s, water, make } = fixture();
    const e = make(1, 3);
    s.enemies = [e];
    if (wet) coatingHit(data, s, e, water, 1);
    const frost = data.towerById.get("frost")!;
    s.towers = [{ cell: e.cell - s.grid.width, type: frost.id, level: 1, spent: frost.cost, cooldown: 0, priority: "first" }];
    step(data, s);
    expect(e.slowBp).toBe(wet ? data.effectRules!.minSlowBp : frost.slowBp);
  }
});

it.each(["wet", "oil"] as const)("fresh %s delivery spreads primary and secondary hits, with priority fallback", coating => {
  const { data, s, make } = fixture();
  const type = { ...data.towerById.get("arc")!, id: "fresh-test", coating, coatingTicks: 30, preferFreshCoating: true, targets: 2 };
  data.towerById.set(type.id, type);
  const e1 = make(1, 4), e2 = make(2, 3), e3 = make(3, 3), e4 = make(4, 3);
  const until = coating === "wet" ? "wetUntil" : "oiledUntil";
  e1[until] = 100; e2[until] = 100;
  s.enemies = [e1, e2, e3, e4];
  s.towers = [{ cell: e2.cell - s.grid.width, type: type.id, level: 1, spent: type.cost, cooldown: 0, priority: "first" }];
  expect(step(data, s).filter(e => e.kind === "hit").map(e => e.enemy)).toEqual([3, 4]);
  s.towers[0]!.cooldown = 0;
  expect(step(data, s).filter(e => e.kind === "hit").map(e => e.enemy)).toEqual([1, 2]);
});

it("the configured slow floor also bounds a native dry Frost slow", () => {
  const { data, s, make } = fixture();
  const e = make(1, 3);
  s.enemies = [e];
  const frost = data.towerById.get("frost")!;
  frost.slowBp = 1000;
  s.towers = [{ cell: e.cell - s.grid.width, type: frost.id, level: 1, spent: frost.cost, cooldown: 0, priority: "first" }];
  step(data, s);
  expect(e.slowBp).toBe(data.effectRules!.minSlowBp);
});

it("one oil coat boosts one thermal hit and computes burn from pre-oil damage", () => {
  const { data, s, oil, make } = fixture();
  const e = make(1, 3), ember = data.towerById.get("ember")!;
  coatingHit(data, s, e, oil, 1);
  expect(coatingHit(data, s, e, ember, 20)).toBe(35);
  expect(e.oiledUntil).toBe(0);
  expect(e.burnDpt).toBe(10000); // 20 × 50% / 10 ticks, not boosted 35 × 50%.
  expect(e.burnUntil).toBe(20);
  s.tick = 11;
  expect(coatingHit(data, s, e, ember, 20)).toBe(20);
  expect(e.burnUntil).toBe(20); // No oil: no second proc and no timer refresh.
  expect(e.burnDpt).toBe(10000);
});

it("burn refresh keeps stronger potency, expires, and never rounds every tick up", () => {
  const { data, s, oil, make } = fixture();
  const e = make(1, 3), ember = data.towerById.get("ember")!;
  s.enemies = [e];
  coatingHit(data, s, e, oil, 1);
  coatingHit(data, s, e, ember, 10);
  expect(e.burnDpt).toBe(5000);
  for (s.tick = 10; s.tick < 20; s.tick++) {
    tickBurn(s);
    expect(Number.isInteger(e.hp)).toBe(true);
  }
  expect(e.hp).toBe(995);
  tickBurn(s);
  expect(e.hp).toBe(995);
  coatingHit(data, s, e, oil, 1);
  coatingHit(data, s, e, ember, 20);
  s.tick = 21;
  coatingHit(data, s, e, oil, 1);
  coatingHit(data, s, e, ember, 2);
  expect(e.burnDpt).toBe(10000);
  expect(e.burnUntil).toBe(31);
  s.tick = 31;
  coatingHit(data, s, e, oil, 1);
  coatingHit(data, s, e, ember, 2);
  expect(e.burnDpt).toBe(1000);
});

it("wet and oil coexist; igniting oil neither consumes wet nor refreshes its expiry", () => {
  const { data, s, water, oil, make } = fixture();
  const e = make(1, 3);
  coatingHit(data, s, e, water, 1);
  coatingHit(data, s, e, oil, 1);
  expect(e.wetUntil).toBe(40);
  expect(e.oiledUntil).toBe(30);
  coatingHit(data, s, e, data.towerById.get("ember")!, 20);
  expect(e.oiledUntil).toBe(0);
  expect(e.wetUntil).toBe(40);
  expect(coatingHit(data, s, e, data.towerById.get("arc")!, 20)).toBe(30);
  s.tick = 40;
  expect(coatingHit(data, s, e, data.towerById.get("arc")!, 20)).toBe(20);
});

it("burn, poison and confusion share one death/bounty pass deterministically", () => {
  const play = () => {
    const { data, s, make } = fixture();
    const burned = make(1, 2, 1), poisoned = make(2, 3, 1), confused = make(3, 4, 100), victim = make(4, 5, 1), far = make(5, 10, 100);
    Object.assign(burned, { burnDpt: 10000, burnUntil: 20, confusedUntil: 20, confusionNextTick: 10, confusionDamageBp: 10000 });
    Object.assign(poisoned, { poisonDpt: 10000, poisonUntil: 20, poisonStacks: 1 });
    Object.assign(confused, { confusedUntil: 20, confusionNextTick: 10, confusionDamageBp: 1000 });
    s.enemies = [burned, poisoned, confused, victim, far];
    const gold = s.gold;
    const events = step(data, s);
    expect(events.filter(e => e.kind === "kill").map(e => e.enemy)).toEqual([1, 2, 4]);
    expect(s.stats.kills).toBe(3);
    expect(s.gold - gold).toBe(3 * (data.economy.bountyBase + data.economy.bountyPerWave));
    expect(confused.hp).toBe(100); // Burn-killed confused source did not attack.
    expect(s.enemies.map(e => e.id)).toEqual([3, 5]);
    return { hash: hashState(s), events };
  };
  expect(play()).toEqual(play());
});
