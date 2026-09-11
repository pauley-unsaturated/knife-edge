import { bpRateTick, mulBp } from "./fixed.js";
import type { GameData, TowerType } from "./data.js";
import type { Enemy, State } from "./world.js";

/** Coatings apply only to the actual target. Wet and oil deliberately coexist. */
export function coatingHit(data: GameData, s: State, e: Enemy, type: TowerType, damage: number): number {
  if (type.coating === "wet") e.wetUntil = s.tick + type.coatingTicks!;
  if (type.coating === "oil") e.oiledUntil = s.tick + type.coatingTicks!;
  const rules = data.effectRules;
  if (!rules) return damage;
  if (type.damageType === "chain" && s.tick < (e.wetUntil ?? 0))
    damage = mulBp(damage, rules.wetLightningBp);
  if (type.damageType === "thermal" && s.tick < (e.oiledUntil ?? 0)) {
    e.oiledUntil = 0; // One direct hit consumes the coat; no proc recursion.
    const dpt = Math.floor(damage * rules.oilBurnBp / rules.oilBurnTicks);
    e.burnDpt = Math.max(s.tick < (e.burnUntil ?? 0) ? e.burnDpt ?? 0 : 0, dpt);
    e.burnUntil = s.tick + rules.oilBurnTicks;
    damage = mulBp(damage, rules.oilHitBp);
  }
  return damage;
}

/** Integer BP-rate burn: total rounding error is below one damage per refresh. */
export function tickBurn(s: State): void {
  for (const e of s.enemies) if (e.hp > 0 && s.tick < (e.burnUntil ?? 0)) {
    const dpt = e.burnDpt ?? 0;
    e.hp -= bpRateTick(dpt, s.tick);
  }
}
