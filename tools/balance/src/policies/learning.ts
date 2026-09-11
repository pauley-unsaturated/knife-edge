import type { Policy } from "../policy.js";
import { engineerPolicy } from "./engineer.js";
import { preserveKillZone } from "./path-guard.js";
import { raiderPolicy } from "./raider.js";

/** Limited drop knowledge and affordable-only purchasing, with the basic
 * spatial competence to preserve existing firing lanes. Historical rookie
 * behavior remains available unchanged as a separate stress control. */
export function apprenticePolicy(): Policy {
  const base = raiderPolicy("synergy-rookie");
  return { name: "engineer-apprentice", decide(data,s,rng) {
    return preserveKillZone(data,s,base.decide(data,s,rng));
  } };
}

/** Same offer knowledge, investment planner and route guard as Engineer;
 * only the action cadence changes to one decision every four simulated seconds.
 * This is an execution profile, not a calibrated lower-intelligence player. */
export function deliberateEngineerPolicy(): Policy {
  const base = engineerPolicy("engineer");
  return { name: "engineer-deliberate", decide(data,s,rng) {
    return s.tick % 80 === 0 ? base.decide(data,s,rng) : [];
  } };
}
