/**
 * The simulation core. `step(state, commands)` advances exactly one fixed tick.
 * No wall-clock, no floats, no I/O. A run is fully described by (data, seed, commands).
 */
import type { GameData, RawEnemyType, TowerType } from "./data.js";
import { enemyHpAtWave } from "./data.js";
import { composeWave } from "./composer.js";
import { SCALE, mulBp } from "./fixed.js";
import { UNREACHABLE, distanceField, generateGrid, neighbours, nextStep, xOf, yOf, type Cell, type Grid } from "./grid.js";
import { cloneRng, seedRng, type RngState } from "./rng.js";

export interface Enemy {
  id: number;
  type: string;
  hp: number;
  maxHp: number;
  cell: Cell;
  /** Next cell toward the core, or -1 when standing on the core. */
  next: Cell;
  /** Fixed-point progress from `cell` toward `next`, 0..SCALE. */
  progress: number;
}

export interface Tower {
  cell: Cell;
  type: string;
  /** 1-based level. */
  level: number;
  /** Cumulative gold spent (for sell refunds). */
  spent: number;
  /** Ticks until it may fire again. */
  cooldown: number;
}

export type Command =
  | { kind: "build"; cell: Cell; type: string }
  | { kind: "upgrade"; cell: Cell }
  | { kind: "sell"; cell: Cell }
  | { kind: "callWave" };

export interface TimedCommand {
  tick: number;
  cmd: Command;
}

export type Event =
  | { kind: "waveStart"; wave: number; interest: number; earlyBonus: number; count: number }
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
  spawnQueue: string[];
  spawnCooldown: number;
  nextEnemyId: number;
  enemies: Enemy[];
  towers: Tower[];
  stats: Stats;
  outcome: "playing" | "won" | "lost";
}

export function createState(data: GameData, seed: number): State {
  const rng = seedRng(seed);
  const grid = generateGrid(rng, data.grid.width, data.grid.height, data.grid.obstacles);
  const blocked = new Uint8Array(grid.obstacle);
  return {
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
    stats: { kills: 0, leaks: 0, goldEarned: 0, goldSpent: 0, interestEarned: 0, earlyBonusEarned: 0, wavesCleared: 0 },
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
export function canBuild(s: State, cell: Cell): { ok: true } | { ok: false; reason: string } {
  const g = s.grid;
  if (cell < 0 || cell >= g.width * g.height) return { ok: false, reason: "out of bounds" };
  if (cell === g.entry || cell === g.core) return { ok: false, reason: "entry/core" };
  if (s.blocked[cell]) return { ok: false, reason: "occupied" };
  for (const e of s.enemies) if (e.cell === cell || e.next === cell) return { ok: false, reason: "enemy present" };
  s.blocked[cell] = 1;
  const dist = distanceField(g, s.blocked);
  s.blocked[cell] = 0;
  if ((dist[g.entry] as number) >= UNREACHABLE) return { ok: false, reason: "would block path" };
  for (const e of s.enemies) if ((dist[e.cell] as number) >= UNREACHABLE) return { ok: false, reason: "would trap enemy" };
  return { ok: true };
}

function rebuildDistances(s: State): void {
  s.dist = distanceField(s.grid, s.blocked);
  for (const e of s.enemies) {
    if (e.cell === s.grid.core) continue;
    const n = nextStep(s.grid, s.dist, e.cell);
    if (n !== e.next) {
      e.next = n;
      e.progress = 0;
    }
  }
}

function applyCommand(data: GameData, s: State, cmd: Command, events: Event[]): void {
  const reject = (reason: string): void => {
    events.push({ kind: "rejected", cmd, reason });
  };
  switch (cmd.kind) {
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
      s.towers.push({ cell: cmd.cell, type: type.id, level: 1, spent: cost, cooldown: 0 });
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
    case "callWave": {
      if (s.inWave) return reject("wave in progress");
      startWave(data, s, events, s.waveTimer);
      return;
    }
  }
}

function startWave(data: GameData, s: State, events: Event[], ticksRemaining: number): void {
  const wave = s.wave + 1;
  // Early-call bonus is paid BEFORE the interest tick (ADR-0012).
  const earlyBonus = Math.floor((ticksRemaining * data.economy.earlyCallBonusPerSec) / data.economy.tickRate);
  s.gold += earlyBonus;
  s.stats.earlyBonusEarned += earlyBonus;
  const interest = mulBp(s.gold, data.economy.interestBp);
  s.gold += interest;
  s.stats.interestEarned += interest;
  s.stats.goldEarned += earlyBonus + interest;
  s.wave = wave;
  s.inWave = true;
  s.waveTimer = 0;
  s.spawnQueue = composeWave(data, s.rng, wave);
  s.spawnCooldown = 0;
  events.push({ kind: "waveStart", wave, interest, earlyBonus, count: s.spawnQueue.length });
}

function spawn(data: GameData, s: State, typeId: string, events: Event[]): void {
  const type = data.enemyById.get(typeId) as RawEnemyType;
  const hp = enemyHpAtWave(data, type, s.wave);
  const e: Enemy = {
    id: s.nextEnemyId++,
    type: typeId,
    hp,
    maxHp: hp,
    cell: s.grid.entry,
    next: nextStep(s.grid, s.dist, s.grid.entry),
    progress: 0,
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
      e.progress += type.speedUpt;
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

function towerDamage(data: GameData, s: State, t: Tower): number {
  const type = data.towerById.get(t.type) as TowerType;
  const base = (type.ladder[t.level - 1] as { damage: number }).damage;
  if (type.adjacencyBonusBp === 0) return base;
  let adjacent = 0;
  for (const nb of neighbours(s.grid, t.cell)) {
    const other = towerAt(s, nb);
    if (other && other.type === t.type) adjacent++;
  }
  return mulBp(base, 10000 + adjacent * type.adjacencyBonusBp);
}

function fireTowers(data: GameData, s: State, events: Event[]): void {
  const g = s.grid;
  for (const t of s.towers) {
    if (t.cooldown > 0) {
      t.cooldown--;
      continue;
    }
    const type = data.towerById.get(t.type) as TowerType;
    const lvl = type.ladder[t.level - 1] as { rangeFp: number; cooldownTicks: number };
    const tx = xOf(g, t.cell) * SCALE + SCALE / 2;
    const ty = yOf(g, t.cell) * SCALE + SCALE / 2;
    const r2 = lvl.rangeFp * lvl.rangeFp;
    let target: Enemy | undefined;
    let targetKey = Number.MAX_SAFE_INTEGER;
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const p = enemyPos(s, e);
      const dx = p.x - tx;
      const dy = p.y - ty;
      if (dx * dx + dy * dy > r2) continue;
      const key = distanceToCore(s, e);
      if (key < targetKey || (key === targetKey && target && e.id < target.id)) {
        target = e;
        targetKey = key;
      }
    }
    if (!target) continue;
    const dmg = towerDamage(data, s, t);
    target.hp -= dmg;
    t.cooldown = lvl.cooldownTicks;
    events.push({ kind: "hit", tower: t.cell, enemy: target.id, damage: dmg });
  }
  if (s.enemies.some((e) => e.hp <= 0)) {
    const bounty = data.economy.bountyBase + data.economy.bountyPerWave * s.wave;
    s.enemies = s.enemies.filter((e) => {
      if (e.hp > 0) return true;
      s.gold += bounty;
      s.stats.goldEarned += bounty;
      s.stats.kills++;
      events.push({ kind: "kill", enemy: e.id, bounty });
      return false;
    });
  }
}

/** Advance one tick. Commands are applied first, in order. Returns this tick's events. */
export function step(data: GameData, s: State, commands: readonly Command[] = []): Event[] {
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
        spawn(data, s, s.spawnQueue.shift() as string, events);
        s.spawnCooldown = data.composer.spawnIntervalTicks;
      }
    }
    fireTowers(data, s, events);
    moveEnemies(data, s, events);
    if (s.spawnQueue.length === 0 && s.enemies.length === 0) {
      s.inWave = false;
      s.stats.wavesCleared = s.wave;
      s.waveTimer = data.waveIntervalTicks;
      events.push({ kind: "waveEnd", wave: s.wave });
      if (s.wave >= data.economy.maxWaves) {
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
    rng: cloneRng(s.rng),
    blocked: new Uint8Array(s.blocked),
    dist: new Int32Array(s.dist),
    spawnQueue: [...s.spawnQueue],
    enemies: s.enemies.map((e) => ({ ...e })),
    towers: s.towers.map((t) => ({ ...t })),
    stats: { ...s.stats },
  };
}
