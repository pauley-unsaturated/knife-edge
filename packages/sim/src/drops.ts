import type { GameData, RawRelic } from "./data.js";
import { growBp, mulBp } from "./fixed.js";
import { nextInt, seedRng } from "./rng.js";

export function rollOffers(data: GameData, seed: number, wave: number, rerolls = 0): string[] {
  const rng = seedRng((seed ^ (data.relicRules.offerSeedOffset ?? 0) ^ Math.imul(wave, 0x85ebca6b) ^ Math.imul(rerolls, 0x27d4eb2d)) >>> 0);
  const pool = [...data.relics];
  const offers: string[] = [];
  const weighted = pool.some(r => r.offerWeight !== undefined);
  while (pool.length && offers.length < data.relicRules.offerCount) {
    let index = 0;
    if (weighted) {
      let ticket = nextInt(rng, pool.reduce((n, r) => n + (r.offerWeight ?? 1), 0));
      while (ticket >= (pool[index]!.offerWeight ?? 1)) ticket -= pool[index++]!.offerWeight ?? 1;
    } else index = nextInt(rng, pool.length);
    offers.push(pool.splice(index, 1)[0]!.id);
  }
  return offers;
}

export function rerollCost(data: GameData, s: { offerRerolls?: number }): number | null {
  if (data.relicRules.rerollBaseGold === undefined || (s.offerRerolls ?? 0) >= data.relicRules.maxRerolls!) return null;
  return growBp(data.relicRules.rerollBaseGold, data.relicRules.rerollGrowthBp!, s.offerRerolls ?? 0);
}

/** Tiny kicker for additive status/corpse effects only. Existing multiplicative
 * damage stacks keep their advertised multipliers, without double compounding. */
export function stackedRelics(data: GameData, ids: readonly string[]): RawRelic[] {
  const seen = new Map<string, number>();
  return ids.map(id => {
    const r = data.relics.find(r => r.id === id)!;
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    const factor = 10000 + count * (data.relicRules.stackBonusBp ?? 0);
    const adjusted = { ...r };
    for (const key of ["deathBurstBp", "poisonDamageBp", "confusionDamageBp"] as const)
      if (r[key] !== undefined) adjusted[key] = mulBp(r[key], factor);
    return adjusted;
  });
}
