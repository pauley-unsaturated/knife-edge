import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { cloneState, composeWave, createState, deriveData, hashState, heatHpBp, interestTerms, interestAtStart, makeReplay, nextStep, rawData, runReplay, spawnInterval, step, towerDamage, validateReplay, type Enemy } from "../src/index.js";
import { loadData } from "./helpers.js";

function rules() {
  const raw = rawData(loadData());
  raw.raids = { hpPerRaidBp: 3500, hastePerRaidBp: 2000, hideouts: [
    { id: "garage", name: "Garage", enemy: "swift", gold: 90 },
    { id: "foundry", name: "Foundry", enemy: "armored", gold: 110 },
  ] };
  return deriveData(raw);
}

it("raids are one-shot, between-wave tradeoffs and alter deterministic previews", () => {
  const d = rules(), s = createState(d, 7);
  expect(step(d, s, [{ kind: "raid", id: "garage" }])[0]).toMatchObject({ kind: "rejected" });
  s.wave = 3;
  const before = s.gold;
  expect(step(d, s, [{ kind: "raid", id: "garage" }])[0]).toMatchObject({ kind: "raid", gold: 90 });
  expect(s.gold).toBe(before + 90);
  expect(heatHpBp(d, s)).toBe(13500);
  expect(spawnInterval(d, s)).toBe(Math.floor(d.composer.spawnIntervalTicks / 1.2));
  expect(step(d, s, [{ kind: "raid", id: "garage" }])[0]).toMatchObject({ kind: "rejected" });
  for (let wave = 4; wave <= d.economy.maxWaves; wave++)
    expect(composeWave(d, 7, wave, s.raided).some(e => e.type === "swift")).toBe(false);
  const preview = composeWave(d, 7, 4, s.raided);
  step(d, s, [{ kind: "callWave" }]);
  expect(s.spawnQueue).toEqual(preview.slice(1));
  expect(step(d, s, [{ kind: "raid", id: "foundry" }])[0]).toMatchObject({ kind: "rejected" });
  const clone = cloneState(s);
  clone.raided!.push("foundry");
  expect(hashState(clone)).not.toBe(hashState(s));
  expect(s.raided).toEqual(["garage"]);
});

it("legacy demo replays retain their exact final hash", () => {
  const r = validateReplay(JSON.parse(readFileSync("experiments/0002-playable-bands/legacy-example.replay.json", "utf8")));
  expect(runReplay(deriveData(r.data!), r, 400000).finalHash).toBe(r.finalHash);
});

it("death explosions chain, stack additively, respect radius and pay each bounty once", () => {
  const raw = rawData(rules());
  raw.relics.push({ id: "test-burst", name: "Burst", description: "Test", damageType: "all", damageBp: 10000, slowDamageBp: 10000, interestBp: 0, deathBurstBp: 5000, deathBurstRadiusFp: 1200 });
  raw.grid.obstacles = 0;
  const d = deriveData(raw), s = createState(d, 7);
  s.wave = 1;
  s.inWave = true;
  s.relics = ["test-burst", "test-burst"];
  const make = (id: number, offset: number, hp: number): Enemy => {
    const cell = s.grid.entry + offset;
    return { id, type: "grunt", cell, next: nextStep(s.grid, s.dist, cell), hp, maxHp: 100, progress: 0, slowBp: 10000, slowUntil: 0, revealedUntil: 0 };
  };
  s.enemies = [make(1, 2, 0), make(2, 3, 100), make(3, 4, 100), make(4, 8, 100)];
  const before = s.gold;
  const events = step(d, s);
  expect(events.filter(e => e.kind === "burst")).toHaveLength(3);
  expect(events.filter(e => e.kind === "kill")).toHaveLength(3);
  expect(s.enemies.map(e => e.id)).toEqual([4]);
  expect(s.gold).toBe(before + 3 * (d.economy.bountyBase + d.economy.bountyPerWave));
});

it("raid commands round-trip in ordinary replays and reject malformed IDs", () => {
  const d = rules(), s = createState(d, 7);
  const commands = [{ tick: 0, cmd: { kind: "raid" as const, id: "garage" } }];
  step(d, s, commands.map(c => c.cmd));
  const replay = makeReplay(d, s, commands);
  expect(runReplay(d, replay, 100).finalHash).toBe(replay.finalHash);
  expect(() => validateReplay({ ...replay, commands: [{ tick: 0, cmd: { kind: "raid", id: 1 } }] })).toThrow();
  const bad = rawData(d);
  bad.raids!.hideouts.push({ id: "grunt", name: "No sources", enemy: "grunt", gold: 50 });
  expect(() => deriveData(bad)).toThrow("opening enemy source");
});

it("pacts charge core exactly once, reject lethal prices and activate only below the threshold", () => {
  const raw = rawData(rules());
  raw.relics.push({ id: "test-pact", name: "Pact", description: "Test", damageType: "all", damageBp: 10000, slowDamageBp: 10000, interestBp: 0, sacrificeLives: 3, lowLifeThreshold: 4, lowLifeDamageBp: 25000 });
  const d = deriveData(raw), s = createState(d, 7);
  const t = { cell: 1, type: "bolt", level: 1, spent: 30, cooldown: 0, priority: "first" as const };
  s.relicOffers = ["test-pact"];
  s.lives = 8;
  step(d, s, [{ kind: "pickRelic", id: "test-pact" }]);
  expect(s.lives).toBe(5);
  expect(towerDamage(d, s, t)).toBe(8);
  s.lives = 4;
  expect(towerDamage(d, s, t)).toBe(20);
  s.relicOffers = ["test-pact"];
  s.lives = 3;
  expect(step(d, s, [{ kind: "pickRelic", id: "test-pact" }])[0]).toMatchObject({ kind: "rejected" });
  expect(s.lives).toBe(3);
  expect(s.relics).toHaveLength(1);
});

it("compound stacks expand the bank and multiply the additive interest rate", () => {
  const raw = rawData(rules());
  raw.economy.interestBp = 500;
  raw.economy.interestCapGold = 400;
  raw.relics.push({ id: "test-bank", name: "Bank", description: "Test", damageType: "all", damageBp: 10000, slowDamageBp: 10000, interestBp: 200, interestRateMultiplierBp: 16000, interestCapBonusGold: 300 });
  const d = deriveData(raw), s = createState(d, 7);
  s.relics = ["test-bank", "test-bank"];
  s.gold = 5000;
  expect(interestTerms(d, s)).toEqual({ rate: 2304, cap: 1000 });
  expect(interestAtStart(d, s)).toBe(230);
});

it("loot randomization leaves enemy composition intact and honors the first offer offset", () => {
  const raw = rawData(rules());
  raw.relicRules.firstOfferWave = 2;
  raw.relicRules.everyWaves = 3;
  const a = deriveData(raw), b = deriveData({ ...raw, relicRules: { ...raw.relicRules, offerSeedOffset: 12345 } });
  for (let wave = 1; wave <= 8; wave++) {
    expect(composeWave(a, 7, wave)).toEqual(composeWave(b, 7, wave));
    const s = createState(a, 7);
    s.wave = wave; s.inWave = true;
    step(a, s);
    expect(s.relicOffers.length > 0).toBe([2, 5, 8].includes(wave));
  }
});
