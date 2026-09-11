import { canBuild, nextInt, type Command, type GameData, type RngState, type State } from "@knife-edge/sim";
import type { Policy } from "../policy.js";

/** Floor of the bot ladder: builds on random legal cells whenever it can afford to. */
export function randomPolicy(): Policy {
  return {
    name: "random",
    decide(data: GameData, s: State, rng: RngState): Command[] {
      if (s.tick % 20 !== 0) return [];
      const cmds: Command[] = [];
      const type = data.towers[nextInt(rng, data.towers.length)]!;
      if (s.gold >= type.ladder[0]!.cost) {
        for (let tries = 0; tries < 8; tries++) {
          const cell = nextInt(rng, s.grid.width * s.grid.height);
          if (canBuild(s, cell).ok) {
            cmds.push({ kind: "build", cell, type: type.id });
            break;
          }
        }
      }
      if (!s.inWave && nextInt(rng, 10) === 0) cmds.push({ kind: "callWave" });
      return cmds;
    },
  };
}
