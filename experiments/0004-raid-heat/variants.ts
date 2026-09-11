import { candidate } from "./candidate.ts";
import type { RawGameData } from "../../packages/sim/src/index.ts";

export type Variant = "raid" | "compound" | "pact";
export function variant(name: Variant): RawGameData {
  const raw = candidate(11800, 10400, 16);
  raw.version = `demo-2-${name}`;
  raw.relicRules.firstOfferWave = 2;
  raw.relicRules.everyWaves = 3;
  if (name === "compound") {
    delete raw.raids;
    // The investment branch needs runway before its geometric budget catches up.
    raw.composer.hpGrowthBp = 10000;
    raw.relics = raw.relics.filter(r => r.id !== "chain-reaction");
    for (const r of raw.relics) { r.damageBp = Math.min(r.damageBp, 14000); r.slowDamageBp = Math.min(r.slowDamageBp, 14000); }
    raw.economy.interestBp = 500;
    raw.economy.interestCapGold = 400;
    const r = raw.relics.find(r => r.id === "compound")!;
    Object.assign(r, { name: "Compound engine", interestBp: 200, interestRateMultiplierBp: 18000, interestCapBonusGold: 300,
      description: "Interest +2 points, then ×1.8 per stack. Bank capacity +300g. Survive on less defense now to fund a late buying spree." });
  }
  if (name === "pact") {
    delete raw.raids;
    raw.relicRules.offerCount = 2;
    raw.relics = raw.relics.filter(r => r.id !== "compound" && r.id !== "chain-reaction");
    for (const r of raw.relics) { r.damageBp = Math.min(r.damageBp, 14000); r.slowDamageBp = Math.min(r.slowDamageBp, 14000); }
    raw.relics.push(
      { id: "blood-price", name: "Blood price", description: "Pay 3 core permanently. All damage +25%, stacking. You must keep at least 1 core.",
        damageType: "all", damageBp: 12500, slowDamageBp: 10000, interestBp: 0, sacrificeLives: 3 },
      { id: "last-stand", name: "Last stand", description: "At 4 core or less: all damage ×2.5 per stack. Above 4 core this does nothing. A dangerous commitment.",
        damageType: "all", damageBp: 10000, slowDamageBp: 10000, interestBp: 0, lowLifeThreshold: 4, lowLifeDamageBp: 25000 },
    );
  }
  // Keep displayed effects exact after variant overrides.
  for (const r of raw.relics) {
    if (r.id === "cold-front") r.description = `Slowed enemies take ${r.slowDamageBp / 100 - 100}% more damage. Stacks multiply. Build a Frost kill zone.`;
    if (r.id === "hot-wire" || r.id === "conductive") r.description = `${r.id === "hot-wire" ? "Ember" : "Arc"} damage +${r.damageBp / 100 - 100}%. Stacks multiply.`;
  }
  return raw;
}
