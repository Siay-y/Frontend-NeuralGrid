import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { ChatMessage } from '../realtime/table.protocol';

export const PREVIEW_LIMIT = 3;
export const PREVIEW_DURATION_MS = 7_500;
export const REVEAL_FALLBACK_MS = 6_000;

@Injectable()
export class RollFeed {
  private readonly previewList = signal<readonly ChatMessage[]>([]);
  private readonly throwQueue = signal<readonly ChatMessage[]>([]);
  private readonly hiddenIds = signal<ReadonlySet<string>>(new Set());
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly revealTimers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly previews = this.previewList.asReadonly();
  readonly hidden = this.hiddenIds.asReadonly();
  readonly throws = this.throwQueue.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.timers.forEach((timer) => clearTimeout(timer));
      this.revealTimers.forEach((timer) => clearTimeout(timer));
    });
  }

  throwDice(message: ChatMessage): void {
    this.throwQueue.update((queue) => [...queue, message]);
  }

  takeThrow(): ChatMessage | undefined {
    const [next, ...rest] = this.throwQueue();
    if (next) {
      this.throwQueue.set(rest);
    }
    return next;
  }

  show(message: ChatMessage): void {
    if (message.kind !== 'roll' || this.previewList().some((known) => known.id === message.id)) {
      return;
    }
    const list = this.previewList();
    const overflow = Math.max(0, list.length - (PREVIEW_LIMIT - 1));
    for (const dropped of list.slice(0, overflow)) {
      this.forget(dropped.id);
      this.reveal(dropped.id);
    }
    this.previewList.set([...list.slice(overflow), message]);
    this.hiddenIds.update((ids) => new Set(ids).add(message.id));
    this.revealTimers.set(
      message.id,
      setTimeout(() => this.reveal(message.id), REVEAL_FALLBACK_MS),
    );
    this.timers.set(
      message.id,
      setTimeout(() => this.dismiss(message.id), PREVIEW_DURATION_MS),
    );
  }

  reveal(id: string): void {
    clearTimeout(this.revealTimers.get(id));
    this.revealTimers.delete(id);
    if (!this.hiddenIds().has(id)) {
      return;
    }
    this.hiddenIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  dismiss(id: string): void {
    this.forget(id);
    this.reveal(id);
    this.previewList.update((list) => list.filter((known) => known.id !== id));
  }

  private forget(id: string): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
  }
}
