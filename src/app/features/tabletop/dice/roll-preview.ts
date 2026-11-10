import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucideX } from '@lucide/angular';
import { describePrivacy } from '../chat/audience';
import { RollCard } from '../chat/roll-card';
import { TableState } from '../realtime/table-state';
import type { ChatMessage } from '../realtime/table.protocol';
import { loadDiceFont, prefersReducedMotion, readDiceColors } from './dice-env';
import { animatedDice, hasCriticalFailure, naturalResult, previewColumns } from './dice-rules';
import type { DiceSpinner } from './dice-spinner';
import { RollFeed } from './roll-feed';

const ROW_HEIGHT_PX = 96;
const BASE_COLUMNS = 4;

@Component({
  selector: 'app-roll-preview',
  imports: [RollCard, LucideX],
  templateUrl: './roll-preview.html',
  styleUrl: './roll-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RollPreviewCard {
  private readonly table = inject(TableState);
  private readonly feed = inject(RollFeed);
  private readonly stage = viewChild<ElementRef<HTMLCanvasElement>>('stage');
  private spinner: DiceSpinner | null = null;
  private destroyed = false;

  readonly message = input.required<ChatMessage>();
  readonly dismissed = output<void>();

  protected readonly roll = computed(() => this.message().roll);
  protected readonly dice = computed(() => {
    const roll = this.roll();
    return roll && !prefersReducedMotion() ? animatedDice(roll) : null;
  });
  protected readonly stageHeight = computed(() => {
    const count = this.dice()?.length ?? 0;
    const columns = previewColumns(count);
    const rowHeight = (ROW_HEIGHT_PX * BASE_COLUMNS) / Math.max(BASE_COLUMNS, columns);
    return Math.ceil(count / columns) * Math.round(rowHeight);
  });
  protected readonly revealed = signal(false);
  protected readonly flag = computed<'critical' | 'max' | null>(() => {
    const roll = this.roll();
    if (!roll) {
      return null;
    }
    if (hasCriticalFailure(roll)) {
      return 'critical';
    }
    return naturalResult(roll) === 'max' ? 'max' : null;
  });
  protected readonly author = computed(() => {
    const { authorId } = this.message();
    if (authorId !== null && authorId === this.table.me()?.id) {
      return 'Você';
    }
    return this.table.member(authorId)?.displayName ?? 'Conta removida';
  });
  protected readonly privacy = computed(() =>
    describePrivacy(this.message(), this.table.me()?.id ?? null, (id) => this.table.member(id)),
  );

  constructor() {
    afterNextRender(() => void this.animate());
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.spinner?.dispose();
      this.feed.reveal(this.message().id);
    });
  }

  private async animate(): Promise<void> {
    const dice = this.dice();
    const canvas = this.stage()?.nativeElement;
    if (!dice || !canvas) {
      this.finish();
      return;
    }
    try {
      const [{ DiceSpinner }] = await Promise.all([import('./dice-spinner'), loadDiceFont()]);
      if (this.destroyed) {
        return;
      }
      this.spinner = new DiceSpinner(canvas);
      await this.spinner.spin(dice, readDiceColors(canvas));
    } catch {
      this.spinner = null;
    }
    this.finish();
  }

  private finish(): void {
    this.revealed.set(true);
    this.feed.reveal(this.message().id);
  }
}
