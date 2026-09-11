import { nextInt } from "@knife-edge/sim";
import type { Policy } from "../policy.js";
import { greedyPolicy } from "./greedy.js";

/** Hold strategy constant while varying execution speed and missed opportunities. */
export function profiledPolicy(name: string): Policy {
  const strategy = greedyPolicy({ checkpoint: 1 });
  return {
    name: `player-${name}`,
    decide(data, state, rng) {
      const profile = data.playerProfiles?.[name];
      if (!profile) throw new Error(`unknown player profile ${name}`);
      if (state.tick % profile.decisionTicks !== 0) return [];
      if (profile.missChanceBp && nextInt(rng, 10000) < profile.missChanceBp)
        return [];
      return strategy.decide(data, state, rng).slice(0, profile.maxActions);
    },
  };
}
