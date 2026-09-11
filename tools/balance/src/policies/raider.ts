import {
  SCALE, canBuild, cloneState, composeWave, damageMultiplier, interestTerms,
  pathFromEntry, step, type Command, type GameData, type State,
} from "@knife-edge/sim";
import type { Policy } from "../policy.js";
import { greedyPolicy } from "./greedy.js";

type Identity = "cold" | "blast" | "ember" | "arc";
const identities: Record<string, Identity> = {
  "cold-front": "cold", "chain-reaction": "blast", "hot-wire": "ember", conductive: "arc",
};

export interface OfferReason { id: string; score: number; reason: string }

/** Marginal power now plus affordable pivot potential, never a permanent first-pick lock.
 * This is an inspectable heuristic, not a calibrated model of human intelligence. */
export function evaluateOffers(data: GameData, s: State, name = "synergy"): OfferReason[] {
  const spent = Math.max(1, s.stats.goldSpent);
  const remaining = data.economy.maxWaves - s.wave;
  const slow = s.towers.some(t => data.towerById.get(t.type)!.slowTicks > 0);
  const forced = name.startsWith("force-") ? name.slice(6) : undefined;
  const rookie = name === "synergy-rookie";
  return s.relicOffers.flatMap(id => {
    const r = data.relics.find(r => r.id === id)!;
    const cost = r.sacrificeLives ?? 0;
    if (cost >= s.lives) return [];
    const matching = s.towers.filter(t => r.damageType === "all" || data.towerById.get(t.type)!.damageType === r.damageType)
      .reduce((sum, t) => sum + t.spent, 0) / spent;
    const previous = s.relics.filter(other => other === id).length;
    // Repeated off-lane offers increase prospective return; existing investment
    // matters, but cannot veto a strong offer or an accessible new lane.
    const pivot = r.damageType === "all" ? 0 : Math.min(0.85, (remaining / data.economy.maxWaves) * (0.45 + previous * 0.25));
    let score = Math.log(Math.max(1, r.damageBp / 10000)) * Math.min(1, matching + pivot);
    const reasons = [`${Math.round(matching * 100)}% existing investment matches`, `${previous} existing stacks`];
    if (!rookie && r.slowDamageBp > 10000) {
      const readiness = slow ? 0.85 : s.gold >= (data.towerById.get("frost")?.cost ?? Infinity) ? 0.6 : 0.3;
      score += Math.log(r.slowDamageBp / 10000) * readiness;
      reasons.push(slow ? "Frost already enables slow payoff" : "requires a Frost purchase");
    }
    if (!rookie && r.deathBurstBp) {
      score += (r.deathBurstBp / 10000) * (previous ? 0.8 : 1.0);
      reasons.push("kill-chain payoff depends on seed kills and enemy spacing");
    }
    if (!rookie && r.lowLifeDamageBp) {
      const threshold = r.lowLifeThreshold ?? 0;
      const active = s.lives <= threshold;
      const payable = data.relics.some(other => other.sacrificeLives && s.lives - other.sacrificeLives <= threshold);
      score += Math.log(r.lowLifeDamageBp / 10000) * (active ? 1 : payable ? 0.4 : 0.06);
      reasons.push(active ? "low-core multiplier active" : "low-core multiplier dormant");
    }
    if (cost) {
      const after = s.lives - cost;
      const activates = s.relics.some(other => { const patch = data.relics.find(p => p.id === other)!; return s.lives > (patch.lowLifeThreshold ?? 0) && after <= (patch.lowLifeThreshold ?? 0); });
      score -= cost / Math.max(1, after) * 0.16;
      if (activates) score += 0.7;
      reasons.push(`spends ${cost} core, leaves ${after}${activates ? "; activates Last stand" : ""}`);
    }
    if (!rookie && (r.interestBp || r.interestRateMultiplierBp)) {
      const before = interestTerms(data, s);
      const after = interestTerms(data, { relics: [...s.relics, id] });
      const bank = Math.min(after.cap, Math.max(s.gold, name === "banker" ? 120 : 30));
      const extra = bank * (after.rate - before.rate) / 10000;
      score += Math.min(1.1, extra * Math.max(0, remaining - 3) / Math.max(120, spent)) * (name === "banker" ? 1.7 : 0.65);
      reasons.push(`estimated +${Math.round(extra)} gold/wave at ${bank} bank; ${remaining} waves left`);
    }
    if (forced && identities[id] === forced) score += 2;
    return [{ id, score, reason: reasons.join("; ") }];
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function distance2(s: State, a: number, b: number): number {
  return ((a % s.grid.width) - (b % s.grid.width)) ** 2 + (Math.floor(a / s.grid.width) - Math.floor(b / s.grid.width)) ** 2;
}

/** Put support inside a damage kill zone, not wherever its personal DPS is highest. */
function supportBuild(data: GameData, s: State, typeId: string): Command | undefined {
  const type = data.towerById.get(typeId);
  if (!type || s.gold < type.cost) return;
  const range2 = (type.ladder[0]!.rangeFp / SCALE) ** 2;
  const path = pathFromEntry(s.grid, s.dist);
  const choices: { cell: number; value: number }[] = [];
  for (let cell = 0; cell < s.blocked.length; cell++) {
    if (s.blocked[cell]) continue;
    let value = 0;
    for (const t of s.towers) {
      const other = data.towerById.get(t.type)!;
      if (other.slowTicks || other.auraBp) continue;
      const power = other.ladder[t.level - 1]!.damage / other.cooldownTicks;
      if (type.auraBp) { if (distance2(s, cell, t.cell) <= range2) value += power; }
      else for (const p of path) if (distance2(s, cell, p) <= range2 && distance2(s, t.cell, p) <= (other.ladder[t.level - 1]!.rangeFp / SCALE) ** 2) value += power;
    }
    choices.push({ cell, value });
  }
  choices.sort((a, b) => b.value - a.value || a.cell - b.cell);
  const best = choices.find(c => c.value > 0 && canBuild(s, c.cell).ok);
  if (best) return { kind: "build", cell: best.cell, type: typeId };
}

/** Oracle-assisted next-wave planning: a bounded perfect-model frozen-defense
 * probe. No future offers or later-wave RNG are inspected, but exact numeric
 * state/simulation access exceeds normal human preview comprehension. */
function forecast(data: GameData, state: State, commands: Command[] = []): number {
  const s = cloneState(state);
  const target = s.wave + 1;
  step(data, s, [...commands, { kind: "callWave" }]);
  const deadline = s.tick + 6000;
  while (s.outcome === "playing" && s.tick < deadline && s.stats.wavesCleared < target) step(data, s);
  return s.stats.wavesCleared >= target ? s.lives : 0;
}

export function raiderPolicy(name: string): Policy {
  const bias: Record<string, number> = {};
  const builder = greedyPolicy({ callEarly: false, towerBias: bias });
  const reserves = new Map<number, Policy>();
  const rookie = name === "synergy-rookie";
  const cadence = name === "synergy-deliberate" ? 80 : 20;
  let observedWave = -1;
  let lastLeaks = 0;
  let leakedLastWave = false;
  let bankSafeWave = -1;
  let forecastKey = "";
  let projectedLives = 0;
  let raidCheckedWave = -1;
  return {
    name,
    decide(data, s, rng) {
      if (s.tick === 0) { observedWave = -1; lastLeaks = 0; leakedLastWave = false; bankSafeWave = -1; forecastKey = ""; raidCheckedWave = -1; }
      if (s.tick % cadence) return [];
      if (observedWave !== s.wave && !s.inWave) {
        leakedLastWave = s.stats.leaks > lastLeaks;
        lastLeaks = s.stats.leaks;
        observedWave = s.wave;
      }
      if (s.relicOffers.length) {
        const selected = evaluateOffers(data, s, name)[0];
        // Apply the pick before reconsidering investments: no stale loadout weights.
        if (selected) return [{ kind: "pickRelic", id: selected.id }];
      }
      for (const t of data.towers) {
        let power = 1;
        for (const id of s.relics) {
          const r = data.relics.find(r => r.id === id)!;
          if (r.damageType === "all" || r.damageType === t.damageType) power *= r.damageBp / 10000;
        }
        bias[t.id] = power * (rookie ? 1 : 1 + Math.min(2, (t.targets - 1) * 0.35));
      }
      if (name.startsWith("force-")) {
        const tower: Record<string, string> = { cold: "ember", ember: "ember", arc: "arc", blast: "mortar" };
        bias[tower[name.slice(6)]!]! *= 4;
      }
      if (!rookie) {
        const slow = s.relics.some(id => data.relics.find(r => r.id === id)!.slowDamageBp > 10000);
        const desired = slow && !s.towers.some(t => t.type === "frost") ? "frost" :
          s.towers.length >= 5 && !s.towers.some(t => t.type === "relay") ? "relay" :
          s.wave >= 8 && !s.towers.some(t => t.type === "lens") && composeWave(data, s.seed, s.wave + 1, s.raided).some(e => data.enemyById.get(e.type)!.tags.includes("stealth")) ? "lens" : undefined;
        if (desired && s.towers.length >= 2) {
          const support = supportBuild(data, s, desired);
          if (support) return [support];
          // A 30g damage purchase on every paycheck otherwise prevents ever
          // accumulating the 40g required to activate an already-picked patch.
          if (desired === "frost" && data.towerById.has(desired)) return [];
        }
        bias.frost = 0.5;
        bias.relay = 0.5;
      }
      const nextLives = () => {
        const key = `${s.wave}/${s.lives}/${s.relics.join(",")}/${s.raided?.join(",")}/${s.towers.map(t => `${t.cell}:${t.type}:${t.level}:${t.priority}`).join(",")}`;
        if (forecastKey !== key) { projectedLives = forecast(data, s); forecastKey = key; }
        return projectedLives;
      };
      if (s.raided && !s.inWave && s.wave >= 1 && s.wave < data.economy.maxWaves) {
        const available = data.raids!.hideouts.filter(h => !s.raided!.includes(h.id));
        if (name === "synergy-all-raids" && available.length) return [{ kind: "raid", id: available[0]!.id }];
        if (name !== "synergy-no-raids" && !rookie && s.wave >= 3 && !leakedLastWave && s.lives >= 5 && raidCheckedWave !== s.wave) {
          raidCheckedWave = s.wave;
          const preview = composeWave(data, s.seed, s.wave + 1, s.raided);
          const threat = (enemy: string) => s.towers.reduce((n, t) => n + damageMultiplier(data, data.towerById.get(t.type)!, data.enemyById.get(enemy)!) * t.spent, 0) / Math.max(1, s.stats.goldSpent);
          const target = available.find(h => preview.filter(e => e.type === h.enemy).length >= preview.length / 2 && threat(h.enemy) < 9000);
          if (target) {
            const after = forecast(data, s, [{ kind: "raid", id: target.id }]);
            if (after > nextLives() && after >= s.lives - 1) return [{ kind: "raid", id: target.id }];
          }
        }
      }
      let reserve = 0;
      if (name === "banker" && s.wave >= 2 && s.wave < data.economy.maxWaves - 3 && !leakedLastWave && s.lives >= 5 && interestTerms(data, s).rate >= 800) {
        if (!s.inWave && nextLives() === s.lives) bankSafeWave = s.wave + 1;
        if (bankSafeWave === s.wave + (s.inWave ? 0 : 1) && s.stats.leaks === lastLeaks) reserve = Math.min(interestTerms(data, s).cap, 150 + s.relics.filter(id => id === "compound").length * 75);
      }
      if (!reserves.has(reserve)) reserves.set(reserve, reserve ? greedyPolicy({ callEarly: false, towerBias: bias, reserve }) : builder);
      let commands = reserves.get(reserve)!.decide(data, s, rng);
      if (!rookie) {
        // Affordable-only greedy spends each 30g paycheck on Bolt and never
        // accumulates enough for an 80g Arc, even after multiple Arc patches.
        // Compare the next attainable investment before spending that paycheck.
        const plan = builder.decide(data, { ...s, gold: Math.max(s.gold, 300) }, rng)[0];
        if (plan && (plan.kind === "build" || plan.kind === "upgrade")) {
          const target = plan.kind === "upgrade" ? s.towers.find(t => t.cell === plan.cell)! : undefined;
          const price = plan.kind === "build" ? data.towerById.get(plan.type)!.cost : data.towerById.get(target!.type)!.ladder[target!.level]!.cost;
          const emergency = s.enemies.some(e => s.dist[e.cell]! <= 4) || (s.inWave && s.stats.leaks > lastLeaks);
          if (price <= s.gold - reserve) commands = [plan];
          else if (!emergency) commands = [];
        }
      }
      // Spend an available budget before starting the next encounter.
      if (!s.inWave && s.wave > 0 && commands.length === 0) commands.push({ kind: "callWave" });
      return commands;
    },
  };
}
