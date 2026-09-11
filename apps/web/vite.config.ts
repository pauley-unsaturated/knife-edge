import { defineConfig } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const dataPath = fileURLToPath(
  new URL("../../data/game.json", import.meta.url),
);
const modes = ["compound", "pact"].map(id => ({ id, path: fileURLToPath(new URL(`../../data/${id}.json`, import.meta.url)) }));
export default defineConfig({
  define: {
    __GAME_DATA__: readFileSync(dataPath, "utf8"),
    __GAME_MODES__: JSON.stringify(Object.fromEntries(modes.filter(m => existsSync(m.path)).map(m => [m.id, JSON.parse(readFileSync(m.path, "utf8"))]))),
  },
  plugins: [
    {
      name: "watch-game-data",
      configureServer(server) {
        server.watcher.add([dataPath, ...modes.map(m => m.path)]);
        server.watcher.on("change", (path) => {
          if (path === dataPath || modes.some(m => path === m.path)) void server.restart();
        });
      },
    },
  ],
  server: { port: 5173, strictPort: true },
  build: { target: "es2022" },
});
