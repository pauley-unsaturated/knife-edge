/**
 * The simulation core. `step(state, commands)` advances exactly one fixed tick.
 * No wall-clock, no floats, no I/O. A run is fully described by (data, seed, commands).
 */
import type { GameData, RawEnemyType, TowerType } from "./data.js";
import { enemyHpAtWave } from "./data.js";
import { composeWave, type SpawnSpec } from "./composer.js";
import { SCALE, mulBp } from "./fixed.js";
import {
  UNREACHABLE,
  distanceField,
  generateGrid,
  neighbours,
  nextStep,
  xOf,
  yOf,
  type Cell,
  type Grid,
} from "./grid.js";
import { cloneRng, nextInt, seedRng, type RngState } from "./rng.js";
import { rerollCost, rollOffers, stackedRelics } from "./drops.js";
import { coatingHit, tickBurn } from "./combos.js";
import { applyOnHitEffects, tickEffects } from "./effects.js";

export interface Enemy {
  /** Optional status fields; DPT uses BP fixed-point damage per tick. */
  poisonDpt?: number;
  poisonUntil?: number;
  poisonStacks?: number;
  confusedUntil?: number;
  confusionDamageBp?: number;
  confusionNextTick?: number;
  wetUntil?: number;
  oiledUntil?: number;
  burnDpt?: number;
  burnUntil?: number;
  id: number;
  type: string;
  hp: number;
  maxHp: number;
  cell: Cell;
  /** Next cell toward the core, or -1 when standing on the core. */
  next: Cell;
  /** Fixed-point progress from `cell` toward `next`, 0..SCALE. */
  progress: number;
  slowBp: number;
  slowUntil: number;
  revealedUntil: number;
}

export type TargetPriority = "first" | "last" | "strongest" | "weakest";

export interface Tower {
  cell: Cell;
  type: string;
  /** 1-based level. */
  level: number;
  /** Cumulative gold spent (for sell refunds). */
  spent: number;
  /** Ticks until it may fire again. */
  cooldown: number;
  priority: TargetPriority;
}

export type Command =
  | { kind: "reroll" }
  | { kind: "raid"; id: string }
  | { kind: "build"; cell: Cell; type: string }
  | { kind: "upgrade"; cell: Cell }
  | { kind: "sell"; cell: Cell }
  | { kind: "target"; cell: Cell; priority: TargetPriority }
  | { kind: "pickRelic"; id: string }
  | { kind: "callWave" };

export interface TimedCommand {
  tick: number;
  cmd: Command;
}

export type Event =
  | { kind: "reroll"; gold: number; count: number }
  | { kind: "raid"; id: string; gold: number; heat: number }
  | { kind: "burst"; cell: Cell; radiusFp: number }
  | {
      kind: "waveStart";
      wave: number;
      interest: number;
      earlyBonus: number;
      count: number;
    }
  | { kind: "waveEnd"; wave: number }
  | { kind: "spawn"; enemy: number; type: string }
  | { kind: "hit"; tower: Cell; enemy: number; damage: number }
  | { kind: "kill"; enemy: number; bounty: number }
  | { kind: "leak"; enemy: number }
  | { kind: "build"; cell: Cell; type: string }
  | { kind: "upgrade"; cell: Cell; level: number }
  | { kind: "sell"; cell: Cell; refund: number }
  | { kind: "rejected"; cmd: Command; reason: string }
  | { kind: "won" }
  | { kind: "lost" };

export interface Stats {
  kills: number;
  leaks: number;
  goldEarned: number;
  goldSpent: number;
  interestEarned: number;
  earlyBonusEarned: number;
  wavesCleared: number;
}

export interface State {
  offerRerolls?: number;
  /** Only present in raid-enabled runs, preserving legacy replay hashes. */
  raided?: string[];
  seed: number;
  tick: number;
  rng: RngState;
  grid: Grid;
  /** obstacles + towers */
  blocked: Uint8Array;
  dist: Int32Array;
  gold: number;
  lives: number;
  /** Index of the current or last wave (0 before the first). */
  wave: number;
  /** Ticks until the next wave auto-starts (counts down between waves). */
  waveTimer: number;
  inWave: boolean;
  spawnQueue: SpawnSpec[];
  spawnCooldown: number;
  nextEnemyId: number;
  enemies: Enemy[];
  towers: Tower[];
  relics: string[];
  relicOffers: string[];
  stats: Stats;
  outcome: "playing" | "won" | "lost";
}

export function createState(data: GameData, seed: number): State {
  const rng = seedRng(seed);
  const grid = generateGrid(
    rng,
    data.grid.width,
    data.grid.height,
    data.grid.obstacles,
  );
  const blocked = new Uint8Array(grid.obstacle);
  return {
    ...(data.raids ? { raided: [] } : {}),
    ...(data.relicRules.rerollBaseGold !== undefined ? { offerRerolls: 0 } : {}),
    seed,
    tick: 0,
    rng,
    grid,
    blocked,
    dist: distanceField(grid, blocked),
    gold: data.economy.startGold,
    lives: data.economy.lives,
    wave: 0,
    waveTimer: data.waveIntervalTicks,
    inWave: false,
    spawnQueue: [],
    spawnCooldown: 0,
    nextEnemyId: 1,
    enemies: [],
    towers: [],
    relics: [],
    relicOffers: [],
    stats: {
      kills: 0,
      leaks: 0,
      goldEarned: 0,
      goldSpent: 0,
      interestEarned: 0,
      earlyBonusEarned: 0,
      wavesCleared: 0,
    },
    outcome: "playing",
  };
}

export function towerAt(s: State, cell: Cell): Tower | undefined {
  return s.towers.find((t) => t.cell === cell);
}

/**
 * Building is legal when the cell is free and, with it blocked, the entry and every live
 * enemy (current and next cell) can still reach the core. No full blocks, no trapping.
 */
export function canBuild(
  s: State,
  cell: Cell,
): { ok: true } | { ok: false; reason: string } {
  const g = s.grid;
  if (!Number.isInteger(cell) || cell < 0 || cell >= g.width * g.height)
    return { ok: false, reason: "out of bounds" };
  if (cell === g.entry || cell === g.core)
    return { ok: false, reason: "entry/core" };
  if (s.blocked[cell]) return { ok: false, reason: "occupied" };
  for (const e of s.enemies)
    if (e.cell === cell || e.next === cell)
      return { ok: false, reason: "enemy present" };
  s.blocked[cell] = 1;
  const dist = distanceField(g, s.blocked);
  s.blocked[cell] = 0;
  if ((dist[g.entry] as number) >= UNREACHABLE)
    return { ok: false, reason: "would block path" };
  for (const e of s.enemies)
    if ((dist[e.cell] as number) >= UNREACHABLE)
      return { ok: false, reason: "would trap enemy" };
  return { ok: true };
}

function rebuildDistances(s: State): void {
  s.dist = distanceField(s.grid, s.blocked);
  for (const e of s.enemies) {
    if (e.cell === s.grid.core) continue;
    const n = nextStep(s.grid, s.dist, e.cell);
    if (n !== e.next) {
      e.next = n;
    }
  }
}

function applyCommand(
  data: GameData,
  s: State,
  cmd: Command,
  events: Event[],
): void {
  const reject = (reason: string): void => {
    events.push({ kind: "rejected", cmd, reason });
  };
  switch (cmd.kind) {
    case "reroll": {
      const cost = rerollCost(data, s);
      if (!s.relicOffers.length || s.inWave) return reject("reroll between waves while choosing a drop");
      if (cost === null) return reject("no rerolls remaining");
      if (s.gold < cost) return reject("not enough gold to reroll");
      s.gold -= cost;
      s.stats.goldSpent += cost;
      s.offerRerolls = (s.offerRerolls ?? 0) + 1;
      s.relicOffers = rollOffers(data, s.seed, s.wave, s.offerRerolls);
      events.push({ kind: "reroll", gold: cost, count: s.offerRerolls });
      return;
    }
    case "raid": {
      const hideout = data.raids?.hideouts.find(h => h.id === cmd.id);
      if (!hideout || !s.raided) return reject("unknown hideout");
      if (s.inWave || s.wave < 1 || s.wave >= data.economy.maxWaves)
        return reject("raid between waves after wave 1");
      if (s.raided.includes(cmd.id)) return reject("hideout already raided");
      s.raided.push(cmd.id);
      s.gold += hideout.gold;
      s.stats.goldEarned += hideout.gold;
      events.push({ kind: "raid", id: cmd.id, gold: hideout.gold, heat: s.raided.length });
      return;
    }
    case "build": {
      const type = data.towerById.get(cmd.type);
      if (!type) return reject("unknown tower type");
      const cost = (type.ladder[0] as { cost: number }).cost;
      if (s.gold < cost) return reject("not enough gold");
      const check = canBuild(s, cmd.cell);
      if (!check.ok) return reject(check.reason);
      s.gold -= cost;
      s.stats.goldSpent += cost;
      s.blocked[cmd.cell] = 1;
      s.towers.push({
        cell: cmd.cell,
        type: type.id,
        level: 1,
        spent: cost,
        cooldown: 0,
        priority: "first",
      });
      rebuildDistances(s);
      events.push({ kind: "build", cell: cmd.cell, type: type.id });
      return;
    }
    case "upgrade": {
      const t = towerAt(s, cmd.cell);
      if (!t) return reject("no tower");
      const type = data.towerById.get(t.type) as TowerType;
      if (t.level >= type.levels) return reject("max level");
      const cost = (type.ladder[t.level] as { cost: number }).cost;
      if (s.gold < cost) return reject("not enough gold");
      s.gold -= cost;
      s.stats.goldSpent += cost;
      t.spent += cost;
      t.level++;
      events.push({ kind: "upgrade", cell: t.cell, level: t.level });
      return;
    }
    case "sell": {
      const idx = s.towers.findIndex((t) => t.cell === cmd.cell);
      if (idx < 0) return reject("no tower");
      const t = s.towers[idx] as Tower;
      const refund = mulBp(t.spent, data.economy.sellRefundBp);
      s.gold += refund;
      s.towers.splice(idx, 1);
      s.blocked[t.cell] = 0;
      rebuildDistances(s);
      events.push({ kind: "sell", cell: t.cell, refund });
      return;
    }
    case "target": {
      const t = towerAt(s, cmd.cell);
      if (
        !t ||
        !["first", "last", "strongest", "weakest"].includes(cmd.priority)
      )
        return reject("invalid target priority");
      t.priority = cmd.priority;
      return;
    }
    case "pickRelic": {
      if (!s.relicOffers.includes(cmd.id)) return reject("relic not offered");
      const sacrifice = data.relics.find(r => r.id === cmd.id)!.sacrificeLives ?? 0;
      if (s.lives <= sacrifice) return reject("not enough core for this pact");
      s.lives -= sacrifice;
      s.relics.push(cmd.id);
      s.relicOffers = [];
      return;
    }
    case "callWave": {
      if (s.inWave) return reject("wave in progress");
      startWave(data, s, events, s.waveTimer);
      return;
    }
  }
}

function startWave(
  data: GameData,
  s: State,
  events: Event[],
  ticksRemaining: number,
): void {
  const wave = s.wave + 1;
  // Early-call bonus is paid BEFORE the interest tick (ADR-0012).
  const earlyBonus = Math.floor(
    (ticksRemaining * data.economy.earlyCallBonusPerSec) /
      data.economy.tickRate,
  );
  s.gold += earlyBonus;
  s.stats.earlyBonusEarned += earlyBonus;
  const interest = interestAtStart(data, s);
  s.gold += interest;
  s.stats.interestEarned += interest;
  s.stats.goldEarned += earlyBonus + interest;
  s.wave = wave;
  s.inWave = true;
  s.waveTimer = 0;
  s.spawnQueue = composeWave(data, s.seed, wave, s.raided);
  s.spawnCooldown = 0;
  events.push({
    kind: "waveStart",
    wave,
    interest,
    earlyBonus,
    count: s.spawnQueue.length,
  });
}

export function interestAtStart(data: GameData, s: State, bonus = 0): number {
  const { rate, cap } = interestTerms(data, s);
  return mulBp(Math.min(s.gold + bonus, cap), rate);
}

export function interestTerms(data: GameData, s: Pick<State, "relics">): { rate: number; cap: number } {
  let rate = s.relics.reduce(
    (bp, id) => bp + data.relics.find((r) => r.id === id)!.interestBp,
    data.economy.interestBp,
  );
  let cap = data.economy.interestCapGold;
  for (const id of s.relics) {
    const r = data.relics.find(r => r.id === id)!;
    rate = mulBp(rate, r.interestRateMultiplierBp ?? 10000);
    cap += r.interestCapBonusGold ?? 0;
  }
  return { rate, cap };
}

export function heatHpBp(data: GameData, s: Pick<State, "raided">): number {
  return 10000 + (s.raided?.length ?? 0) * (data.raids?.hpPerRaidBp ?? 0);
}

export function spawnInterval(data: GameData, s: Pick<State, "raided">): number {
  return Math.max(1, Math.floor(data.composer.spawnIntervalTicks * 10000 /
    (10000 + (s.raided?.length ?? 0) * (data.raids?.hastePerRaidBp ?? 0))));
}

/** Unconditional relic power; conditional slow synergy is reported separately by playtests. */
export function relicPowerBp(data: GameData, s: State): number {
  let best = 10000;
  for (const t of data.towers) {
    let power = 10000;
    for (const id of s.relics) {
      const r = data.relics.find((r) => r.id === id)!;
      if (r.damageType === "all" || r.damageType === t.damageType)
        power = mulBp(power, r.damageBp);
    }
    best = Math.max(best, power);
  }
  return best;
}

function spawn(
  data: GameData,
  s: State,
  spec: SpawnSpec,
  events: Event[],
): void {
  const typeId = spec.type;
  const type = data.enemyById.get(typeId) as RawEnemyType;
  const response =
    10000 + mulBp(relicPowerBp(data, s) - 10000, data.relicRules.responseBp);
  const hp = mulBp(mulBp(enemyHpAtWave(data, type, s.wave) * spec.tier, response), heatHpBp(data, s));
  const e: Enemy = {
    id: s.nextEnemyId++,
    type: typeId,
    hp,
    maxHp: hp,
    cell: s.grid.entry,
    next: nextStep(s.grid, s.dist, s.grid.entry),
    progress: 0,
    slowBp: 10000,
    slowUntil: 0,
    revealedUntil: 0,
  };
  s.enemies.push(e);
  events.push({ kind: "spawn", enemy: e.id, type: typeId });
}

/** Fixed-point position of an enemy (x, y in 1/SCALE cells, cell centres at .5). */
export function enemyPos(s: State, e: Enemy): { x: number; y: number } {
  const g = s.grid;
  const cx = xOf(g, e.cell) * SCALE + SCALE / 2;
  const cy = yOf(g, e.cell) * SCALE + SCALE / 2;
  if (e.next < 0) return { x: cx, y: cy };
  const nx = xOf(g, e.next) * SCALE + SCALE / 2;
  const ny = yOf(g, e.next) * SCALE + SCALE / 2;
  return {
    x: cx + Math.floor(((nx - cx) * e.progress) / SCALE),
    y: cy + Math.floor(((ny - cy) * e.progress) / SCALE),
  };
}

/** Remaining distance to the core in fixed-point cells; the "first" targeting key. */
function distanceToCore(s: State, e: Enemy): number {
  if (e.next < 0) return 0;
  return (s.dist[e.next] as number) * SCALE + (SCALE - e.progress);
}

function moveEnemies(data: GameData, s: State, events: Event[]): void {
  const survivors: Enemy[] = [];
  for (const e of s.enemies) {
    const type = data.enemyById.get(e.type) as RawEnemyType;
    let leaked = false;
    if (e.next >= 0) {
      e.progress +=
        s.tick < e.slowUntil ? mulBp(type.speedUpt, e.slowBp) : type.speedUpt;
      while (e.progress >= SCALE) {
        e.progress -= SCALE;
        e.cell = e.next;
        if (e.cell === s.grid.core) {
          leaked = true;
          break;
        }
        e.next = nextStep(s.grid, s.dist, e.cell);
        if (e.next < 0) break;
      }
    } else if (e.cell === s.grid.core) {
      leaked = true;
    }
    if (leaked) {
      s.lives--;
      s.stats.leaks++;
      events.push({ kind: "leak", enemy: e.id });
    } else {
      survivors.push(e);
    }
  }
  s.enemies = survivors;
}

export function towerDamage(data: GameData, s: State, t: Tower): number {
  const type = data.towerById.get(t.type) as TowerType;
  const base = (type.ladder[t.level - 1] as { damage: number }).damage;
  let adjacent = 0;
  for (const nb of neighbours(s.grid, t.cell)) {
    const other = towerAt(s, nb);
    if (other && other.type === t.type) adjacent++;
  }
  let damage = mulBp(base, 10000 + adjacent * type.adjacencyBonusBp);
  // Auras use the strongest nearby source; no unbounded all-to-all aura stacking.
  let aura = 0;
  for (const other of s.towers) {
    if (other === t) continue;
    const ot = data.towerById.get(other.type)!;
    if (!ot.auraBp) continue;
    const range = ot.ladder[other.level - 1]!.rangeFp;
    const dx = (xOf(s.grid, t.cell) - xOf(s.grid, other.cell)) * SCALE;
    const dy = (yOf(s.grid, t.cell) - yOf(s.grid, other.cell)) * SCALE;
    if (dx * dx + dy * dy <= range * range)
      aura = Math.max(aura, ot.auraBp * other.level);
  }
  damage = mulBp(damage, 10000 + aura);
  for (const id of s.relics) {
    const r = data.relics.find((r) => r.id === id)!;
    if (r.damageType === "all" || r.damageType === type.damageType)
      damage = mulBp(damage, r.damageBp);
    if (s.lives <= (r.lowLifeThreshold ?? 0))
      damage = mulBp(damage, r.lowLifeDamageBp ?? 10000);
  }
  return damage;
}

export function damageMultiplier(
  data: GameData,
  tower: TowerType,
  enemy: RawEnemyType,
): number {
  let bp = 10000;
  for (const tag of enemy.tags)
    bp = mulBp(bp, data.damageMatrix[tower.damageType][tag] ?? 10000);
  return bp;
}

function fireTowers(data: GameData, s: State, events: Event[]): void {
  const g = s.grid;
  for (const t of s.towers) {
    if (t.cooldown > 0) {
      t.cooldown--;
      continue;
    }
    const type = data.towerById.get(t.type) as TowerType;
    const lvl = type.ladder[t.level - 1] as {
      rangeFp: number;
      cooldownTicks: number;
    };
    const tx = xOf(g, t.cell) * SCALE + SCALE / 2;
    const ty = yOf(g, t.cell) * SCALE + SCALE / 2;
    const r2 = lvl.rangeFp * lvl.rangeFp;
    let target: Enemy | undefined;
    let targetKey = Number.MAX_SAFE_INTEGER;
    const priorityKey = (e: Enemy): number => t.priority === "last" ? -distanceToCore(s, e)
      : t.priority === "strongest" ? -e.hp : t.priority === "weakest" ? e.hp : distanceToCore(s, e);
    const coated = (e: Enemy): number => type.preferFreshCoating && s.tick < (type.coating === "wet" ? e.wetUntil ?? 0 : e.oiledUntil ?? 0) ? 1 : 0;
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const p = enemyPos(s, e);
      const dx = p.x - tx;
      const dy = p.y - ty;
      if (dx * dx + dy * dy > r2) continue;
      // Shades remain targetable at reduced damage; a lens exposes them to all towers.
      const key = priorityKey(e);
      if (
        !target || coated(e) < coated(target) ||
        (coated(e) === coated(target) && (key < targetKey || (key === targetKey && e.id < target.id)))
      ) {
        target = e;
        targetKey = key;
      }
    }
    if (!target) continue;
    const targets = [target];
    if (type.targets > 1) {
      const p = enemyPos(s, target);
      const radius = Math.round(type.splashCells * SCALE);
      const secondary = type.preferFreshCoating ? [...s.enemies].sort((a, b) => coated(a) - coated(b) || priorityKey(a) - priorityKey(b) || a.id - b.id) : s.enemies;
      for (const e of secondary) {
        if (e === target || e.hp <= 0 || targets.length >= type.targets)
          continue;
        const ep = enemyPos(s, e);
        if ((ep.x - p.x) ** 2 + (ep.y - p.y) ** 2 <= radius * radius)
          targets.push(e);
      }
    }
    for (const e of targets) {
      let dmg = mulBp(
        towerDamage(data, s, t),
        damageMultiplier(data, type, data.enemyById.get(e.type)!),
      );
      if (type.damageType === "scanner")
        e.revealedUntil = s.tick + lvl.cooldownTicks + 1;
      if (
        data.enemyById.get(e.type)!.tags.includes("stealth") &&
        e.revealedUntil <= s.tick
      )
        dmg = mulBp(dmg, data.stealthDamageBp);
      if (s.tick < e.slowUntil)
        for (const id of s.relics)
          dmg = mulBp(dmg, data.relics.find((r) => r.id === id)!.slowDamageBp);
      dmg = coatingHit(data, s, e, type, dmg);
      e.hp -= Math.max(1, dmg);
      applyOnHitEffects(data, s, e, dmg);
      if (type.slowTicks) {
        const slowBp = data.effectRules
          ? Math.max(data.effectRules.minSlowBp, s.tick < (e.wetUntil ?? 0) ? mulBp(type.slowBp, data.effectRules.wetSlowBp) : type.slowBp)
          : type.slowBp;
        e.slowBp =
          s.tick < e.slowUntil ? Math.min(e.slowBp, slowBp) : slowBp;
        e.slowUntil = Math.max(e.slowUntil, s.tick + type.slowTicks);
      }
      events.push({ kind: "hit", tower: t.cell, enemy: e.id, damage: dmg });
    }
    t.cooldown = lvl.cooldownTicks - 1;
  }
  if (s.enemies.some((e) => e.hp <= 0)) {
    const bounty =
      data.economy.bountyBase + data.economy.bountyPerWave * s.wave;
    const dead = new Set<number>();
    const burstBp = stackedRelics(data, s.relics).reduce((n, r) => n + (r.deathBurstBp ?? 0), 0);
    const radius = Math.max(0, ...s.relics.map(id => data.relics.find(r => r.id === id)!.deathBurstRadiusFp ?? 0));
    // Each enemy explodes at most once, including enemies killed by another
    // explosion. Iterate until the deterministic chain reaction is exhausted.
    let killed: Enemy | undefined;
    while ((killed = s.enemies.find(e => e.hp <= 0 && !dead.has(e.id)))) {
      const e = killed;
      dead.add(e.id);
      s.gold += bounty;
      s.stats.goldEarned += bounty;
      s.stats.kills++;
      events.push({ kind: "kill", enemy: e.id, bounty });
      if (burstBp) {
        const p = enemyPos(s, e);
        const damage = mulBp(e.maxHp, burstBp);
        events.push({ kind: "burst", cell: e.cell, radiusFp: radius });
        for (const target of s.enemies) {
          if (target.hp <= 0) continue;
          const q = enemyPos(s, target);
          if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 <= radius ** 2)
            target.hp -= damage;
        }
      }
    }
    s.enemies = s.enemies.filter(e => !dead.has(e.id));
  }
}

/** Advance one tick. Commands are applied first, in order. Returns this tick's events. */
export function step(
  data: GameData,
  s: State,
  commands: readonly Command[] = [],
): Event[] {
  const events: Event[] = [];
  if (s.outcome !== "playing") return events;
  for (const c of commands) applyCommand(data, s, c, events);
  if (s.outcome !== "playing") return events;

  if (!s.inWave) {
    if (s.waveTimer > 0) s.waveTimer--;
    if (s.waveTimer === 0) startWave(data, s, events, 0);
  }
  if (s.inWave) {
    if (s.spawnQueue.length > 0) {
      if (s.spawnCooldown > 0) s.spawnCooldown--;
      if (s.spawnCooldown === 0) {
        spawn(data, s, s.spawnQueue.shift() as SpawnSpec, events);
        s.spawnCooldown = spawnInterval(data, s);
      }
    }
    tickBurn(s);
    tickEffects(data, s);
    fireTowers(data, s, events);
    moveEnemies(data, s, events);
    if (s.spawnQueue.length === 0 && s.enemies.length === 0) {
      s.inWave = false;
      if (s.lives > 0) s.stats.wavesCleared = s.wave;
      s.waveTimer = data.waveIntervalTicks;
      events.push({ kind: "waveEnd", wave: s.wave });
      if (
        data.relicRules.everyWaves > 0 &&
        s.wave >= (data.relicRules.firstOfferWave ?? data.relicRules.everyWaves) &&
        (s.wave - (data.relicRules.firstOfferWave ?? data.relicRules.everyWaves)) % data.relicRules.everyWaves === 0 &&
        s.wave < data.economy.maxWaves
      ) {
        if (s.offerRerolls !== undefined) s.offerRerolls = 0;
        s.relicOffers = rollOffers(data, s.seed, s.wave);
      }
      if (s.wave >= data.economy.maxWaves && s.lives > 0) {
        s.outcome = "won";
        events.push({ kind: "won" });
      }
    }
  }
  if (s.lives <= 0 && s.outcome === "playing") {
    s.outcome = "lost";
    events.push({ kind: "lost" });
  }
  s.tick++;
  return events;
}

export function cloneState(s: State): State {
  return {
    ...s,
    ...(s.raided ? { raided: [...s.raided] } : {}),
    rng: cloneRng(s.rng),
    blocked: new Uint8Array(s.blocked),
    dist: new Int32Array(s.dist),
    spawnQueue: s.spawnQueue.map((e) => ({ ...e })),
    relics: [...s.relics],
    relicOffers: [...s.relicOffers],
    enemies: s.enemies.map((e) => ({ ...e })),
    towers: s.towers.map((t) => ({ ...t })),
    stats: { ...s.stats },
  };
}
