import type { Command, GameData, RngState, State } from "@knife-edge/sim";

/**
 * A policy decides commands for the current tick. It receives its own RNG (separate from the
 * sim's, so bot randomness never perturbs the world stream) and may keep private memory.
 */
export interface Policy {
  readonly name: string;
  decide(data: GameData, state: State, rng: RngState): Command[];
}

export type PolicyFactory = (opts: Record<string, string>) => Policy;
