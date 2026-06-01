import Type from "typebox";

import type { Static } from "typebox";

export const IdleTimeoutSchema = Type.Number();

type IdleTimeout = Static<typeof IdleTimeoutSchema>;
type IdleHash = string | number | boolean;

const POLL_MS = 1_000;

class IdleFactor {
  private idleMs: number;
  private pollMs: number;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private pollTimer: ReturnType<typeof setInterval> | undefined;

  private stable = false;
  private computeStateHash: () => IdleHash;
  private lastStateHash: IdleHash = "MAGIC_STRING";

  constructor(computeStateHash: () => IdleHash, idleMs: number, pollMs: number = POLL_MS) {
    this.computeStateHash = computeStateHash;
    this.idleMs = idleMs;
    this.pollMs = pollMs;
  }

  start(notify: () => void): void {
    this.stop();

    this.stable = false;
    this.lastStateHash = this.computeStateHash();
    this.scheduleStableCheck(notify);

    this.pollTimer = setInterval(() => {
      const current = this.computeStateHash();
      if (current === this.lastStateHash) return;

      this.stable = false;
      this.lastStateHash = current;
      this.scheduleStableCheck(notify);
    }, this.pollMs);
  }

  stop(): void {
    this.stable = false;
    this.clearIdleTimer();
    this.clearPollTimer();
  }

  isStable(): boolean {
    return this.stable;
  }

  private scheduleStableCheck(notify: () => void): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = undefined;
      this.stable = true;
      notify();
    }, this.idleMs);
  }

  private clearIdleTimer(): void {
    if (!this.idleTimer) return;

    clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
  }

  private clearPollTimer(): void {
    if (!this.pollTimer) return;

    clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }
}

export class IdleDetector {
  private state: "active" | "watching" | "idle" = "active";
  private factors: IdleFactor[] = [];
  private timeout: number;

  private enterCallbacks: Set<() => void> = new Set();
  private activityCallbacks: Set<() => void> = new Set();

  constructor(timeout: IdleTimeout = 60_000) {
    this.timeout = timeout;
  }

  addFactor(computeStateHash: () => IdleHash): void {
    this.factors.push(new IdleFactor(computeStateHash, this.timeout));
  }

  on(event: "enter" | "activity", callback: () => void): () => void {
    const callbackSet = event === "enter" ? this.enterCallbacks : this.activityCallbacks;
    callbackSet.add(callback);

    return () => callbackSet.delete(callback);
  }

  watch(): void {
    if (this.state === "idle") return;

    this.stopFactors();
    this.state = "watching";

    this.startFactors();
    this.check();
  }

  emitActivity(): void {
    this.stopFactors();
    this.state = "active";
    this.onActivity();
  }

  dispose(): void {
    this.stopFactors();
    this.state = "active";
    this.enterCallbacks.clear();
    this.activityCallbacks.clear();
  }

  private check(): void {
    if (this.state !== "watching") return;
    if (!this.factors.every((factor) => factor.isStable())) return;

    this.emitEnter();
  }

  private emitEnter(): void {
    this.stopFactors();
    this.state = "idle";
    this.onEnter();
  }

  private onEnter(): void {
    this.enterCallbacks.forEach((callback) => callback());
  }

  private onActivity(): void {
    this.activityCallbacks.forEach((callback) => callback());
  }

  private startFactors(): void {
    const notify = () => this.check();
    this.factors.forEach((factor) => factor.start(notify));
  }

  private stopFactors(): void {
    this.factors.forEach((factor) => factor.stop());
  }
}
