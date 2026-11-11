import { computed, signal } from '@angular/core';

export interface CooldownRule {
  capacity: number;
  refillMs: number;
}

export interface CooldownPeriod {
  cycle: number;
  ms: number;
}

export const CHAT_COOLDOWN: CooldownRule = { capacity: 3, refillMs: 2_000 };
export const DICE_COOLDOWN: CooldownRule = { capacity: 3, refillMs: 2_000 };

const TICK_MS = 200;

export class Cooldown {
  private tokens: number;
  private updatedAt: number;
  private readyAt = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly remaining = signal(0);
  private readonly current = signal<CooldownPeriod>({ cycle: 0, ms: 0 });

  readonly waitMs = this.remaining.asReadonly();
  readonly waiting = computed(() => this.remaining() > 0);
  readonly seconds = computed(() => Math.ceil(this.remaining() / 1000));
  readonly period = this.current.asReadonly();

  constructor(
    private readonly rule: CooldownRule,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.tokens = rule.capacity;
    this.updatedAt = now();
  }

  tryTake(): boolean {
    this.refill();
    if (this.tokens < 1) {
      return false;
    }
    this.tokens -= 1;
    if (this.tokens < 1) {
      this.waitUntil(this.now() + (1 - this.tokens) * this.rule.refillMs);
    }
    return true;
  }

  hold(ms: number): void {
    this.refill();
    this.tokens = Math.min(this.tokens, 1 - ms / this.rule.refillMs);
    this.waitUntil(this.now() + ms);
  }

  dispose(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private refill(): void {
    const now = this.now();
    this.tokens = Math.min(
      this.rule.capacity,
      this.tokens + (now - this.updatedAt) / this.rule.refillMs,
    );
    this.updatedAt = now;
  }

  private waitUntil(at: number): void {
    if (at <= this.readyAt) {
      return;
    }
    this.readyAt = at;
    this.current.update(({ cycle }) => ({ cycle: cycle + 1, ms: at - this.now() }));
    this.tick();
    this.timer ??= setInterval(() => this.tick(), TICK_MS);
  }

  private tick(): void {
    const left = Math.max(0, this.readyAt - this.now());
    this.remaining.set(left);
    if (left === 0) {
      this.dispose();
    }
  }
}
