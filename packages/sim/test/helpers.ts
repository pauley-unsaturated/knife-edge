import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deriveData, type GameData, type RawGameData } from "../src/index.js";

export function loadData(): GameData {
  const p = fileURLToPath(new URL("../../../data/game.json", import.meta.url));
  return deriveData(JSON.parse(readFileSync(p, "utf8")) as RawGameData);
}
