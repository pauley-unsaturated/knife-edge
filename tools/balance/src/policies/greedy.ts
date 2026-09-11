import {
  SCALE,
  canBuild,
  cellsToFp,
  pathFromEntry,
  towerAt,
  xOf,
  yOf,
  composeWave,
  damageMultiplier,
  nextInt,
  type Command,
  type GameData,
  type RngState,
  type State,
  type TowerType,
} from "@knife-edge/sim";
import type { Policy } from "../policy.js";

export interface GreedyOptions {
  /** Experimental build-identity weights; absent in the reference heuristic. */
  towerBias?: Record<string, number>;
  /** Gold to keep banked (interest-greedy sets this high). */
  reserve: number;
  /** Ticks between mid-wave decision checkpoints. */
  checkpoint: number;
  /** Call the next wave immediately when idle (collect the early bonus). */
  callEarly: boolean;
  mistakes: number;
  relics: boolean;
}

/** Squared fixed-point distance from a cell centre to a path cell centre. */
function coverage(
  s: State,
  cell: number,
  path: number[],
  rangeFp: number,
): number {
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
  const o: GreedyOptions = {
    reserve: 0,
    checkpoint: 20,
    callEarly: true,
    mistakes: 0,
    relics: false,
    ...opts,
  };
  let previewWave = -1;
  let previewSeed = -1;
  let previewRaids = "";
  let matrix = new Map<string, number>();
  return {
    name: o.relics
      ? "greedy-relics"
      : o.mistakes
        ? `greedy-k${o.mistakes}`
        : opts.reserve
          ? `greedy-reserve${opts.reserve}`
          : opts.callEarly === false
            ? "greedy-noearly"
            : "greedy",
    decide(data: GameData, s: State, _rng: RngState): Command[] {
      const cmds: Command[] = [];
      if (s.tick % o.checkpoint !== 0) return cmds;
      if (o.relics && s.relicOffers.length) {
        const ranked = s.relicOffers
          .filter(id => s.lives > (data.relics.find(r => r.id === id)!.sacrificeLives ?? 0))
          .map((id) => {
            const r = data.relics.find((r) => r.id === id)!;
            const matching = s.towers
              .filter(
                (t) =>
                  r.damageType === "all" ||
                  data.towerById.get(t.type)!.damageType === r.damageType,
              )
              .reduce((n, t) => n + t.spent, 0);
            return {
              id,
              score:
                matching * (r.damageBp - 10000) +
                (s.towers.some((t) => data.towerById.get(t.type)!.slowTicks > 0)
                  ? s.stats.goldSpent * (r.slowDamageBp - 10000)
                  : 0) +
                r.interestBp * s.gold,
            };
          })
          .sort((a, b) => b.score - a.score);
        if (ranked.length) cmds.push({ kind: "pickRelic", id: ranked[0]!.id });
      }
      const wave = Math.min(data.economy.maxWaves, s.wave + (s.inWave ? 0 : 1));
      const raids = s.raided?.join(",") ?? "";
      if (previewWave !== wave || previewSeed !== s.seed || previewRaids !== raids || s.tick === 0) {
        const enemies = composeWave(data, s.seed, wave, s.raided);
        matrix = new Map(
          data.towers.map((t) => [
            t.id,
            enemies.reduce(
              (n, e) =>
                n + damageMultiplier(data, t, data.enemyById.get(e.type)!),
              0,
            ) /
              Math.max(1, enemies.length) /
              10000,
          ]),
        );
        previewWave = wave;
        previewSeed = s.seed;
        previewRaids = raids;
      }
      const spendable = s.gold - o.reserve;
      if (spendable > 0) {
        const path = pathFromEntry(s.grid, s.dist);
        let best: { value: number; cmd: Command } | undefined;
        // (a) builds
        for (const type of data.towers) {
          const lvl = type.ladder[0]!;
          if (lvl.cost > spendable) continue;
          const dps =
            (lvl.damage / lvl.cooldownTicks) * (matrix.get(type.id) ?? 1);
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
                if (x < 0 || y < 0 || x >= s.grid.width || y >= s.grid.height)
                  continue;
                const c = y * s.grid.width + x;
                if (seen.has(c) || s.blocked[c]) continue;
                seen.add(c);
                scored.push({
                  cell: c,
                  cov: coverage(s, c, path, lvl.rangeFp),
                });
              }
            }
          }
          scored.sort((a, b) => b.cov - a.cov || a.cell - b.cell);
          for (const cand of scored.slice(0, 6)) {
            if (!canBuild(s, cand.cell).ok) continue;
            // Value = expected time-in-range damage per gold. Coverage is in path cells.
            const value = (dps * cand.cov) / lvl.cost * (o.towerBias?.[type.id] ?? 1);
            if (!best || value > best.value)
              best = {
                value,
                cmd: { kind: "build", cell: cand.cell, type: type.id },
              };
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
          const gain =
            ((nxt.damage / nxt.cooldownTicks) * covNext -
              (cur.damage / cur.cooldownTicks) * covNow) *
            (matrix.get(type.id) ?? 1);
          const value = gain / nxt.cost * (o.towerBias?.[type.id] ?? 1);
          if (value > 0 && (!best || value > best.value))
            best = { value, cmd: { kind: "upgrade", cell: t.cell } };
        }
        if (best) {
          if (s.towers.length < o.mistakes) {
            const type = data.towers[0]!;
            const candidates = Array.from(
              { length: s.blocked.length },
              (_, c) => c,
            ).filter(
              (c) =>
                !s.blocked[c] &&
                coverage(s, c, path, type.ladder[0]!.rangeFp) === 0 &&
                canBuild(s, c).ok,
            );
            if (candidates.length && type.cost <= spendable)
              best.cmd = {
                kind: "build",
                type: type.id,
                cell: candidates[nextInt(_rng, candidates.length)]!,
              };
          }
          cmds.push(best.cmd);
        }
      }
      if (o.callEarly && !s.inWave && s.waveTimer > 0 && s.wave > 0)
        cmds.push({ kind: "callWave" });
      return cmds;
    },
  };
}

export { cellsToFp, towerAt };
