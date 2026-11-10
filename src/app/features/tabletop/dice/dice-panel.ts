import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideMinus, LucidePlus } from '@lucide/angular';
import { toAudience } from '../chat/audience';
import { AudienceSelect } from '../chat/audience-select';
import { MessageLog } from '../chat/message-log';
import { Collapsible } from '../panel/collapsible';
import { TableState } from '../realtime/table-state';
import { TabletopStore } from '../tabletop.store';
import {
  BONUS_LIMIT,
  clampBonus,
  DICE_QUANTITY_MAX,
  DICE_SIDES,
  diceNotation,
  formatBonus,
  parseBonus,
} from './dice-rules';

const SHAPES: Record<(typeof DICE_SIDES)[number], string> = {
  4: 'M20 5 L36 33 H4 Z M20 5 V33',
  6: 'M8 8 H32 V32 H8 Z',
  8: 'M20 4 L35 20 L20 36 L5 20 Z M5 20 H35',
  10: 'M20 4 L35 18 L20 36 L5 18 Z M5 18 L20 24 L35 18 M20 24 V36',
  12: 'M20 4 L36 15.5 L30 35 H10 L4 15.5 Z M20 10 L28 16 L25 26 H15 L12 16 Z',
  20: 'M20 3 L35 11.5 V28.5 L20 37 L5 28.5 V11.5 Z M20 11 L29 26 H11 Z',
  100: 'M20 4 A16 16 0 1 1 19.99 4 Z M14 12 H26 L31 20 L26 28 H14 L9 20 Z M14 12 L20 4 M26 12 L20 4 M14 28 L20 36 M26 28 L20 36 M9 20 H4 M31 20 H36',
};

@Component({
  selector: 'app-dice-panel',
  imports: [AudienceSelect, Collapsible, MessageLog, LucideMinus, LucidePlus],
  templateUrl: './dice-panel.html',
  styleUrl: './dice-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DicePanel {
  private readonly table = inject(TableState);
  protected readonly store = inject(TabletopStore);

  protected readonly dice = DICE_SIDES;
  protected readonly shapes = SHAPES;
  protected readonly maxQuantity = DICE_QUANTITY_MAX;
  protected readonly quantity = signal(1);
  protected readonly rolling = signal(false);
  protected readonly bonusLimit = BONUS_LIMIT;
  protected readonly bonus = signal(0);
  protected readonly bonusText = computed(() => formatBonus(this.bonus()));

  protected changeQuantity(step: number): void {
    this.quantity.update((value) => Math.min(DICE_QUANTITY_MAX, Math.max(1, value + step)));
  }

  protected changeBonus(step: number): void {
    this.bonus.update((value) => clampBonus(value + step));
  }

  protected typeBonus(event: Event): void {
    const field = event.target as HTMLInputElement;
    const value = parseBonus(field.value);
    this.bonus.set(value);
    field.value = formatBonus(value);
  }

  protected notation(sides: number): string {
    return diceNotation(this.quantity(), sides, this.bonus());
  }

  protected async roll(sides: number): Promise<void> {
    if (this.rolling()) {
      return;
    }
    this.rolling.set(true);
    await this.table.rollDice(this.notation(sides), null, toAudience(this.store.chatAudience()));
    this.rolling.set(false);
  }
}
