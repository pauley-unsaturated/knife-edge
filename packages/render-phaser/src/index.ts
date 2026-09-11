import Phaser from "phaser";
import {
  SCALE,
  enemyPos,
  pathFromEntry,
  towerAt,
  xOf,
  yOf,
  type State,
} from "@knife-edge/sim";
import { Session } from "./session.js";
export { Session } from "./session.js";

export const towerColors: Record<string, number> = {
  bolt: 0xe4bd65,
  ember: 0xeb835e,
  frost: 0x8fbeb8,
  mortar: 0xc7a0bf,
  arc: 0xb8c879,
  lens: 0xc7d9db,
  relay: 0xd7ab7f,
  sprayer: 0x69bfd9,
  solvent: 0xd5a24f,
};
export const enemyColors: Record<string, number> = {
  grunt: 0xe98166,
  swift: 0xf1d77a,
  armored: 0xb9a7d1,
  swarm: 0xb5cb7d,
  shade: 0xb8c7d4,
};
export interface BoardClient {
  session: Session;
  selectedCell: number;
  selectedType: string;
  select(cell: number): void;
  frame(deltaMs: number): void;
}

/** 256×224 placeholder board. All combat, pathing and input validation live in sim. */
export function mountBoard(
  parent: HTMLElement,
  client: BoardClient,
): Phaser.Game {
  class Board extends Phaser.Scene {
    private ink!: Phaser.GameObjects.Graphics;
    private label!: Phaser.GameObjects.Text;
    private footer!: Phaser.GameObjects.Text;
    private traces: { from: number; x: number; y: number; until: number }[] =
      [];
    private oldSession: Session | undefined;
    private bursts: { cell: number; radius: number; until: number }[] = [];
    create(): void {
      this.ink = this.add.graphics();
      this.label = this.add.text(8, 9, "LEFT: ENTRY       RIGHT: CORE", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#c9d0b9",
      });
      this.footer = this.add.text(8, 206, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#c9d0b9",
      });
      this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        const s = client.session.state;
        const x = Math.floor((pointer.x - 8) / 12),
          y = Math.floor((pointer.y - 28) / 12);
        if (x >= 0 && x < s.grid.width && y >= 0 && y < s.grid.height)
          client.select(y * s.grid.width + x);
      });
    }
    override update(_time: number, delta: number): void {
      const session = client.session;
      if (session !== this.oldSession) {
        this.traces = [];
        this.bursts = [];
        const previous = session.onEvents;
        session.onEvents = (events) => {
          previous(events);
          for (const e of events) {
            if (e.kind === "burst") this.bursts.push({ cell: e.cell, radius: e.radiusFp / SCALE * 12, until: session.state.tick + 5 });
            if (e.kind === "hit") {
              const target = session.state.enemies.find(
                (t) => t.id === e.enemy,
              );
              if (target) {
                const p = enemyPos(session.state, target);
                this.traces.push({
                  from: e.tower,
                  x: 8 + (p.x / SCALE) * 12,
                  y: 28 + (p.y / SCALE) * 12,
                  until: session.state.tick + 2,
                });
              }
            }
          }
        };
        this.oldSession = session;
      }
      client.frame(delta);
      this.draw(session.state);
    }
    private draw(s: State): void {
      const g = this.ink;
      g.clear();
      g.fillStyle(0x202c27);
      g.fillRect(0, 0, 256, 224);
      const path = new Set(pathFromEntry(s.grid, s.dist));
      for (let c = 0; c < s.blocked.length; c++) {
        const x = 8 + xOf(s.grid, c) * 12,
          y = 28 + yOf(s.grid, c) * 12;
        g.fillStyle(
          s.grid.obstacle[c] ? 0x5a6354 : path.has(c) ? 0x424b37 : 0x2b3930,
        );
        g.fillRect(x, y, 11, 11);
        if (s.grid.obstacle[c]) {
          g.lineStyle(1, 0x7a8067);
          g.lineBetween(x + 3, y + 3, x + 8, y + 8);
        }
        if (c === s.grid.entry || c === s.grid.core) {
          g.fillStyle(c === s.grid.entry ? 0xeb835e : 0xe4bd65);
          g.fillRect(x + 2, y + 2, 7, 7);
        }
      }
      const selected = towerAt(s, client.selectedCell);
      const type = client.session.data.towerById.get(
        selected?.type ?? client.selectedType,
      );
      if (client.selectedCell >= 0 && type) {
        const x = 8 + xOf(s.grid, client.selectedCell) * 12 + 5.5,
          y = 28 + yOf(s.grid, client.selectedCell) * 12 + 5.5;
        g.lineStyle(1, 0xe4bd65, 0.6);
        g.strokeCircle(
          x,
          y,
          (type.ladder[(selected?.level ?? 1) - 1]!.rangeFp / SCALE) * 12,
        );
        g.lineStyle(1, 0xf1ebd2);
        g.strokeRect(x - 5.5, y - 5.5, 11, 11);
      }
      for (const t of s.towers) {
        const x = 8 + xOf(s.grid, t.cell) * 12,
          y = 28 + yOf(s.grid, t.cell) * 12;
        g.fillStyle(towerColors[t.type] ?? 0xe4bd65);
        g.fillRect(x + 2, y + 2, 7, 7);
        g.fillStyle(0x202c27);
        g.fillRect(x + 4, y + 4, 3, 3);
        for (let l = 0; l < t.level; l++) {
          g.fillStyle(0xf1ebd2);
          g.fillRect(x + 2 + l, y + 10, 1, 1);
        }
      }
      for (const e of s.enemies) {
        const p = enemyPos(s, e),
          x = 8 + (p.x / SCALE) * 12,
          y = 28 + (p.y / SCALE) * 12;
        g.fillStyle(enemyColors[e.type] ?? 0xeb835e);
        g.fillCircle(x, y, e.type === "armored" ? 3.5 : 2.5);
        if (s.tick < e.slowUntil) {
          g.lineStyle(1, 0x8fbeb8);
          g.strokeCircle(x, y, 4);
        }
        // Compact, distinct status marks; never hide the enemy or its health.
        if ((e.wetUntil ?? 0) > s.tick) { g.fillStyle(0x69bfd9); g.fillRect(x - 5, y, 1, 3); }
        if ((e.oiledUntil ?? 0) > s.tick) { g.fillStyle(0xd5a24f); g.fillRect(x + 4, y, 1, 3); }
        if ((e.poisonUntil ?? 0) > s.tick) { g.fillStyle(0xb8c879); g.fillRect(x - 2, y + 5, 2, 1); }
        if ((e.confusedUntil ?? 0) > s.tick) { g.fillStyle(0xc7a0bf); g.fillRect(x + 1, y + 5, 2, 1); }
        if ((e.burnUntil ?? 0) > s.tick) { g.lineStyle(1, 0xeb835e); g.strokeCircle(x, y, 5); }
        if (e.hp < e.maxHp) {
          g.fillStyle(0x202c27);
          g.fillRect(x - 3, y - 5, 6, 1);
          g.fillStyle(0xe4bd65);
          g.fillRect(x - 3, y - 5, (6 * Math.max(0, e.hp)) / e.maxHp, 1);
        }
      }
      this.traces = this.traces.filter((t) => t.until >= s.tick);
      this.bursts = this.bursts.filter(b => b.until >= s.tick);
      for (const b of this.bursts) {
        g.lineStyle(1, 0xeb835e, 0.65);
        g.strokeCircle(8 + xOf(s.grid, b.cell) * 12 + 5.5, 28 + yOf(s.grid, b.cell) * 12 + 5.5, b.radius);
      }
      g.lineStyle(1, 0xf2ddb0, 0.7);
      for (const t of this.traces)
        g.lineBetween(
          8 + xOf(s.grid, t.from) * 12 + 5.5,
          28 + yOf(s.grid, t.from) * 12 + 5.5,
          t.x,
          t.y,
        );
      this.footer.setText(
        `PATH ${path.size} CELLS / ${s.enemies.length + s.spawnQueue.length} INCOMING`,
      );
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 256,
    height: 224,
    pixelArt: true,
    antialias: false,
    backgroundColor: "#202c27",
    scene: Board,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      // CSS owns the board's height. Safari may boot the game before a font
      // @import resolves; Phaser's fallback height:100% would override that CSS.
      expandParent: false,
    },
    banner: false,
    audio: { noAudio: true },
  });

  // Fonts, stylesheet loading and layout changes can resize the frame without
  // a window resize. Always refit once it has real dimensions, including when
  // Phaser skipped its parent-size binding during a zero-height boot.
  const fitBoard = (): void => {
    if (!game.scale?.canvas) return;
    const { width, height } = parent.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    game.scale.displaySize.setParent(game.scale.parentSize);
    game.scale.setParentSize(width, height);
  };
  let fitFrame = 0;
  const scheduleFit = (): void => {
    cancelAnimationFrame(fitFrame);
    // Phaser writes canvas styles; defer those writes out of observer delivery
    // so WebKit can finish the current layout without a notification loop.
    fitFrame = requestAnimationFrame(fitBoard);
  };
  const observer = new ResizeObserver(scheduleFit);
  observer.observe(parent);
  game.events.once(Phaser.Core.Events.READY, scheduleFit);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    observer.disconnect();
    cancelAnimationFrame(fitFrame);
  });
  return game;
}
