import { expect, it } from "vitest";
import { createState, deriveData, rawData, runReplay, seedRng } from "@knife-edge/sim";
import { loadData } from "../../../packages/sim/test/helpers.js";
import { evaluateOffers, raiderPolicy } from "../src/policies/raider.js";
import { runPolicy } from "../src/runner.js";

function fixture() {
  const raw = rawData(loadData());
  raw.relics.find(r => r.id === "conductive")!.damageBp = 18000;
  const data = deriveData(raw);
  const s = createState(data, 7);
  s.tick = 20;
  s.wave = 2;
  s.gold = 100;
  s.towers = [120, 121].map(cell => ({ cell, type: "bolt", level: 1, spent: 30, cooldown: 0, priority: "first" as const }));
  s.stats.goldSpent = 60;
  for (const t of s.towers) s.blocked[t.cell] = 1;
  return { data, s };
}

it("deploys real overlapping Frost after accepting a slow-damage patch", () => {
  const { data, s } = fixture();
  s.relics = ["cold-front"];
  const actions = raiderPolicy("synergy-expert").decide(data, s, seedRng(1));
  expect(actions).toEqual([{ kind: "build", type: "frost", cell: expect.any(Number) }]);
});

it("saves for a patch-enabled tower instead of spending each paycheck on Bolt", () => {
  const { data, s } = fixture();
  s.relics = ["conductive", "conductive", "conductive"];
  s.gold = 30;
  const driver = raiderPolicy("synergy-expert");
  expect(driver.decide(data, s, seedRng(1)).some(c => c.kind === "build")).toBe(false);
  s.gold = 100;
  expect(driver.decide(data, s, seedRng(1))).toEqual([{ kind: "build", type: "arc", cell: expect.any(Number) }]);
});

it("later off-lane stacks redirect investment despite an earlier thermal patch", () => {
  const { data, s } = fixture();
  s.relics = ["hot-wire", "conductive", "conductive", "conductive"];
  expect(raiderPolicy("synergy-expert").decide(data, s, seedRng(1))).toEqual([
    { kind: "build", type: "arc", cell: expect.any(Number) },
  ]);
});

it("values active low-core connectors and rejects lethal sacrifice", () => {
  const { data, s } = fixture();
  data.relics.push(
    { id: "blood", name: "Blood", description: "", damageType: "all", damageBp: 12500, slowDamageBp: 10000, interestBp: 0, sacrificeLives: 3 },
    { id: "stand", name: "Stand", description: "", damageType: "all", damageBp: 10000, slowDamageBp: 10000, interestBp: 0, lowLifeThreshold: 4, lowLifeDamageBp: 25000 },
  );
  s.relicOffers = ["blood", "stand"];
  s.lives = 3;
  const offers = evaluateOffers(data, s);
  expect(offers.map(o => o.id)).toEqual(["stand"]);
  expect(offers[0]!.reason).toContain("active");
});

it("knowledge and cadence witnesses replay deterministically without granting resources", () => {
  const data = loadData();
  for (const name of ["synergy-rookie", "synergy-deliberate", "synergy-expert"]) {
    const result = runPolicy(data, raiderPolicy(name), 7, 2000);
    expect(runReplay(data, result.replay, 2000).finalHash).toBe(result.finalHash);
    expect(runPolicy(data, raiderPolicy(name), 7, 2000).finalHash).toBe(result.finalHash);
    if (name === "synergy-deliberate") expect(result.replay.commands.every(c => c.tick % 80 === 0)).toBe(true);
  }
});
