/** Rare on-hit effects. Damage stays integer and deaths are deliberately left
 * for the world's one shared bounty/explosion cleanup pass. */
import type { GameData } from "./data.js";
import { stackedRelics } from "./drops.js";
import { BP, bpRateTick, mulBp } from "./fixed.js";
import { enemyPos, type Enemy, type State } from "./world.js";

export function applyOnHitEffects(data: GameData, s: State, enemy: Enemy, damage: number): void {
  const rules = data.effectRules;
  if (!rules || enemy.hp <= 0 || damage <= 0) return;
  let poisonBp = 0, poisonTicks = 0;
  let confusionBp = 0, confusionTicks = 0;
  let slowBp = BP, slowTicks = 0;
  for (const relic of stackedRelics(data, s.relics)) {
    if (relic.poisonDamageBp && relic.poisonTicks) {
      poisonBp += relic.poisonDamageBp;
      poisonTicks = Math.max(poisonTicks, relic.poisonTicks);
    }
    if (relic.confusionDamageBp && relic.confusionTicks) {
      confusionBp += relic.confusionDamageBp;
      confusionTicks += relic.confusionTicks;
    }
    if (relic.hitSlowBp !== undefined && relic.hitSlowTicks) {
      slowBp = mulBp(slowBp, relic.hitSlowBp);
      slowTicks += relic.hitSlowTicks;
    }
  }
  if (poisonBp && poisonTicks) {
    // BP-scaled damage per tick: no minimum-1-per-tick amplification of tiny
    // poisons. Each hit adds a dose up to cap × that incoming dose's strength.
    // If an existing poison is already stronger than this cap, preserve it.
    // Stronger new hits can lift the ceiling; weaker hits never reduce potency.
    const dpt = Math.floor(damage * poisonBp / poisonTicks);
    if (dpt > 0) {
      const active = s.tick < (enemy.poisonUntil ?? 0);
      const current = active ? enemy.poisonDpt ?? 0 : 0;
      enemy.poisonDpt = Math.min(current + dpt, Math.max(current, dpt * rules.poisonStackCap));
      enemy.poisonStacks = Math.min(rules.poisonStackCap, (active ? enemy.poisonStacks ?? 0 : 0) + 1);
      enemy.poisonUntil = Math.max(enemy.poisonUntil ?? 0, s.tick + poisonTicks);
    }
  }
  if (confusionBp && confusionTicks) {
    const active = s.tick < (enemy.confusedUntil ?? 0);
    enemy.confusionDamageBp = Math.max(active ? enemy.confusionDamageBp ?? 0 : 0, confusionBp);
    enemy.confusedUntil = Math.max(enemy.confusedUntil ?? 0, s.tick + confusionTicks);
    // Refresh cannot postpone the next strike forever under rapid tower fire.
    if (!active || enemy.confusionNextTick === undefined)
      enemy.confusionNextTick = s.tick + rules.confusionIntervalTicks;
  }
  if (slowTicks) {
    const combined = Math.max(rules.minSlowBp, slowBp);
    // Native Frost and rare slow use the strongest active value, not a second
    // multiplicative layer. Copy multiplication occurs only above, once per hit.
    enemy.slowBp = s.tick < enemy.slowUntil ? Math.min(enemy.slowBp, combined) : combined;
    enemy.slowUntil = Math.max(enemy.slowUntil, s.tick + slowTicks);
  }
}

export function tickEffects(data: GameData, s: State): void {
  const rules = data.effectRules;
  if (!rules) return;
  // Finish all poison ticks first so an enemy killed by poison cannot perform
  // a confusion attack later in this same simulation tick.
  for (const enemy of s.enemies) {
    if (enemy.poisonUntil !== undefined && s.tick >= enemy.poisonUntil) {
      delete enemy.poisonDpt;
      delete enemy.poisonUntil;
      delete enemy.poisonStacks;
    }
    if (enemy.hp <= 0 || !enemy.poisonDpt || enemy.poisonUntil === undefined) continue;
    // A fixed global phase distributes fractional DPS into exact integer hits.
    // It requires no extra replay state and refresh never resets its phase.
    enemy.hp -= bpRateTick(enemy.poisonDpt, s.tick);
  }
  const radius2 = rules.confusionRadiusFp ** 2;
  const ordered = [...s.enemies].sort((a, b) => a.id - b.id);
  for (const enemy of ordered) {
    if (enemy.confusedUntil !== undefined && s.tick >= enemy.confusedUntil) {
      delete enemy.confusedUntil;
      delete enemy.confusionDamageBp;
      delete enemy.confusionNextTick;
    }
    if (enemy.hp <= 0 || !enemy.confusionDamageBp || enemy.confusionNextTick === undefined || s.tick < enemy.confusionNextTick) continue;
    const source = enemyPos(s, enemy);
    let nearest: Enemy | undefined;
    let distance = Number.MAX_SAFE_INTEGER;
    for (const target of ordered) {
      if (target.id === enemy.id || target.hp <= 0) continue;
      const pos = enemyPos(s, target);
      const d2 = (source.x - pos.x) ** 2 + (source.y - pos.y) ** 2;
      if (d2 <= radius2 && d2 < distance) { nearest = target; distance = d2; }
    }
    // Confusion damage is deliberately not a tower hit: it cannot recursively
    // apply poison/slow/confusion, nor touch the core or award its own bounty.
    if (nearest) nearest.hp -= mulBp(enemy.maxHp, enemy.confusionDamageBp);
    enemy.confusionNextTick = s.tick + rules.confusionIntervalTicks;
  }
}
