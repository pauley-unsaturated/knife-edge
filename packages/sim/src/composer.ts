/**
 * Budget-driven wave composer (ADR-0013). A pure function of (data, rng, wave).
 * Budget(n) = budgetBase * growthBp^(n-1). Spent greedily on random unlocked types.
 * Every `riddleEvery`th wave uses a single type.
 */
import type { GameData, RawEnemyType } from "./data.js";
import { growBp } from "./fixed.js";
import { nextInt, type RngState } from "./rng.js";

export function waveBudget(data: GameData, wave: number): number {
  return growBp(data.composer.budgetBase, data.composer.growthBp, wave - 1);
}

export function composeWave(data: GameData, rng: RngState, wave: number): string[] {
  const unlocked = data.enemies.filter((e) => e.unlockWave <= wave);
  if (unlocked.length === 0) throw new Error(`no enemy types unlocked at wave ${wave}`);
  let budget = waveBudget(data, wave);
  const riddle = data.composer.riddleEvery > 0 && wave % data.composer.riddleEvery === 0;
  const pool: RawEnemyType[] = riddle ? [unlocked[nextInt(rng, unlocked.length)] as RawEnemyType] : unlocked;
  const minCost = Math.min(...pool.map((e) => e.budgetCost));
  const out: string[] = [];
  while (budget >= minCost) {
    const affordable = pool.filter((e) => e.budgetCost <= budget);
    const pick = affordable[nextInt(rng, affordable.length)] as RawEnemyType;
    out.push(pick.id);
    budget -= pick.budgetCost;
  }
  return out;
}
