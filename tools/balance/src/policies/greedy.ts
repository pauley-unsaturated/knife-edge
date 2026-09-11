import {
  SCALE, canBuild, cellsToFp, pathFromEntry, towerAt, xOf, yOf,
  type Command, type GameData, type RngState, type State, type TowerType,
} from "@knife-edge/sim";
import type { Policy } from "../policy.js";

export interface GreedyOptions {
  /** Gold to keep banked (interest-greedy sets this high). */
  reserve: number;
  /** Ticks between mid-wave decision checkpoints. */
  checkpoint: number;
  /** Call the next wave immediately when idle (collect the early bonus). */
  callEarly: boolean;
}

/** Squared fixed-point distance from a cell centre to a path cell centre. */
function coverage(s: State, cell: number, path: number[], rangeFp: number): number {
  const g = s.grid;
  const cx = xOf(g, cell) * SCALE + SCALE / 2;
  const cy = yOf(g, cell) * SCALE + SCALE / 2;
  const r2 = rangeFp * rangeFp;
  let n = 0;
  for (const p of path) {
    const dx = xOf(g, p) * SCALE + SCALE / 2 - cx;
    const dy = yOf(g, p) * SCALE + SCALE / 2 - cy;
    if (dx * dx + dy * dy <= r2) n++;
  }
  return n;
}

/**
 * Par player: picks the action with the best expected damage-per-gold. Candidates are
 * (a) build the cheapest tower on the free cell that covers the most path cells, and
 * (b) upgrade the existing tower with the best marginal DPS per gold. Acts at wave start
 * and at fixed mid-wave checkpoints (real-time model, ADR-0007).
 */
export function greedyPolicy(opts: Partial<GreedyOptions> = {}): Policy {
  const o: GreedyOptions = { reserve: 0, checkpoint: 20, callEarly: true, ...opts };
  return {
    name: opts.reserve ? `greedy-reserve${opts.reserve}` : opts.callEarly === false ? "greedy-noearly" : "greedy",
    decide(data: GameData, s: State, _rng: RngState): Command[] {
      const cmds: Command[] = [];
      if (s.tick % o.checkpoint !== 0) return cmds;
      const spendable = s.gold - o.reserve;
      if (spendable > 0) {
        const path = pathFromEntry(s.grid, s.dist);
        let best: { value: number; cmd: Command } | undefined;
        // (a) builds
        for (const type of data.towers) {
          const lvl = type.ladder[0]!;
          if (lvl.cost > spendable) continue;
          const dps = lvl.damage / lvl.cooldownTicks;
          // Candidates: cells within range+1 of the path, scored by coverage. Check legality only for the top few.
          const scored: { cell: number; cov: number }[] = [];
          const seen = new Set<number>();
          const reach = Math.ceil(lvl.rangeFp / SCALE) + 1;
          for (const p of path) {
            const px = xOf(s.grid, p);
            const py = yOf(s.grid, p);
            for (let dy = -reach; dy <= reach; dy++) {
              for (let dx = -reach; dx <= reach; dx++) {
                const x = px + dx;
                const y = py + dy;
                if (x < 0 || y < 0 || x >= s.grid.width || y >= s.grid.height) continue;
                const c = y * s.grid.width + x;
                if (seen.has(c) || s.blocked[c]) continue;
                seen.add(c);
                scored.push({ cell: c, cov: coverage(s, c, path, lvl.rangeFp) });
              }
            }
          }
          scored.sort((a, b) => b.cov - a.cov || a.cell - b.cell);
          for (const cand of scored.slice(0, 6)) {
            if (!canBuild(s, cand.cell).ok) continue;
            // Value = expected time-in-range damage per gold. Coverage is in path cells.
            const value = (dps * cand.cov) / lvl.cost;
            if (!best || value > best.value) best = { value, cmd: { kind: "build", cell: cand.cell, type: type.id } };
            break;
          }
        }
        // (b) upgrades
        for (const t of s.towers) {
          const type = data.towerById.get(t.type) as TowerType;
          if (t.level >= type.levels) continue;
          const cur = type.ladder[t.level - 1]!;
          const nxt = type.ladder[t.level]!;
          if (nxt.cost > spendable) continue;
          const covNow = coverage(s, t.cell, path, cur.rangeFp);
          const covNext = coverage(s, t.cell, path, nxt.rangeFp);
          const gain = (nxt.damage / nxt.cooldownTicks) * covNext - (cur.damage / cur.cooldownTicks) * covNow;
          const value = gain / nxt.cost;
          if (value > 0 && (!best || value > best.value)) best = { value, cmd: { kind: "upgrade", cell: t.cell } };
        }
        if (best) cmds.push(best.cmd);
      }
      if (o.callEarly && !s.inWave && s.waveTimer > 0 && s.wave > 0) cmds.push({ kind: "callWave" });
      return cmds;
    },
  };
}

export { cellsToFp, towerAt };
