import { SCALE, canBuild, distanceField, pathFromEntry, towerDamage, type Command, type GameData, type State, type Tower } from "@knife-edge/sim";

function distance2(s: State, a: number, b: number): number {
  return ((a % s.grid.width) - (b % s.grid.width)) ** 2 +
    (Math.floor(a / s.grid.width) - Math.floor(b / s.grid.width)) ** 2;
}

/** Inspectable route-exposure estimate, not a combat oracle. Existing damage,
 * auras, cold kill zones and coating overlaps all matter when a route moves. */
function coverageValue(data: GameData, s: State, path: number[]): number {
  const powers = s.towers.map(t => {
    const type = data.towerById.get(t.type)!;
    const level = type.ladder[t.level - 1]!;
    return { t, type, range2: (level.rangeFp / SCALE) ** 2,
      power: towerDamage(data, s, t) / level.cooldownTicks * (1 + Math.min(2, (type.targets - 1) * 0.35)) };
  });
  const patches = s.relics.map(id => data.relics.find(r => r.id === id)!);
  const globalSlow = patches.reduce((bp, r) => bp * (r.hitSlowBp ?? 10000) / 10000, 10000);
  const cold = patches.reduce((bonus, r) => bonus * r.slowDamageBp / 10000, 1);
  let result = 0;
  for (const cell of path) {
    const covering = powers.filter(p => distance2(s, p.t.cell, cell) <= p.range2);
    const slow = Math.max(data.effectRules?.minSlowBp ?? 1000,
      Math.min(globalSlow, ...covering.filter(p => p.type.slowTicks).map(p => p.type.slowBp)));
    const slowed = slow < 10000;
    const travel = slowed ? 1 + (10000 / slow - 1) * 0.65 : 1;
    for (const p of covering) {
      let power = p.power * (slowed ? 1 + (cold - 1) * 0.75 : 1);
      if (data.effectRules) {
        if (p.type.damageType === "chain" && covering.some(other => other.type.coating === "wet"))
          power *= 1 + (data.effectRules.wetLightningBp / 10000 - 1) * 0.75;
        if (p.type.damageType === "thermal" && covering.some(other => other.type.coating === "oil"))
          power *= 1 + (data.effectRules.oilHitBp / 10000 - 1 + data.effectRules.oilBurnBp / 10000 * 0.6) * 0.65;
      }
      result += power * travel;
    }
  }
  return result;
}

function prospective(data: GameData, s: State, command: Extract<Command, { kind: "build" }>): State {
  const blocked = new Uint8Array(s.blocked);
  blocked[command.cell] = 1;
  const type = data.towerById.get(command.type)!;
  const tower: Tower = { cell: command.cell, type: command.type, level: 1, spent: type.ladder[0]!.cost, cooldown: 0, priority: "first" };
  return { ...s, blocked, dist: distanceField(s.grid, blocked), towers: [...s.towers, tower] };
}

export interface RouteAssessment { safe: boolean; before: number; after: number; changed: boolean; oldPath: number[]; newPath: number[] }

export function assessBuildRoute(data: GameData, s: State, command: Extract<Command, { kind: "build" }>): RouteAssessment {
  const oldPath = pathFromEntry(s.grid, s.dist);
  const before = coverageValue(data, s, oldPath);
  if (!data.towerById.has(command.type) || !canBuild(s, command.cell).ok)
    return { safe: false, before, after: -Infinity, changed: false, oldPath, newPath: oldPath };
  const next = prospective(data, s, command);
  const newPath = pathFromEntry(next.grid, next.dist);
  const changed = oldPath.join(",") !== newPath.join(",");
  const after = coverageValue(data, next, newPath);
  return { safe: after + 1e-9 >= before, before, after, changed, oldPath, newPath };
}

/** Engineer-only opt-in: do not let a cheap wall strand a valuable established
 * kill zone. On rejection choose another legal same-type cell or an upgrade;
 * never modify the historical greedy policy's proposed build order. */
export function preserveKillZone(data: GameData, s: State, commands: Command[]): Command[] {
  const proposed = commands[0];
  if (proposed?.kind !== "build") return commands;
  const assessment = assessBuildRoute(data, s, proposed);
  if (assessment.safe) return commands;
  const type = data.towerById.get(proposed.type);
  if (!type) return commands.slice(1);
  const range2 = (type.ladder[0]!.rangeFp / SCALE) ** 2;
  const ranked = Array.from({ length: s.blocked.length }, (_, cell) => ({ cell,
    coverage: assessment.oldPath.filter(p => distance2(s, cell, p) <= range2).length,
  })).filter(c => !s.blocked[c.cell] && c.cell !== proposed.cell && c.coverage > 0)
    .sort((a, b) => b.coverage - a.coverage || a.cell - b.cell);
  let best: { command: Command; value: number } | undefined;
  // Bounded search: the nearest high-coverage legal alternatives, plus the
  // complete upgrade list. This is not exhaustive multi-action maze planning.
  if (s.gold >= type.ladder[0]!.cost) for (const candidate of ranked.slice(0, 24)) {
    const command = { ...proposed, cell: candidate.cell };
    const score = assessBuildRoute(data, s, command);
    if (!score.safe) continue;
    const value = (score.after - assessment.before) / type.ladder[0]!.cost;
    if (value > 0 && (!best || value > best.value)) best = { command, value };
  }
  for (const tower of s.towers) {
    const next = data.towerById.get(tower.type)!.ladder[tower.level];
    if (!next || next.cost > s.gold) continue;
    const upgraded = { ...s, towers: s.towers.map(t => t === tower ? { ...t, level: t.level + 1 } : t) };
    const value = (coverageValue(data, upgraded, assessment.oldPath) - assessment.before) / next.cost;
    if (value > 0 && (!best || value > best.value)) best = { command: { kind: "upgrade", cell: tower.cell }, value };
  }
  if (best) return [best.command, ...commands.slice(1)];
  // No improving affordable candidate: continue the encounter for income.
  // In-wave abstention is deliberate, not a retrying rejected command stream.
  return commands.slice(1).length ? commands.slice(1) : !s.inWave && s.wave > 0 ? [{ kind: "callWave" }] : [];
}
