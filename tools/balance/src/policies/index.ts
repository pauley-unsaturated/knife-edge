import type { Policy } from "../policy.js";
import { greedyPolicy } from "./greedy.js";
import { randomPolicy } from "./random.js";

export function makePolicy(name: string): Policy {
  switch (name) {
    case "random":
      return randomPolicy();
    case "greedy":
      return greedyPolicy();
    case "greedy-noearly":
      return greedyPolicy({ callEarly: false });
    default: {
      const m = /^greedy-reserve(\d+)$/.exec(name);
      if (m) return greedyPolicy({ reserve: Number(m[1]) });
      throw new Error(`unknown policy ${name}`);
    }
  }
}
