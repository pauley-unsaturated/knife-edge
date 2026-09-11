import type { RawGameData } from "../../packages/sim/src/index.ts";
import { variant, type Variant } from "./variants.ts";

/** Candidate round4: rare status bridges, deliberate support, priced rerolls. */
export function engines(name: Variant): RawGameData {
  const raw = variant(name);
  raw.version = `demo-3-${name}`;
  Object.assign(raw.towers.find(t => t.id === "ember")!, { costGrowthBp: 14000, damageGrowthBp: 24000 });
  // Investment branch needs enough geometric pressure to challenge plain Bolt.
  if (name === "compound") raw.composer.hpGrowthBp = 10300;
  raw.effectRules = { minSlowBp: 2500, poisonStackCap: 8, confusionIntervalTicks: 40, confusionRadiusFp: 1536,
    wetLightningBp: 15000, wetSlowBp: 7500, oilHitBp: 17500, oilBurnBp: 5000, oilBurnTicks: 60 };
  Object.assign(raw.relicRules, { stackBonusBp: 500, rerollBaseGold: 25, rerollGrowthBp: 16000, maxRerolls: 3 });
  for (const r of raw.relics) r.offerWeight = r.id === "chain-reaction" || r.id === "last-stand" ? 1 : 4;
  raw.relics.push(
    { id: "venom", name: "Venom rounds", description: "Hits add poison worth 45% of hit damage over 3s, up to 8 doses. Hits refresh duration; stronger hits raise the dose ceiling. Copies strengthen doses.",
      damageType: "all", damageBp: 10000, slowDamageBp: 10000, interestBp: 0, offerWeight: 2, poisonDamageBp: 4500, poisonTicks: 60 },
    { id: "black-ice", name: "Black ice", description: "Every hit slows to 85% speed for 1.5s. Copies multiply speed and add duration; floor 25%. Refreshes the strongest slow. Enables Cold Front.",
      damageType: "all", damageBp: 10000, slowDamageBp: 10000, interestBp: 0, offerWeight: 2, hitSlowBp: 8500, hitSlowTicks: 30 },
    { id: "mutiny", name: "Mutiny", description: "Hits confuse for 4s. Every 2s the enemy strikes another nearby enemy for 12% of its own max HP. Copies add damage and duration. No self-hits.",
      damageType: "all", damageBp: 10000, slowDamageBp: 10000, interestBp: 0, offerWeight: 1, confusionDamageBp: 1200, confusionTicks: 80 },
  );
  const support = raw.towers.find(t => t.id === "relay")!;
  raw.towers.push(
    { ...support, id: "sprayer", cost: 36, damage: 2, levels: 3, costGrowthBp: 13000, damageGrowthBp: 13000, rangeCells: 2.5, rangeGrowthBp: 14000,
      cooldownTicks: 18, targets: 3, splashCells: 1.5, auraBp: 0, adjacencyBonusBp: 0, coating: "wet", coatingTicks: 60 },
    { ...support, id: "solvent", cost: 40, damage: 2, levels: 3, costGrowthBp: 13000, damageGrowthBp: 13000, rangeCells: 2.5, rangeGrowthBp: 14000,
      cooldownTicks: 20, targets: 2, splashCells: 1.5, auraBp: 0, adjacencyBonusBp: 0, coating: "oil", coatingTicks: 60 },
  );
  raw.difficulties.easy.description = "More room to assemble your engine. A failed experiment can recover.";
  raw.difficulties.medium.description = "Find a groove before geometric pressure catches you around wave 12.";
  raw.difficulties.hard.description = "A tight budget. Commit to the drops and earn a cracked loadout.";
  return raw;
}
