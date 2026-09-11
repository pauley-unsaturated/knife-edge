import type { Policy } from "../policy.js";
import { greedyPolicy } from "./greedy.js";
import { randomPolicy } from "./random.js";
import { profiledPolicy } from "./profile.js";
import { raiderPolicy } from "./raider.js";
import { engineerPolicy } from "./engineer.js";
import { apprenticePolicy, deliberateEngineerPolicy } from "./learning.js";

export function makePolicy(name: string): Policy {
  if (name === "engineer-apprentice") return apprenticePolicy();
  if (name === "engineer-deliberate") return deliberateEngineerPolicy();
  if (["engineer", "engineer-no-reroll", "engineer-fish", "engineer-rookie", "engineer-prepared"].includes(name)) return engineerPolicy(name);
  if (["synergy", "synergy-rookie", "synergy-deliberate", "synergy-expert", "synergy-no-raids", "synergy-all-raids", "force-cold", "force-blast", "force-ember", "force-arc", "banker", "pact"].includes(name)) return raiderPolicy(name);
  switch (name) {
    case "random":
      return randomPolicy();
    case "greedy":
      return greedyPolicy();
    case "greedy-relics":
      return greedyPolicy({ relics: true });
    case "greedy-noearly":
      return greedyPolicy({ callEarly: false });
    default: {
      if (name.startsWith("player-")) return profiledPolicy(name.slice(7));
      const m = /^greedy-reserve(\d+)$/.exec(name);
      if (m) return greedyPolicy({ reserve: Number(m[1]) });
      const k = /^greedy-k(\d+)$/.exec(name);
      if (k) return greedyPolicy({ mistakes: Number(k[1]) });
      throw new Error(`unknown policy ${name}`);
    }
  }
}
