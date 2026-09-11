import {
  createState,
  deriveData,
  hashState,
  makeReplay,
  replayState,
  step,
  validateReplay,
  type Command,
  type Event,
  type GameData,
  type Replay,
  type State,
  type TimedCommand,
} from "@knife-edge/sim";

/** UI clock and replay transport. Gameplay always advances through the shared step. */
export class Session {
  state: State;
  commands: TimedCommand[] = [];
  paused = true;
  speed = 1;
  replay: Replay | undefined;
  replayIndex = 0;
  verification = "";
  private accumulator = 0;
  onEvents: (events: Event[]) => void = () => {};

  constructor(
    public data: GameData,
    seed: number,
  ) {
    this.state = createState(data, seed);
  }

  command(cmd: Command): void {
    if (this.replay || this.state.outcome !== "playing") return;
    this.commands.push({ tick: this.state.tick, cmd });
    this.onEvents(step(this.data, this.state, [cmd]));
    this.checkStop();
  }

  tick(): boolean {
    if (
      this.state.outcome !== "playing" ||
      (this.replay?.endTick !== undefined &&
        this.state.tick >= this.replay.endTick)
    ) {
      this.checkStop();
      return false;
    }
    const commands: Command[] = [];
    if (this.replay)
      while (
        this.replayIndex < this.replay.commands.length &&
        this.replay.commands[this.replayIndex]!.tick === this.state.tick
      )
        commands.push(this.replay.commands[this.replayIndex++]!.cmd);
    this.onEvents(step(this.data, this.state, commands));
    this.checkStop();
    return true;
  }

  frame(deltaMs: number): void {
    if (this.paused) {
      this.accumulator = 0;
      return;
    }
    this.accumulator += Math.min(250, Math.max(0, deltaMs)) * this.speed;
    const tickMs = 1000 / this.data.economy.tickRate;
    while (this.accumulator >= tickMs && !this.paused) {
      this.accumulator -= tickMs;
      if (!this.tick()) break;
    }
  }

  /** Bounded chunk; callers yield to the browser between chunks. */
  advanceToWaveEnd(targetWave: number, maxSteps = 1000): boolean {
    for (let i = 0; i < maxSteps; i++) {
      if (this.state.stats.wavesCleared >= targetWave || !this.tick())
        return true;
    }
    return (
      this.state.stats.wavesCleared >= targetWave ||
      this.state.outcome !== "playing"
    );
  }

  load(replay: Replay): void {
    validateReplay(replay);
    if (replay.data) this.data = deriveData(replay.data);
    if (replay.dataVersion !== this.data.version)
      throw new Error("Replay uses different game data.");
    this.replay = replay;
    this.state = replayState(this.data, replay);
    this.commands = [];
    this.replayIndex = 0;
    this.paused = true;
    this.accumulator = 0;
    this.verification = replay.initialWave
      ? `Isolated wave ${replay.initialWave} probe · starting gold is a solver allowance`
      : "Playback ready";
    this.checkStop();
  }

  /** Restore a partial human run and continue recording at the exact saved tick. */
  resume(replay: Replay): void {
    if (replay.initialWave)
      throw new Error(
        "Balance probes can be watched, but cannot resume as normal runs.",
      );
    if (replay.endTick === undefined || replay.finalHash === undefined)
      throw new Error("Save has no checkpoint.");
    this.load(replay);
    while (this.state.tick < replay.endTick && this.tick()) {
      /* bounded by validated endTick */
    }
    if (hashState(this.state) !== replay.finalHash)
      throw new Error("Save verification failed.");
    this.commands = [...replay.commands];
    this.replay = undefined;
    this.verification = "Save verified";
    this.paused = true;
  }

  export(): Replay {
    return this.replay ?? makeReplay(this.data, this.state, this.commands);
  }

  private checkStop(): void {
    const ended =
      this.state.outcome !== "playing" ||
      (this.replay?.endTick !== undefined &&
        this.state.tick >= this.replay.endTick);
    if (!this.replay && this.state.relicOffers.length) this.paused = true;
    if (!ended) return;
    this.paused = true;
    if (this.replay)
      this.verification =
        this.replay.finalHash === undefined
          ? "Replay ended · no reference hash"
          : hashState(this.state) === this.replay.finalHash
            ? "Replay verified · exact match"
            : "REPLAY MISMATCH · please keep this file";
  }
}
