/**
 * Data model. Every tunable lives in JSON under /data and is loaded into GameData.
 * Rates are basis points; distances are cells (converted to fixed-point at derive time).
 */
import { cellsToFp, growBp, mulBp } from "./fixed.js";

export type DamageType =
  "kinetic" | "thermal" | "logic" | "burst" | "chain" | "scanner" | "support";
export type EnemyTag =
  | "armored"
  | "swift"
  | "fragmenting"
  | "airborne"
  | "stealth"
  | "healer"
  | "boss";

export interface RawGridConfig {
  width: number;
  height: number;
  /** Number of random obstacle cells placed by the generator. */
  obstacles: number;
}

export interface RawEconomy {
  startGold: number;
  lives: number;
  /** Ticks per second of the fixed step. */
  tickRate: number;
  /** Seconds between automatic wave starts. */
  waveIntervalSec: number;
  /** Gold per second remaining when calling a wave early. */
  earlyCallBonusPerSec: number;
  /** Interest on banked gold at wave start, basis points. */
  interestBp: number;
  /** Maximum bank eligible for interest, in gold. */
  interestCapGold: number;
  /** Bounty = bountyBase + bountyPerWave * wave. */
  bountyBase: number;
  bountyPerWave: number;
  /** Sell refund, basis points of cumulative spend. */
  sellRefundBp: number;
  /** Max waves in a run (win condition). */
  maxWaves: number;
}

export interface RawTowerType {
  /** Optional support coating; duration is fixed simulation ticks. */
  coating?: "wet" | "oil";
  coatingTicks?: number;
  /** Coat fresh targets first; ordinary priority breaks ties. Legacy defaults off. */
  preferFreshCoating?: boolean;
  id: string;
  damageType: DamageType;
  cost: number;
  /** Levels per tower (the ladder length L). */
  levels: number;
  /** Cost of level l = cost * costGrowthBp^(l-1). */
  costGrowthBp: number;
  damage: number;
  damageGrowthBp: number;
  rangeCells: number;
  rangeGrowthBp: number;
  /** Ticks between shots. */
  cooldownTicks: number;
  /**
   * Build-out synergy: damage bonus in basis points per orthogonally adjacent tower of the
   * same type. Lets some types scale by spreading while others scale by upgrading.
   */
  adjacencyBonusBp: number;
  /** Maximum targets per shot, including primary; splash radius in cells. */
  targets: number;
  splashCells: number;
  /** Movement multiplier in BP and effect duration in ticks. */
  slowBp: number;
  slowTicks: number;
  /** Damage bonus for other towers in range, additive BP. */
  auraBp: number;
}

export interface RawEnemyType {
  id: string;
  hp: number;
  /** Movement in fixed-point units per tick. */
  speedUpt: number;
  /** Budget units the composer pays for one of these. */
  budgetCost: number;
  /** First wave (1-based) on which the composer may pick this type. */
  unlockWave: number;
  tags: EnemyTag[];
}

export interface RawComposer {
  /** Optional explicit opening budgets; later waves use geometric growth. */
  openingBudgets?: number[];
  /** Budget of wave 1. */
  budgetBase: number;
  /** Budget growth per wave, basis points (10800 = +8%/wave). */
  growthBp: number;
  /** Every Nth wave is a riddle wave: one enemy type only. 0 disables. */
  riddleEvery: number;
  /** Ticks between spawns within a wave. */
  spawnIntervalTicks: number;
  /** HP multiplier applied per wave, basis points (10000 = none). */
  hpGrowthBp: number;
  /** Count cap; excess budget buys proportionally priced integer HP tiers. */
  maxEnemiesPerWave: number;
}

export type Difficulty = "easy" | "medium" | "hard";
export interface RawRelic {
  /** Weighted offer draw. Omitted preserves the legacy uniform draw. */
  offerWeight?: number;
  poisonDamageBp?: number;
  poisonTicks?: number;
  confusionDamageBp?: number;
  confusionTicks?: number;
  hitSlowBp?: number;
  hitSlowTicks?: number;
  /** Voluntary core cost on selection; cannot reduce core to zero. */
  sacrificeLives?: number;
  /** Conditional multiplicative damage while core is at/below this threshold. */
  lowLifeThreshold?: number;
  lowLifeDamageBp?: number;
  /** Added bank capacity; rate multiplier applies after all additive rates. */
  interestCapBonusGold?: number;
  interestRateMultiplierBp?: number;
  /** On-kill explosion: fraction of killed enemy max HP, additive across stacks. */
  deathBurstBp?: number;
  /** Explosion radius in fixed-point cell units. */
  deathBurstRadiusFp?: number;
  id: string;
  name: string;
  description: string;
  damageType: DamageType | "all";
  damageBp: number;
  slowDamageBp: number;
  interestBp: number;
}

export interface RawGameData {
  effectRules?: {
    minSlowBp: number;
    poisonStackCap: number;
    confusionIntervalTicks: number;
    confusionRadiusFp: number;
    wetLightningBp: number;
    wetSlowBp: number;
    oilHitBp: number;
    oilBurnBp: number;
    oilBurnTicks: number;
  };
  /** Optional raid prototype. Absent for legacy replays. */
  raids?: {
    /** Additive enemy HP increase per cleared hideout; 3500 = +35%. */
    hpPerRaidBp: number;
    /** Additive spawn-rate increase per cleared hideout. */
    hastePerRaidBp: number;
    hideouts: { id: string; name: string; enemy: string; gold: number }[];
  };
  version: string;
  grid: RawGridConfig;
  economy: RawEconomy;
  towers: RawTowerType[];
  enemies: RawEnemyType[];
  composer: RawComposer;
  /** Difficulty moves affordability, never enemy stats. */
  difficulties: Record<
    Difficulty,
    { defenseCostBp: number; description: string }
  >;
  damageMatrix: Record<DamageType, Partial<Record<EnemyTag, number>>>;
  /** Unrevealed stealth enemies take this fraction of incoming damage. */
  stealthDamageBp: number;
  relics: RawRelic[];
  relicRules: {
    /** Additive-effect bonus per previous copy, BP; 500 = +5% per copy. */
    stackBonusBp?: number;
    rerollBaseGold?: number;
    rerollGrowthBp?: number;
    maxRerolls?: number;
    /** First offer wave; subsequent offers are everyWaves apart. Legacy defaults to everyWaves. */
    firstOfferWave?: number;
    /** Independent loot-stream experiment offset; does not alter boards/waves. */
    offerSeedOffset?: number;
    everyWaves: number;
    offerCount: number;
    responseBp: number;
    godPowerBp: number;
  };
  /** Bot evaluation only; ticks are simulated time at 1x, misses are BP. */
  playerProfiles?: Record<
    string,
    { decisionTicks: number; maxActions: number; missChanceBp: number }
  >;
}

export interface TowerLevel {
  /** Cost to reach this level from the previous one (level 1 = build cost). */
  cost: number;
  damage: number;
  /** Fixed-point range. */
  rangeFp: number;
  cooldownTicks: number;
}

export interface TowerType extends RawTowerType {
  /** Index 0 is level 1. */
  ladder: TowerLevel[];
}

export interface GameData extends RawGameData {
  towers: TowerType[];
  towerById: Map<string, TowerType>;
  enemyById: Map<string, RawEnemyType>;
  waveIntervalTicks: number;
}

export function deriveData(raw: RawGameData): GameData {
  validateData(raw);
  const towers: TowerType[] = raw.towers.map((t) => {
    const ladder: TowerLevel[] = [];
    for (let l = 0; l < t.levels; l++) {
      ladder.push({
        cost: growBp(t.cost, t.costGrowthBp, l),
        damage: growBp(t.damage, t.damageGrowthBp, l),
        rangeFp: growBp(cellsToFp(t.rangeCells), t.rangeGrowthBp, l),
        cooldownTicks: t.cooldownTicks,
      });
    }
    return { ...t, ladder };
  });
  return {
    ...raw,
    towers,
    towerById: new Map(towers.map((t) => [t.id, t])),
    enemyById: new Map(raw.enemies.map((e) => [e.id, e])),
    waveIntervalTicks: raw.economy.waveIntervalSec * raw.economy.tickRate,
  };
}

export function enemyHpAtWave(
  data: GameData,
  type: RawEnemyType,
  wave: number,
): number {
  return Math.max(1, growBp(type.hp, data.composer.hpGrowthBp, wave - 1));
}

export { mulBp };

export function withDifficulty(
  raw: RawGameData,
  difficulty: Difficulty,
): RawGameData {
  const copy = JSON.parse(JSON.stringify(raw)) as RawGameData;
  const preset = copy.difficulties[difficulty];
  if (!preset) throw new Error("unknown difficulty");
  copy.version += `/${difficulty}`;
  for (const t of copy.towers)
    t.cost = Math.max(1, mulBp(t.cost, preset.defenseCostBp));
  return copy;
}

export function rawData(data: GameData): RawGameData {
  const { towerById: _t, enemyById: _e, waveIntervalTicks: _w, ...raw } = data;
  return { ...raw, towers: raw.towers.map(({ ladder: _l, ...t }) => t) };
}

/** Validate before entering loops, including when loading imported replay data. */
export function validateData(raw: RawGameData): void {
  const int = (v: number, lo: number, hi: number, name: string): void => {
    if (!Number.isSafeInteger(v) || v < lo || v > hi)
      throw new Error(`invalid ${name}`);
  };
  if (!raw || typeof raw.version !== "string")
    throw new Error("invalid data version");
  int(raw.grid.width, 4, 40, "width");
  int(raw.grid.height, 4, 30, "height");
  int(raw.grid.obstacles, 0, raw.grid.width * raw.grid.height - 2, "obstacles");
  int(raw.economy.tickRate, 20, 20, "tickRate (must be 20 Hz)");
  for (const key of ["startGold", "lives", "tickRate", "waveIntervalSec", "earlyCallBonusPerSec", "interestBp", "interestCapGold", "bountyBase", "bountyPerWave", "sellRefundBp", "maxWaves"] as const)
    int(raw.economy[key], 0, 100000, `economy.${key}`);
  int(raw.economy.sellRefundBp, 0, 10000, "sell refund");
  int(raw.economy.interestCapGold, 0, 100000, "interest cap");
  int(raw.economy.maxWaves, 1, 60, "maxWaves");
  int(raw.economy.lives, 1, 1000, "lives");
  int(raw.composer.maxEnemiesPerWave, 1, 100, "enemy cap");
  int(raw.composer.budgetBase, 1, 10000, "budgetBase");
  int(raw.composer.growthBp, 10000, 12000, "growthBp");
  int(raw.composer.hpGrowthBp, 10000, 11000, "hpGrowthBp");
  int(raw.composer.spawnIntervalTicks, 1, 200, "spawnIntervalTicks");
  int(raw.composer.riddleEvery, 0, 100, "riddleEvery");
  if (raw.composer.openingBudgets !== undefined) {
    if (!Array.isArray(raw.composer.openingBudgets) || raw.composer.openingBudgets.length > raw.economy.maxWaves)
      throw new Error("invalid opening budgets");
    for (const budget of raw.composer.openingBudgets) int(budget, 10, 100000, "opening budget");
  }
  if (raw.raids) {
    int(raw.raids.hpPerRaidBp, 0, 10000, "raid HP");
    int(raw.raids.hastePerRaidBp, 0, 10000, "raid haste");
    const hideouts = raw.raids.hideouts;
    if (!Array.isArray(hideouts) || hideouts.length < 1 || hideouts.length > 5 || new Set(hideouts.map(h => h.id)).size !== hideouts.length)
      throw new Error("invalid hideouts");
    for (const h of hideouts) {
      if (!/^[a-z][a-z0-9-]*$/.test(h.id) || typeof h.name !== "string" || h.name.length > 60 || !raw.enemies.some(e => e.id === h.enemy))
        throw new Error("invalid hideout");
      int(h.gold, 1, 1000, "raid gold");
    }
    if (!raw.enemies.some(e => e.unlockWave === 1 && !hideouts.some(h => h.enemy === e.id)))
      throw new Error("raids must leave an opening enemy source");
  }
  if (!raw.towers.length || !raw.enemies.some((e) => e.unlockWave === 1))
    throw new Error("empty tower/enemy pool");
  for (const list of [raw.towers, raw.enemies, raw.relics]) {
    if (!Array.isArray(list) || list.length > 100) throw new Error("invalid content list");
    if (
      new Set(list.map((x) => x.id)).size !== list.length ||
      list.some((x) => !/^[a-z][a-z0-9-]*$/.test(x.id))
    )
      throw new Error("invalid/duplicate ids");
  }
  const damageTypes = ["kinetic", "thermal", "logic", "burst", "chain", "scanner", "support"];
  const enemyTags = ["armored", "swift", "fragmenting", "airborne", "stealth", "healer", "boss"];
  for (const t of raw.towers) {
    if (t.preferFreshCoating !== undefined && (typeof t.preferFreshCoating !== "boolean" || !t.coating)) throw new Error("fresh targeting needs a coating");
    if (t.coating !== undefined && !["wet", "oil"].includes(t.coating)) throw new Error("invalid coating");
    int(t.coatingTicks ?? 0, 0, 1000, "coating duration");
    if (t.coating && !t.coatingTicks) throw new Error("coating needs a duration");
    if (t.coating && !raw.effectRules) throw new Error("coating needs effect rules");
    if (!damageTypes.includes(t.damageType)) throw new Error("unknown damage type");
    int(t.cost, 1, 10000, "tower cost");
    int(t.damage, 1, 10000, "damage");
    int(t.levels, 1, 10, "levels");
    int(t.cooldownTicks, 1, 200, "cooldown");
    int(t.targets, 1, 20, "targets");
    int(t.slowBp, 1000, 10000, "slowBp");
    int(t.slowTicks, 0, 1000, "slowTicks");
    int(t.auraBp, 0, 10000, "auraBp");
    for (const v of [t.costGrowthBp, t.damageGrowthBp, t.rangeGrowthBp])
      int(v, 10000, 25000, "tower growth");
    for (const v of [t.rangeCells, t.splashCells])
      if (!Number.isFinite(v) || v < 0 || v > 20 || !Number.isInteger(v * 1024))
        throw new Error("invalid range");
    int(t.adjacencyBonusBp, 0, 10000, "adjacencyBonusBp");
    if (!raw.damageMatrix[t.damageType])
      throw new Error("missing damage matrix row");
  }
  for (const e of raw.enemies) {
    int(e.hp, 1, 100000, "enemy hp");
    int(e.speedUpt, 1, 1024, "speed");
    int(e.budgetCost, 1, 10000, "budgetCost");
    int(e.unlockWave, 1, 60, "unlockWave");
    if (!Array.isArray(e.tags) || e.tags.length > 7 || new Set(e.tags).size !== e.tags.length || e.tags.some(tag => !enemyTags.includes(tag))) throw new Error("invalid tags");
  }
  for (const row of Object.values(raw.damageMatrix))
    for (const bp of Object.values(row)) int(bp, 1000, 50000, "matrix");
  int(raw.stealthDamageBp, 1000, 10000, "stealth damage");
  for (const name of ["easy", "medium", "hard"] as const)
    int(raw.difficulties[name].defenseCostBp, 1000, 30000, "difficulty");
  int(raw.relicRules.everyWaves, 0, 60, "relic interval");
  int(raw.relicRules.stackBonusBp ?? 0, 0, 1000, "stack bonus");
  if (raw.relicRules.rerollBaseGold !== undefined) {
    int(raw.relicRules.rerollBaseGold, 1, 1000, "reroll base");
    int(raw.relicRules.rerollGrowthBp!, 10000, 20000, "reroll growth");
    int(raw.relicRules.maxRerolls!, 1, 5, "max rerolls");
  }
  if (raw.effectRules) {
    int(raw.effectRules.minSlowBp, 1000, 10000, "minimum slow");
    int(raw.effectRules.poisonStackCap, 1, 20, "poison cap");
    int(raw.effectRules.confusionIntervalTicks, 1, 200, "confusion interval");
    int(raw.effectRules.confusionRadiusFp, 1, 5 * 1024, "confusion radius");
    int(raw.effectRules.wetLightningBp, 10000, 30000, "wet lightning");
    int(raw.effectRules.wetSlowBp, 1000, 10000, "wet slow");
    int(raw.effectRules.oilHitBp, 10000, 30000, "oil hit");
    int(raw.effectRules.oilBurnBp, 0, 20000, "oil burn");
    int(raw.effectRules.oilBurnTicks, 1, 1000, "burn duration");
  }
  if (raw.relicRules.firstOfferWave !== undefined) int(raw.relicRules.firstOfferWave, 1, raw.economy.maxWaves, "first offer wave");
  if (raw.relicRules.offerSeedOffset !== undefined) int(raw.relicRules.offerSeedOffset, 0, 0xffffffff, "offer seed offset");
  int(
    raw.relicRules.offerCount,
    1,
    Math.max(1, raw.relics.length),
    "offer count",
  );
  int(raw.relicRules.responseBp, 0, 10000, "relic response");
  int(raw.relicRules.godPowerBp, 10000, 1000000, "god power");
  for (const r of raw.relics) {
    if (r.offerWeight !== undefined) int(r.offerWeight, 1, 100, "offer weight");
    int(r.poisonDamageBp ?? 0, 0, 20000, "poison damage");
    int(r.poisonTicks ?? 0, 0, 1000, "poison duration");
    int(r.confusionDamageBp ?? 0, 0, 10000, "confusion damage");
    int(r.confusionTicks ?? 0, 0, 1000, "confusion duration");
    int(r.hitSlowBp ?? 10000, 1000, 10000, "hit slow");
    int(r.hitSlowTicks ?? 0, 0, 1000, "hit slow duration");
    if ((r.poisonDamageBp && !r.poisonTicks) || (r.confusionDamageBp && !r.confusionTicks) || ((r.hitSlowBp ?? 10000) < 10000 && !r.hitSlowTicks)) throw new Error("status effect needs duration");
    if ((r.poisonDamageBp || r.confusionDamageBp || r.hitSlowTicks) && !raw.effectRules) throw new Error("status effect needs rules");
    int(r.sacrificeLives ?? 0, 0, 100, "sacrifice lives");
    int(r.lowLifeThreshold ?? 0, 0, raw.economy.lives, "low life threshold");
    int(r.lowLifeDamageBp ?? 10000, 10000, 30000, "low life damage");
    int(r.interestCapBonusGold ?? 0, 0, 1000, "interest cap bonus");
    int(r.interestRateMultiplierBp ?? 10000, 10000, 20000, "interest rate multiplier");
    if ((r.lowLifeDamageBp ?? 10000) > 10000 && !r.lowLifeThreshold) throw new Error("low life damage needs a threshold");
    int(r.deathBurstBp ?? 0, 0, 10000, "death burst");
    int(r.deathBurstRadiusFp ?? 0, 0, 5 * 1024, "death burst radius");
    if (r.deathBurstBp && !r.deathBurstRadiusFp) throw new Error("death burst needs a radius");
    if (typeof r.name !== "string" || typeof r.description !== "string" || r.name.length > 100 || r.description.length > 1000) throw new Error("invalid relic text");
    if (r.damageType !== "all" && !damageTypes.includes(r.damageType)) throw new Error("invalid relic damage type");
    int(r.damageBp, 10000, 20000, "relic damage");
    int(r.slowDamageBp, 10000, 20000, "relic slow damage");
    int(r.interestBp, 0, 1000, "relic interest");
  }
  for (const p of Object.values(raw.playerProfiles ?? {})) {
    int(p.decisionTicks, 1, 1200, "decision ticks");
    int(p.maxActions, 1, 10, "actions per decision");
    int(p.missChanceBp, 0, 10000, "miss chance");
  }
  // Conservatively bound multiplicative configurations before fixed-point number
  // math could exceed exact integer precision. BigInt is validation-only.
  const grow = (value: bigint, bp: number, n = 1): bigint => {
    for (let i = 0; i < n; i++) value = (value * BigInt(bp) + 9999n) / 10000n;
    return value;
  };
  const max = (values: bigint[]): bigint => values.reduce((a, b) => a > b ? a : b, 1n);
  const firstOffer = raw.relicRules.firstOfferWave ?? raw.relicRules.everyWaves;
  const offers = raw.relicRules.everyWaves ? Math.max(0, 1 + Math.floor((raw.economy.maxWaves - 1 - firstOffer) / raw.relicRules.everyWaves)) : 0;
  const maxRelicDamage = Math.max(10000, ...raw.relics.map(r => r.damageBp));
  const maxRelicSlow = Math.max(10000, ...raw.relics.map(r => r.slowDamageBp));
  let damage = max(raw.towers.map(t => grow(BigInt(t.damage), t.damageGrowthBp, t.levels - 1)));
  damage = grow(damage, 10000 + 4 * Math.max(...raw.towers.map(t => t.adjacencyBonusBp)));
  damage = grow(damage, 10000 + Math.max(...raw.towers.map(t => t.auraBp * t.levels)));
  damage = grow(grow(damage, maxRelicDamage, offers), maxRelicSlow, offers);
  damage = grow(damage, Math.max(10000, ...raw.relics.map(r => r.lowLifeDamageBp ?? 10000)), offers);
  const maxMatrix = Math.max(10000, ...Object.values(raw.damageMatrix).flatMap(row => Object.values(row)));
  damage = grow(damage, maxMatrix, Math.max(...raw.enemies.map(e => e.tags.length)));
  const directDamage = damage;
  const budget = max([grow(BigInt(raw.composer.budgetBase), raw.composer.growthBp, raw.economy.maxWaves - 1), ...(raw.composer.openingBudgets ?? []).map(BigInt)]);
  let hp = max(raw.enemies.map(e => grow(BigInt(e.hp), raw.composer.hpGrowthBp, raw.economy.maxWaves - 1))) * budget;
  if (raw.relicRules.responseBp) hp = grow(hp, maxRelicDamage, offers);
  hp = grow(hp, 10000 + (raw.raids?.hpPerRaidBp ?? 0) * (raw.raids?.hideouts.length ?? 0));
  damage = max([damage, hp * BigInt(Math.max(1, offers))]);
  const rate = grow(BigInt(raw.economy.interestBp + offers * Math.max(0, ...raw.relics.map(r => r.interestBp))), Math.max(10000, ...raw.relics.map(r => r.interestRateMultiplierBp ?? 10000)), offers);
  const bankCap = BigInt(raw.economy.interestCapGold + offers * Math.max(0, ...raw.relics.map(r => r.interestCapBonusGold ?? 0)));
  const interestIncome = rate * bankCap * BigInt(raw.economy.maxWaves) / 10000n;
  if (max([damage, hp, interestIncome]) * 100000n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("configuration exceeds safe fixed-point bounds");

  // Status rates are BP-scaled damage, not ordinary HP. Bound their actual
  // intermediate products separately, including duplicate-copy kickers and the
  // post-coating hit that seeds poison. Phase-safe ticking never multiplies a
  // DPT by elapsed ticks, so legitimately large safe rates remain admissible.
  const additive = (key: "poisonDamageBp" | "confusionDamageBp" | "deathBurstBp"): bigint => {
    const base = BigInt(Math.max(0, ...raw.relics.map(r => r[key] ?? 0)));
    let total = 0n;
    for (let copy = 0; copy < offers; copy++)
      total += (base * BigInt(10000 + copy * (raw.relicRules.stackBonusBp ?? 0)) + 9999n) / 10000n;
    return total;
  };
  const effectProducts = [hp * additive("deathBurstBp") + 5000n];
  if (raw.effectRules) {
    const rules = raw.effectRules;
    const coatingBp = Math.max(10000, rules.wetLightningBp, rules.oilHitBp);
    const coatedDamage = grow(directDamage, coatingBp);
    effectProducts.push(directDamage * BigInt(coatingBp) + 5000n, hp * additive("confusionDamageBp") + 5000n);
    const poisonNumerator = coatedDamage * additive("poisonDamageBp");
    const duration = BigInt(Math.min(1000, ...raw.relics.filter(r => r.poisonDamageBp).map(r => r.poisonTicks!)));
    const dose = (poisonNumerator + duration - 1n) / duration;
    // The unclipped current+incoming expression is evaluated before Math.min.
    effectProducts.push(poisonNumerator, dose * BigInt(rules.poisonStackCap + 1));
    // Oil burn uses damage before the oil direct-hit multiplier. Its numerator
    // is nevertheless a separate checked product from rounded mulBp damage.
    effectProducts.push(directDamage * BigInt(rules.oilBurnBp));
  }
  if (max(effectProducts) > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("configuration exceeds safe fixed-point bounds (status/coating)");
}
