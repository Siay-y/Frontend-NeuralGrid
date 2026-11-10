import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { LucideArrowDown } from '@lucide/angular';
import { RollFeed } from '../dice/roll-feed';
import { TableState } from '../realtime/table-state';
import type { ChatMessage } from '../realtime/table.protocol';
import { describePrivacy } from './audience';
import { buildLogEntries } from './log-entries';
import { RollCard } from './roll-card';

const STICKY_THRESHOLD_PX = 48;

@Component({
  selector: 'app-message-log',
  imports: [RollCard, LucideArrowDown],
  templateUrl: './message-log.html',
  styleUrl: './message-log.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageLog {
  private readonly table = inject(TableState);
  protected readonly feed = inject(RollFeed);
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  readonly rollsOnly = input(false);
  readonly emptyText = input('Nada por aqui ainda.');

  private readonly pinned = signal(true);
  private readonly seenCount = signal(0);

  protected readonly entries = computed(() => {
    const me = this.table.me();
    const messages: readonly ChatMessage[] = this.rollsOnly()
      ? this.table.messages().filter((message) => message.kind === 'roll')
      : this.table.messages();
    return buildLogEntries(messages, {
      myId: me?.id ?? null,
      memberOf: (id) => this.table.member(id),
      privacyOf: (message) =>
        describePrivacy(message, me?.id ?? null, (id) => this.table.member(id)),
      now: new Date(),
    });
  });

  protected readonly newBelow = computed(() =>
    this.pinned() ? 0 : Math.max(0, this.entries().length - this.seenCount()),
  );

  constructor() {
    effect(() => {
      if (this.pinned()) {
        this.seenCount.set(this.entries().length);
      }
    });
    afterRenderEffect(() => {
      this.entries();
      if (this.pinned()) {
        const element = this.scroller().nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  protected onScroll(): void {
    const element = this.scroller().nativeElement;
    this.pinned.set(
      element.scrollHeight - element.scrollTop - element.clientHeight < STICKY_THRESHOLD_PX,
    );
  }

  protected jumpToLatest(): void {
    const element = this.scroller().nativeElement;
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    this.pinned.set(true);
  }
}
