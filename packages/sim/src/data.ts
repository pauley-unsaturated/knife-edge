/**
 * Data model. Every tunable lives in JSON under /data and is loaded into GameData.
 * Rates are basis points; distances are cells (converted to fixed-point at derive time).
 */
import { cellsToFp, growBp, mulBp } from "./fixed.js";

export type DamageType = "kinetic" | "thermal" | "logic" | "burst" | "chain" | "scanner" | "support";
export type EnemyTag = "armored" | "swift" | "fragmenting" | "airborne" | "stealth" | "healer" | "boss";

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
  /** Bounty = bountyBase + bountyPerWave * wave. */
  bountyBase: number;
  bountyPerWave: number;
  /** Sell refund, basis points of cumulative spend. */
  sellRefundBp: number;
  /** Max waves in a run (win condition). */
  maxWaves: number;
}

export interface RawTowerType {
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
}

export interface RawGameData {
  version: string;
  grid: RawGridConfig;
  economy: RawEconomy;
  towers: RawTowerType[];
  enemies: RawEnemyType[];
  composer: RawComposer;
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

export function enemyHpAtWave(data: GameData, type: RawEnemyType, wave: number): number {
  return Math.max(1, growBp(type.hp, data.composer.hpGrowthBp, wave - 1));
}

export { mulBp };
