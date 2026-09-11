/**
 * Budget-driven wave composer (ADR-0013). A pure function of (data, rng, wave).
 * Budget(n) = budgetBase * growthBp^(n-1). Spent greedily on random unlocked types.
 * Every `riddleEvery`th wave uses a single type.
 */
import type { GameData, RawEnemyType } from "./data.js";
import { growBp } from "./fixed.js";
import { nextInt, seedRng } from "./rng.js";

export interface SpawnSpec {
  type: string;
  tier: number;
}

export function waveBudget(data: GameData, wave: number): number {
  if (data.composer.openingBudgets?.[wave - 1] !== undefined)
    return data.composer.openingBudgets[wave - 1]!;
  return growBp(data.composer.budgetBase, data.composer.growthBp, wave - 1);
}

export function composeWave(
  data: GameData,
  seed: number,
  wave: number,
  raided: readonly string[] = [],
): SpawnSpec[] {
  const rng = seedRng((seed ^ Math.imul(wave, 0x9e3779b9)) >>> 0);
  const closed = new Set(data.raids?.hideouts.filter(h => raided.includes(h.id)).map(h => h.enemy));
  const unlocked = data.enemies.filter((e) => e.unlockWave <= wave && !closed.has(e.id));
  if (unlocked.length === 0)
    throw new Error(`no enemy types unlocked at wave ${wave}`);
  let budget = waveBudget(data, wave);
  const riddle =
    data.composer.riddleEvery > 0 && wave % data.composer.riddleEvery === 0;
  const pool: RawEnemyType[] = riddle
    ? [unlocked[nextInt(rng, unlocked.length)] as RawEnemyType]
    : unlocked;
  const minCost = Math.min(...pool.map((e) => e.budgetCost));
  const out: SpawnSpec[] = [];
  while (budget >= minCost && out.length < data.composer.maxEnemiesPerWave) {
    const affordable = pool.filter((e) => e.budgetCost <= budget);
    const pick = affordable[nextInt(rng, affordable.length)] as RawEnemyType;
    out.push({ type: pick.id, tier: 1 });
    budget -= pick.budgetCost;
  }
  const baseCost = out.reduce(
    (sum, e) => sum + data.enemyById.get(e.type)!.budgetCost,
    0,
  );
  if (baseCost) {
    const extra = Math.floor(budget / baseCost);
    for (const e of out) e.tier += extra;
    budget -= extra * baseCost;
    for (const e of out) {
      const cost = data.enemyById.get(e.type)!.budgetCost;
      if (budget >= cost) {
        e.tier++;
        budget -= cost;
      }
    }
  }
  return out;
}
