import {
  SCALE, canBuild, cloneState, pathFromEntry, rerollCost, step,
  type Command, type GameData, type State, type Tower,
} from "@knife-edge/sim";
import type { Policy } from "../policy.js";
import { evaluateOffers, raiderPolicy, type OfferReason } from "./raider.js";
import { preserveKillZone } from "./path-guard.js";

/** Status-aware, inspectable estimates. These do not simulate unseen offers. */
export function evaluateEngineerOffers(data: GameData, s: State): OfferReason[] {
  const previousSlow = s.relics.reduce((bp, id) =>
    bp * (data.relics.find((r) => r.id === id)!.hitSlowBp ?? 10000) / 10000, 10000);
  const hasFrost = s.towers.some((t) => data.towerById.get(t.type)!.slowTicks > 0);
  return evaluateOffers(data, s, "synergy-expert").map((offer) => {
    const r = data.relics.find((r) => r.id === offer.id)!;
    let score = offer.score;
    const reasons = [offer.reason];
    if (r.slowDamageBp > 10000 && previousSlow < 10000 && !hasFrost) {
      const assumedReadiness = s.gold >= (data.towerById.get("frost")?.cost ?? Infinity) ? 0.6 : 0.3;
      score += Math.log(r.slowDamageBp / 10000) * (0.85 - assumedReadiness);
      reasons.push("owned global on-hit slow already enables the cold payoff");
    }
    if (r.poisonDamageBp) {
      // Delayed damage is discounted: short-lived targets cannot pay full value.
      score += Math.log1p(r.poisonDamageBp / 10000) * 0.65;
      reasons.push("poison needs surviving targets and repeated hits");
    }
    if (r.confusionDamageBp && data.effectRules) {
      const pulses = Math.min(3, (r.confusionTicks ?? 0) / data.effectRules.confusionIntervalTicks);
      score += Math.log1p(r.confusionDamageBp / 10000 * pulses) * 0.65;
      reasons.push("confusion needs nearby surviving enemies; not direct tower DPS");
    }
    if (r.hitSlowBp !== undefined && r.hitSlowBp < 10000) {
      const floor = data.effectRules?.minSlowBp ?? 1000;
      const before = Math.max(floor, previousSlow);
      const after = Math.max(floor, previousSlow * r.hitSlowBp / 10000);
      score += Math.log(before / after) * (hasFrost ? 0.4 : 0.8);
      if (s.relics.some((id) => data.relics.find((p) => p.id === id)!.slowDamageBp > 10000)) score += 0.12;
      reasons.push("global slow enables cold payoff; diminishing return at slow floor");
    }
    return { ...offer, score, reason: reasons.join("; ") };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function distance2(s: State, a: number, b: number): number {
  return ((a % s.grid.width) - (b % s.grid.width)) ** 2 +
    (Math.floor(a / s.grid.width) - Math.floor(b / s.grid.width)) ** 2;
}

function damagePower(data: GameData, s: State, tower: Tower, level = tower.level): number {
  const type = data.towerById.get(tower.type)!;
  const stats = type.ladder[level - 1]!;
  let damage = stats.damage;
  for (const id of s.relics) {
    const r = data.relics.find((r) => r.id === id)!;
    if (r.damageType === "all" || r.damageType === type.damageType) damage *= r.damageBp / 10000;
    if (r.lowLifeDamageBp && s.lives <= (r.lowLifeThreshold ?? 0)) damage *= r.lowLifeDamageBp / 10000;
  }
  return damage / stats.cooldownTicks * (1 + Math.min(2, (type.targets - 1) * 0.35));
}

function directValue(data: GameData, s: State, command: Command | undefined): number {
  const path = pathFromEntry(s.grid, s.dist);
  const coverage = (cell: number, rangeFp: number) => path.filter((p) => distance2(s, cell, p) <= (rangeFp / SCALE) ** 2).length;
  if (command?.kind === "build") {
    const type = data.towerById.get(command.type)!;
    const tower: Tower = { cell: command.cell, type: command.type, level: 1, spent: type.cost, cooldown: 0, priority: "first" };
    return damagePower(data, s, tower) * coverage(tower.cell, type.ladder[0]!.rangeFp) / type.ladder[0]!.cost;
  }
  if (command?.kind === "upgrade") {
    const tower = s.towers.find((t) => t.cell === command.cell)!;
    const type = data.towerById.get(tower.type)!;
    const now = type.ladder[tower.level - 1]!, next = type.ladder[tower.level]!;
    return (damagePower(data, s, tower, tower.level + 1) * coverage(tower.cell, next.rangeFp) -
      damagePower(data, s, tower) * coverage(tower.cell, now.rangeFp)) / next.cost;
  }
  return 0;
}

export interface CoatingPlan { command: Command; cost: number; value: number; matchingInvestment: number }

/** Values only uncovered overlap with existing Arc/Ember firing lanes. Oil's
 * one-hit consumption caps its benefit by the coater's actual firing rate.
 * Deliberately omits pure-coater poison/confusion delivery builds; those require
 * a separate exploit-stress policy, not a claim of exhaustive strategy coverage. */
export function planCoating(data: GameData, s: State): CoatingPlan | undefined {
  if (!data.effectRules || s.towers.length < 2) return;
  const path = pathFromEntry(s.grid, s.dist);
  let best: CoatingPlan | undefined;
  for (const coat of data.towers.filter((t) => t.coating)) {
    const targets = s.towers.filter((t) => data.towerById.get(t.type)!.damageType === (coat.coating === "wet" ? "chain" : "thermal"));
    const invested = targets.reduce((n, t) => n + t.spent, 0);
    const cost = coat.ladder[0]!.cost;
    if (invested < cost * 2 || !targets.length) continue;
    const range2 = (coat.ladder[0]!.rangeFp / SCALE) ** 2;
    const existing = s.towers.filter((t) => data.towerById.get(t.type)!.coating === coat.coating);
    const weights = path.map((p) => {
      if (existing.some((t) => distance2(s, t.cell, p) <= (data.towerById.get(t.type)!.ladder[t.level - 1]!.rangeFp / SCALE) ** 2)) return 0;
      const overlapping = targets.filter((t) => distance2(s, t.cell, p) <= (data.towerById.get(t.type)!.ladder[t.level - 1]!.rangeFp / SCALE) ** 2);
      const power = overlapping.reduce((n, t) => n + damagePower(data, s, t), 0);
      const hitRate = overlapping.reduce((n, t) => n + data.towerById.get(t.type)!.targets / data.towerById.get(t.type)!.ladder[t.level - 1]!.cooldownTicks, 0);
      const coatRate = coat.targets / coat.ladder[0]!.cooldownTicks;
      if (coat.coating === "oil") {
        const bonus = data.effectRules!.oilHitBp / 10000 - 1 + data.effectRules!.oilBurnBp / 10000 * 0.6;
        return power * bonus * Math.min(1, coatRate / Math.max(0.001, hitRate));
      }
      const frostOverlap = s.towers.some((t) => data.towerById.get(t.type)!.slowTicks > 0 && distance2(s, t.cell, p) <= (data.towerById.get(t.type)!.ladder[t.level - 1]!.rangeFp / SCALE) ** 2);
      const bonus = data.effectRules!.wetLightningBp / 10000 - 1 + (frostOverlap ? (1 - data.effectRules!.wetSlowBp / 10000) * 0.5 : 0);
      // Wet persists across several attacks, unlike consumed oil. Discount
      // crowd coverage because not every target will receive the coating.
      return power * bonus * Math.min(0.85, coatRate * (coat.coatingTicks ?? 0) / 3);
    });
    const choices = Array.from({ length: s.blocked.length }, (_, cell) => ({
      cell,
      value: s.blocked[cell] ? 0 : path.reduce((n, p, i) => n + (distance2(s, cell, p) <= range2 ? weights[i]! : 0), 0) / cost,
    })).filter((c) => c.value > (best?.value ?? 0)).sort((a, b) => b.value - a.value || a.cell - b.cell);
    const choice = choices.find((c) => canBuild(s, c.cell).ok);
    if (choice) best = { command: { kind: "build", cell: choice.cell, type: coat.id }, cost, value: choice.value, matchingInvestment: invested };
  }
  return best;
}

/** Expected best public-pool quality under a with-replacement approximation.
 * This consults weights and effects, never the seeded next roll or future offers. */
function expectedOffer(data: GameData, s: State): number {
  const values = evaluateEngineerOffers(data, { ...s, relicOffers: data.relics.map((r) => r.id) })
    .sort((a, b) => a.score - b.score);
  const total = data.relics.reduce((n, r) => n + (r.offerWeight ?? 1), 0);
  let cumulative = data.relics.filter((r) => (r.sacrificeLives ?? 0) >= s.lives)
    .reduce((n, r) => n + (r.offerWeight ?? 1), 0) / total;
  let estimate = 0;
  for (const offer of values) {
    const before = cumulative;
    cumulative += (data.relics.find((r) => r.id === offer.id)!.offerWeight ?? 1) / total;
    estimate += Math.max(0, offer.score) * (cumulative ** data.relicRules.offerCount - before ** data.relicRules.offerCount);
  }
  return estimate;
}

/** Oracle-assisted frozen next-wave safety check. Reads only whether the next
 * battle clears without losing core; future drop generation is disabled in the
 * scratch simulation. No future roll or later-wave layout is inspected. */
function frozenNextWaveSafe(data: GameData, state: State): boolean {
  if (state.inWave || state.wave >= data.economy.maxWaves) return false;
  const scratch = cloneState(state);
  const combatOnly = { ...data, relicRules: { ...data.relicRules, everyWaves: 0 } };
  const target = state.wave + 1;
  step(combatOnly, scratch, [{ kind: "callWave" }]);
  const deadline = scratch.tick + 6000;
  while (scratch.outcome === "playing" && scratch.tick < deadline && scratch.stats.wavesCleared < target)
    step(combatOnly, scratch);
  return scratch.stats.wavesCleared >= target && scratch.lives === state.lives;
}

/** Reserve the existing first reroll fee before a publicly scheduled drop wave,
 * but only when an oracle-assisted frozen-defense probe predicts zero leaks.
 * The 20-tick execution cadence remains identical to the base engineer. */
function preparedEngineerPolicy(): Policy {
  const base = engineerPolicy("engineer");
  let reserveWave = -1;
  let reserveLeaks = 0;
  let safetyKey = "";
  let safe = false;
  const nextIsSafe = (data: GameData, s: State): boolean => {
    if (s.inWave) return false;
    const key = `${data.version}/${s.seed}/${s.wave}/${s.lives}/${s.relics.join(",")}/${s.raided?.join(",")}/${s.towers.map((t) => `${t.cell}:${t.type}:${t.level}:${t.priority}:${t.cooldown}`).join(",")}`;
    if (key !== safetyKey) { safe = frozenNextWaveSafe(data, s); safetyKey = key; }
    return safe;
  };
  return {
    name: "engineer-prepared",
    decide(data, s, rng) {
      if (s.tick === 0) { reserveWave = -1; reserveLeaks = 0; safetyKey = ""; }
      if (s.tick % 20) return [];
      const cheapest = Math.min(...data.towers.filter((t) => !t.coating && !t.auraBp).map((t) => t.ladder[0]!.cost));
      if (s.relicOffers.length) {
        reserveWave = -1;
        const cost = rerollCost(data, s);
        if (!s.inWave && cost !== null && s.gold >= cost + Math.ceil(cheapest / 2) && nextIsSafe(data, s)) {
          const best = evaluateEngineerOffers(data, s)[0];
          const gain = expectedOffer(data, s) - (best?.score ?? 0);
          const remaining = (data.economy.maxWaves - s.wave) / data.economy.maxWaves;
          const futureValueGold = gain * Math.max(cheapest * 3, s.stats.goldSpent) * remaining * 0.8;
          // A drop itself improves defense: when the existing board clears the
          // next encounter, retaining half a Bolt is enough for this option.
          if (gain > 0.08 && futureValueGold > cost) return [{ kind: "reroll" }];
        }
        return base.decide(data, s, rng);
      }
      if (!s.inWave) {
        const wave = s.wave + 1;
        const every = data.relicRules.everyWaves;
        const first = data.relicRules.firstOfferWave ?? every;
        const dropWave = every > 0 && wave >= first && (wave - first) % every === 0 && wave < data.economy.maxWaves;
        reserveWave = dropWave && data.relicRules.rerollBaseGold !== undefined && nextIsSafe(data, s) ? wave : -1;
        reserveLeaks = s.stats.leaks;
      }
      const emergency = s.stats.leaks > reserveLeaks || s.enemies.some((e) => s.dist[e.cell]! <= 6);
      if (emergency) reserveWave = -1;
      const activeWave = s.wave + (s.inWave ? 0 : 1);
      const reserve = reserveWave === activeWave ? Math.min(25, data.relicRules.rerollBaseGold ?? 0) : 0;
      // This is a reduced spendable-budget view, never invented gold. The real
      // sim applies every command against the player's unchanged actual bank.
      return base.decide(data, reserve ? { ...s, gold: Math.max(0, s.gold - reserve) } : s, rng);
    },
  };
}

export function engineerPolicy(name = "engineer"): Policy {
  if (name === "engineer-prepared") return preparedEngineerPolicy();
  const rookie = name === "engineer-rookie";
  const fish = name === "engineer-fish";
  const base = raiderPolicy(rookie ? "synergy-rookie" : "synergy-expert");
  return {
    name,
    decide(data, s, rng) {
      if (s.tick % 20) return [];
      if (rookie) return base.decide(data, s, rng);
      const cheapest = Math.min(...data.towers.filter((t) => !t.coating && !t.auraBp).map((t) => t.ladder[0]!.cost));
      if (s.relicOffers.length) {
        const offers = evaluateEngineerOffers(data, s);
        const best = fish ? offers.find((o) => data.relics.find((r) => r.id === o.id)!.deathBurstBp) ?? offers[0] : offers[0];
        const cost = rerollCost(data, s);
        if (!s.inWave && name !== "engineer-no-reroll" && cost !== null) {
          const reserve = fish ? Math.ceil(cheapest / 3) : cheapest;
          const canPay = s.gold >= cost + reserve && (fish || s.lives > Math.max(2, data.economy.lives / 4));
          const wantsFish = fish && !offers.some((o) => data.relics.find((r) => r.id === o.id)!.deathBurstBp);
          const gain = expectedOffer(data, s) - (best?.score ?? 0);
          const remaining = (data.economy.maxWaves - s.wave) / data.economy.maxWaves;
          const futureValueGold = gain * Math.max(cheapest * 3, s.stats.goldSpent) * remaining * 0.8;
          if (canPay && (wantsFish || (!fish && gain > 0.08 && futureValueGold > cost))) return [{ kind: "reroll" }];
        }
        return best ? [{ kind: "pickRelic", id: best.id }] : preserveKillZone(data, s, base.decide(data, s, rng));
      }
      const commands = preserveKillZone(data, s, base.decide(data, s, rng));
      // Respect prerequisite support/raid decisions made by the base planner.
      const first = commands[0];
      if (first && first.kind !== "build" && first.kind !== "upgrade" && first.kind !== "callWave") return commands;
      if (first?.kind === "build" && ["frost", "relay", "lens"].includes(first.type)) return commands;
      const plan = planCoating(data, s);
      // If the base planner is saving rather than buying, use the output/cost
      // of the existing firing lanes as a benchmark, not a zero-cost alternative.
      // This is an estimate, not an instruction to build on an occupied cell.
      const benchmark = first?.kind === "build" || first?.kind === "upgrade"
        ? directValue(data, s, first)
        : Math.max(0, ...s.towers.filter((t) => !data.towerById.get(t.type)!.coating)
          .map((t) => directValue(data, s, { kind: "build", cell: t.cell, type: t.type })));
      if (!plan || plan.value <= benchmark * 1.05) return commands;
      if (s.gold >= plan.cost) return preserveKillZone(data, s, [plan.command]);
      const emergency = s.lives <= Math.max(2, data.economy.lives / 4) || s.enemies.some((e) => s.dist[e.cell]! <= 6);
      // At most one ordinary purchase away: save real income for the better
      // coater instead of repeatedly spending each paycheck on another Bolt.
      if (!emergency && plan.cost - s.gold <= cheapest)
        return !s.inWave && s.wave > 0 ? [{ kind: "callWave" }] : [];
      return commands;
    },
  };
}
