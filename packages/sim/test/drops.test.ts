import { expect, it } from "vitest";
import { cloneState, composeWave, createState, deriveData, hashState, makeReplay, rawData, rerollCost, rollOffers, runReplay, stackedRelics, step, validateReplay, type TimedCommand } from "../src/index.js";
import { loadData } from "./helpers.js";

function rules() {
  const raw = rawData(loadData());
  Object.assign(raw.relicRules, { stackBonusBp: 500, rerollBaseGold: 25, rerollGrowthBp: 16000, maxRerolls: 3 });
  raw.relics.forEach((r, i) => r.offerWeight = i === 0 ? 1 : 4);
  return deriveData(raw);
}

it("weighted offers are deterministic, unique, and rarities change acquisition frequency", () => {
  const d = rules();
  const counts = new Map<string, number>();
  for (let seed = 1; seed <= 1000; seed++) {
    const offers = rollOffers(d, seed, 2);
    expect(offers).toEqual(rollOffers(d, seed, 2));
    expect(new Set(offers).size).toBe(d.relicRules.offerCount);
    for (const id of offers) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  expect(counts.get(d.relics[0]!.id)!).toBeLessThan(counts.get(d.relics[1]!.id)!);
});

it("rerolls spend gold, escalate, survive cloning, and leave future waves/offers independent", () => {
  const d = rules(), s = createState(d, 7);
  s.wave = 2; s.relicOffers = rollOffers(d, 7, 2); s.gold = 500;
  const future = composeWave(d, 7, 3);
  expect(rerollCost(d, s)).toBe(25);
  step(d, s, [{ kind: "reroll" }]);
  expect(s.gold).toBe(475);
  expect(rerollCost(d, s)).toBe(40);
  expect(rerollCost(d, cloneState(s))).toBe(40);
  expect(s.relicOffers).toEqual(rollOffers(d, 7, 2, 1));
  step(d, s, [{ kind: "reroll" }]);
  expect(rerollCost(d, s)).toBe(64);
  step(d, s, [{ kind: "reroll" }]);
  expect(rerollCost(d, s)).toBeNull();
  expect(composeWave(d, 7, 3)).toEqual(future);
  expect(rollOffers(d, 7, 5)).toEqual(rollOffers(d, 7, 5, 0));
  const clone = cloneState(s); clone.offerRerolls = 0;
  expect(hashState(clone)).not.toBe(hashState(s));
});

it("rejected rerolls do not change offers, cost or gold", () => {
  const d = rules(), s = createState(d, 7);
  s.wave = 2; s.relicOffers = rollOffers(d, 7, 2); s.gold = 24;
  const before = [...s.relicOffers];
  expect(step(d, s, [{ kind: "reroll" }])[0]).toMatchObject({ kind: "rejected" });
  expect(s.relicOffers).toEqual(before); expect(s.gold).toBe(24); expect(s.offerRerolls).toBe(0);
});

it("paid rerolls round-trip from ordinary play and cannot reset via a saved checkpoint", () => {
  const raw = rawData(rules());
  raw.grid.obstacles = 0;
  raw.composer.openingBudgets = [10];
  raw.enemies = raw.enemies.map(e => ({ ...e, hp: 1 }));
  raw.relicRules.firstOfferWave = 1;
  const d = deriveData(raw), s = createState(d, 7);
  const commands: TimedCommand[] = [];
  const send = (cmd: TimedCommand["cmd"]) => { commands.push({ tick: s.tick, cmd }); step(d, s, [cmd]); };
  send({ kind: "build", cell: s.grid.entry - s.grid.width + 1, type: "bolt" });
  send({ kind: "callWave" });
  while (!s.relicOffers.length && s.tick < 10000) step(d, s);
  expect(s.relicOffers.length).toBeGreaterThan(0);
  send({ kind: "reroll" });
  expect(s.offerRerolls).toBe(1);
  const replay = validateReplay(JSON.parse(JSON.stringify(makeReplay(d, s, commands))));
  const restored = runReplay(d, replay, 400000).state;
  expect(hashState(restored)).toBe(hashState(s));
  expect(rerollCost(d, restored)).toBe(40);
  const before = restored.gold;
  step(d, restored, [{ kind: "reroll" }]);
  expect(restored.gold).toBe(before - 40);
  expect(restored.offerRerolls).toBe(2);
});

it("additive stacking gets a small kicker without re-amplifying multiplicative drops", () => {
  const d = rules();
  d.relics.push({ id: "test-burst", name: "Burst", description: "", damageType: "all", damageBp: 10000, slowDamageBp: 10000, interestBp: 0, deathBurstBp: 4500, deathBurstRadiusFp: 1024 });
  expect(stackedRelics(d, ["test-burst", "test-burst", "test-burst"]).map(r => r.deathBurstBp)).toEqual([4500, 4725, 4950]);
  expect(stackedRelics(d, ["cold-front", "cold-front"]).map(r => r.slowDamageBp)).toEqual([d.relics.find(r => r.id === "cold-front")!.slowDamageBp, d.relics.find(r => r.id === "cold-front")!.slowDamageBp]);
});
