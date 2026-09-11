import { readFileSync } from "node:fs";
import type { RawGameData } from "../../packages/sim/src/index.ts";

export function candidate(growth = 12000, hpGrowth = 10000, interval = 16): RawGameData {
  const raw = JSON.parse(readFileSync(new URL("./base.json", import.meta.url), "utf8")) as RawGameData;
  raw.version = "demo-2-heat";
  Object.assign(raw.economy, { maxWaves: 18, lives: 12, bountyBase: 3 });
  Object.assign(raw.composer, { openingBudgets: [60, 200, 250], budgetBase: 180,
    growthBp: growth, hpGrowthBp: hpGrowth, spawnIntervalTicks: interval, maxEnemiesPerWave: 18, riddleEvery: 4 });
  const unlocks: Record<string, number> = { grunt: 1, swift: 2, armored: 3, swarm: 5, shade: 9 };
  for (const e of raw.enemies) e.unlockWave = unlocks[e.id]!;
  raw.raids = { hpPerRaidBp: 3500, hastePerRaidBp: 2000, hideouts: [
    { id: "garage", name: "The Garage", enemy: "swift", gold: 90 },
    { id: "foundry", name: "The Foundry", enemy: "armored", gold: 110 },
    { id: "warren", name: "The Warren", enemy: "swarm", gold: 75 },
  ] };
  raw.relicRules.everyWaves = 2;
  for (const r of raw.relics) {
    if (r.id === "cold-front") { r.slowDamageBp = 17500; r.description = "Slowed enemies take 75% more damage from every tower. Stacks multiply. Build a Frost kill zone."; }
    if (r.id === "hot-wire" || r.id === "conductive") { r.damageBp = 18000; r.description = `${r.id === "hot-wire" ? "Ember" : "Arc"} damage +80%. Stacks multiply. Commit to the build.`; }
    if (r.id === "overclock") { r.damageBp = 12500; r.description = "Every tower deals 25% more damage. Stacks multiply."; }
    if (r.id === "compound") { r.interestBp = 300; r.description = "Interest +3 percentage points. Bank cap still applies. Power later, no damage now."; }
  }
  raw.relics = raw.relics.filter(r => r.id !== "chain-reaction");
  raw.relics.push({ id: "chain-reaction", name: "Chain reaction", description: "Kills explode for 45% of the victim’s max HP within 2 cells. Explosions can trigger more explosions. Stacks add.",
    damageType: "all", damageBp: 10000, slowDamageBp: 10000, interestBp: 0, deathBurstBp: 4500, deathBurstRadiusFp: 2048 });
  return raw;
}
