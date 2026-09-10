---
id: A5FDC4A0-CEDB-480C-AFCD-6A2865593651
created: 2026-09-10T05:47:59Z
modified: 2026-09-10T05:47:59Z
tags: [research, stratum-1, engines, pixellab, art-pipeline]
---
# Research - Engines and Art Pipeline

*Stratum 1. Append-only. Compiled 2026-09-10. The session's egress proxy blocked pixellab.ai, docs.godotengine.org, defold.com, bevy.org, ebitengine.org, unity.com and lexaloffle.com; GitHub-hosted docs, PyPI and search excerpts were used instead. Items that could not be verified are marked NOT FOUND or unverified.*

Feeds: branch B3 and B12 in [[Branch Register]] · [[ADR-0005-stack]] · [[Balance Toolkit Plan]].

---

## Part A: Engine and stack choice

### Cross-cutting facts

- **iOS export always needs a Mac + Xcode**, for every engine. Godot: "You must export for iOS from a computer running macOS with Xcode installed" ([godot-docs](https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/export/exporting_for_ios.rst)). Defold cannot bundle an `.ipa` on Linux because bob needs `lipo` ([defold#5409](https://github.com/defold/defold/issues/5409)). So the Linux agent produces sim tests, desktop/web builds, and iOS-ready source; the Mac mini does the iOS shell.
- **Determinism:** fixed timestep + seeded RNG is necessary but not sufficient if the sim uses floats across native/wasm/ARM. Standard advice is integer/fixed-point math in the authoritative sim and floats only in rendering ([Gaffer On Games](https://gafferongames.com/post/floating_point_determinism/), [Game Developer](https://www.gamedeveloper.com/programming/cross-platform-rts-synchronization-and-floating-point-indeterminism)). Godot's `RandomNumberGenerator` "should not be depended upon for reproducible random streams across Godot versions" ([Godot RNG doc](https://github.com/godotengine/godot/blob/master/doc/classes/RandomNumberGenerator.xml)), one more reason to own the RNG in the sim core.

### Candidates

**1. Godot 4.x (4.7 released 2026-06-18; 4.7.2 on 2026-08-18)** ([Jettelly 4.7](https://jettelly.com/blog/godot-4-7-is-now-available-more-new-tools-for-developers))
- *iOS:* mature for GDScript. C# iOS is "experimental and has a few limitations" via NativeAOT ([C# docs](https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/scripting/c_sharp/index.rst)).
- *Web:* since 4.3 the **single-threaded export is the default and preferred**: no SharedArrayBuffer/COOP/COEP needed, works on itch/Poki, and "works very well on macOS and iOS" Safari. WebGL 2 / Compatibility renderer only ([web export docs](https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/export/exporting_for_web.rst), [4.3 web report](https://godotengine.org/article/progress-report-web-export-in-4-3/)). **C# web export is still unsupported**; the enabling PR [GH-106125](https://github.com/godotengine/godot/pull/106125) is a draft. So GDScript is the only Godot path to web + iOS today.
- *Headless sim:* `godot --headless` runs without a display; GUT and gdUnit4 have CLI runners ([gdUnit4](https://github.com/godot-gdunit-labs/gdUnit4), [CI guide](https://helpmetest.com/blog/godot-ci-cd-testing/)). Caveat: the sim is engine-hosted, GDScript cannot run outside the engine binary, and GDScript is slow for thousands of batch runs. 4.6 added LibGodot (embed as a library), which is new.
- *Iteration:* GDScript hot-reloads; C# needs a build per run.
- *Agent-friendliness:* good; `.tscn`/`.tres`/`.gd` are text; CLI export via `godot --headless --export-release`. GDScript typing is weaker than TS/Rust/Go.
- *Pixel-perfect:* first-class; stretch `canvas_items` + `integer` scale, Nearest filter ([GDQuest](https://www.gdquest.com/library/pixel_art_setup_godot4/)).
- *License:* MIT.

**2. Defold (1.13.1, 2026-08-17)** ([releases](https://github.com/defold/defold/releases))
- iOS and HTML5 both first-class, small builds; but Lua is plain 5.1 on iOS and HTML5 (no JIT).
- Headless: `bob.jar --variant=headless` and DefTest in CI ([deftest](https://github.com/britzl/deftest)); native extensions compile on a central build server, an external CI dependency.
- Pixel-perfect via custom render script ([template-lowres](https://github.com/britzl/template-lowres)).
- License: free, source-available custom license ([LICENSE](https://raw.githubusercontent.com/defold/defold/dev/LICENSE.txt)).

**3. Phaser 4 + TypeScript + Capacitor (Phaser 4.2.1, 2026-07-09; 4.0 shipped 2026-04-10)** ([releases](https://github.com/phaserjs/phaser/releases))
- *Web:* native; this is a web framework. New render-node WebGL renderer in v4.
- *iOS:* Capacitor wraps the build in WKWebView; Xcode on the Mac signs ([Capacitor games guide](https://capacitorjs.com/docs/guides/games), [phaser-capacitor](https://github.com/gnesher/phaser-capacitor)). Historical WKWebView WebGL perf regressions ([cordova-ios#1246](https://github.com/apache/cordova-ios/issues/1246)); a low-res 2D TD is well within budget, but it is a WebView app, not native.
- *Headless sim:* **best of all candidates**: a plain TS package with zero Phaser import, tested with vitest on Node in the Linux container; Phaser is only the renderer adapter.
- *Iteration:* Vite HMR, sub-second. *Agent-friendliness:* excellent (npm, vitest, tsc, all text).
- *Pixel-perfect:* `render.pixelArt: true`, `roundPixels`, `smoothPixelArt` ([Phaser 4 Pixel Art Guide](https://github.com/phaserjs/phaser/blob/master/docs/Phaser%204%20Pixel%20Art%20Guide/Phaser%204%20Pixel%20Art%20Guide.md)). Integer window scaling is done by hand: zoom = floor(min(w/W, h/H)).
- *License:* MIT.

**4. Bevy (0.19.1, 2026-08-13)**: iOS supported via examples/mobile + Xcode, no notable App Store shipped Bevy games found; wasm via wasm-bindgen, single-threaded on web; headless via `MinimalPlugins` or, better, a plain Rust crate; Rust compile times and breaking API changes every ~3 months ([README](https://github.com/bevyengine/bevy/blob/main/README.md)). MIT/Apache-2.0.

**5. macroquad (0.4.16)**: desktop/HTML5/Android/iOS from one codebase; iOS via hand-assembled `.app` (article blocked, unverified); lighter than Bevy, same plain-crate sim story; less polish for store submission ([repo](https://github.com/not-fl3/macroquad)).

**6. Ebitengine (Go)** ([README](https://github.com/hajimehoshi/ebiten/blob/main/README.md)): official WebAssembly and iOS/Android; `ebitenmobile bind -target ios` generates an XCFramework ([wiki/iOS](https://github.com/hajimehoshi/ebiten/wiki/iOS)); plain Go package sim with `go test`; offscreen `ebiten.Image` + `FilterNearest` for low-res rendering; Go wasm binaries are several MB and single-threaded. Apache-2.0.

**7. Haxe (HaxeFlixel 6.2 / Heaps)**: HTML5 and iOS both possible; Flixel "stuck with outdated versions of OpenFL and Lime" ([HaxeFlixel blog](https://haxeflixel.com/blog/)); thin tooling and agent familiarity.

**8. LÖVE (11.5; 12.0 unreleased)**: iOS supported; web only via third-party love.js ([love.js](https://github.com/2dengine/love.js/)); fragile web story.

**9. Unity 6**: Runtime Fee cancelled; Personal free under $200k; Pro +5% from 2026-01-12 ([Unity](https://unity.com/products/pricing-updates)). Multi-GB editor with license activation is the worst fit for a container-based agent. Proprietary.

**10. PICO-8 / TIC-80**: prototyping only. PICO-8 exports HTML and desktop; iOS "remains on the wishlist". TIC-80 iOS ports unmaintained. Neither gives a reusable sim core.

**11. MonoGame / FNA**: iOS yes; no official web target ([MonoGame#8102](https://github.com/MonoGame/MonoGame/issues/8102)).

**12. SpriteKit**: iOS-only, no web. Disqualified by the web requirement.

### Ranked recommendation

| Rank | Stack | Why |
|---|---|---|
| **1** | **TypeScript sim core + Phaser 4 renderer + Capacitor iOS shell** | Only stack where web is native, iOS is routine, and the sim is a dependency-free package tested with vitest in the Linux container. Highest agent friendliness. Cost: WebView-based iOS app (acceptable for a 2D pixel TD). |
| **2** | **Go sim package + Ebitengine renderer** | Official iOS and wasm, `go test` headless, one toolchain, tiny API surface. Cost: heavier wasm payload, smaller ecosystem for UI/IAP. |
| **3** | **Godot 4.7 GDScript** | Best editor, integer-scale pixel-perfect out of the box, single-threaded web export solved the SAB problem. Cost: sim lives inside Godot (slow batch sims, engine-hosted tests), no C# web path. |
| 4 | Rust crate + macroquad (or Bevy) | Great headless story; iOS store pipeline least-trodden; Bevy churns quarterly. |
| 5 | Defold | Solid HTML5/iOS but Lua 5.1 without JIT on both targets and Mac-only iOS bundling. |
| - | Unity, Haxe, LÖVE, MonoGame/FNA, PICO-8/TIC-80, SpriteKit | Fail at least one hard requirement. |

### Suggested architecture for rank 1 (rank 2 maps one-to-one onto Go packages)

```
packages/
  sim/            pure TS, no DOM, no Phaser
    rng.ts        PCG32/xoshiro, seed in; never Math.random
    fixed.ts      integer math (1/256 px units) for positions/damage
    world.ts      step(state, inputs, dt=1/60) -> state  (fixed timestep)
    waves.ts, towers.ts, offers.ts
    events.ts     emits render intents (SpawnedEnemy, TowerFired); no sprites
  render-phaser/  adapter: consumes sim events/state -> Phaser scene;
                  pixelArt:true, 256x224 canvas, integer zoom;
                  placeholder atlas swapped for Pixellab atlas via one manifest
  shell-web/      Vite app
  shell-ios/      Capacitor project (Mac mini only)
tools/
  balance-cli/    node: imports sim, runs N seeds x M configs, outputs CSV/JSON
```

- The balance CLI and the game import the *same* sim package; determinism test = run seed S twice and hash the state stream, plus a golden-run snapshot committed to the repo.
- Keep floats out of the sim. A "same engine everywhere" float policy (V8 in Node, JavaScriptCore in WKWebView) is close to deterministic but not provable across JITs; fixed-point removes the doubt.

---

## Part B: Pixellab API

**What the public API offers (2026).** Two generations of REST API: **v1** (legacy, deprecated) at `https://api.pixellab.ai/v1` and **v2** at `https://api.pixellab.ai/v2` (docs at `api.pixellab.ai/v2/docs`, LLM-friendly index `api.pixellab.ai/v2/llms.txt`) ([Ways to use PixelLab](https://www.pixellab.ai/docs/ways-to-use-pixellab), [API page](https://www.pixellab.ai/pixellab-api)). Official SDKs ([pixellab-python](https://github.com/pixellab-code/pixellab-python), [pixellab-js](https://github.com/pixellab-code/pixellab-js)) target v1 and expose `generate_image_pixflux` (text to image), `generate_image_bitforge` (reference-image style matching), `animate_with_skeleton`, `animate_with_text`, `inpaint`, `rotate` (directional views), `get_balance`; parameters include `image_size`, `no_background`, guidance scale, detail/shading/outline modifiers, negative prompt. v2 adds map/tileset generation: `create_topdown_tileset` (Wang tilesets), Create Map, Extend Map, Create Tiles Pro; the community [PixelLab-MCP](https://github.com/flynnsbit/PixelLab-MCP) reports 21 v2 endpoints. Exact v2 paths: unverified.

**Authentication.** Bearer token (`Authorization: Bearer <token>`); SDKs read `PIXELLAB_SECRET`. The token is obtained after signing in via pixellab.ai/mcp ([pixellab-mcp README](https://github.com/pixellab-code/pixellab-mcp)). Whether the same token is on a generic account page: NOT FOUND.

**MCP server.** Official `pixellab-code/pixellab-mcp` is a hosted HTTP MCP endpoint (`https://api.pixellab.ai/mcp`) with tools for 4/8-direction characters, animations, Wang tilesets and isometric tiles.

**Pricing.** Subscriptions for the web app plus separate pay-per-call API billing. Web tiers (numbers vary by source; confirm on the pricing page): Apprentice $12/mo (320x320, ~2,000 gen/mo); Artisan $24/mo (400x400, ~5,000/mo); Architect $50/mo (20 concurrent jobs, ~10,000/mo) ([cutout.pro](https://www.cutout.pro/learn/pixellab/), [flowtools](https://www.flowtools.co/pixellab)). API credits: PixFlux $0.00793 at 64x64 or 128x128, $0.0101 at 320x320, $0.0132 at 400x400 (search excerpt from the API page). Per-call USD for animate/rotate/tileset: NOT FOUND. Web-app rule: basic tools use 1 credit per request; a 32x32 animation request yields 16 frames ([Animation doc](https://www.pixellab.ai/docs/tools/animation)). Tilesets cost 1-4 generations ([Create tileset](https://www.pixellab.ai/docs/tools/create-tileset)).

**Palette limits.** A color-count slider (2-64) builds a custom palette per image, and a preset palette (e.g., from Lospec) can be forced so output colors match hex codes exactly ([Color options](https://www.pixellab.ai/docs/options/color)). No dedicated NES mode, but forcing a 3+transparent sub-palette or the NES master palette is expressible. Whether forced palette is exposed on every v2 endpoint: unverified.

**Rate limits.** No published numbers; only per-tier concurrency and priority queues.

**Aseprite extension.** Requires Aseprite 1.3+; one-time purchase ($65 full / $20 Lite per one source); animation and newest models are web/API-only ([Installation doc](https://www.pixellab.ai/docs/installation)).

**Can a Linux-container agent call it?** Yes: plain HTTPS REST with a Bearer token (JSON in, base64 PNG out), or the hosted MCP endpoint. This session's proxy blocked `api.pixellab.ai`, so the allowlist would need it.

**Rough cost of a 32x32 4-direction character with walk cycles.** 1-3 base generations + ~3 rotations + 4 walk animations, roughly 8-10 credits, under 1% of the $12 tier's monthly allowance; via pay-per-call, on the order of $0.10-0.20 per character (estimate; animation/rotate rates were not retrievable).

## Takeaways for this project

- Rank 1 stack satisfies C1, C4, C5, C8 in [[Constraints]]. Recorded as [[ADR-0005-stack]].
- Pixellab is usable programmatically later (B12), with palette forcing for the NES look. Not needed until the placeholder phase ends, per C5.
