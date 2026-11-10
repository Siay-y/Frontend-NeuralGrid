import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LucideMinus, LucidePlus } from '@lucide/angular';
import { toAudience } from '../chat/audience';
import { AudienceSelect } from '../chat/audience-select';
import { MessageLog } from '../chat/message-log';
import { TableState } from '../realtime/table-state';
import { TabletopStore } from '../tabletop.store';
import { DICE_QUANTITY_MAX, DICE_SIDES, diceNotation } from './dice-rules';

const SHAPES: Record<(typeof DICE_SIDES)[number], string> = {
  4: 'M20 5 L36 33 H4 Z M20 5 V33',
  6: 'M8 8 H32 V32 H8 Z',
  8: 'M20 4 L35 20 L20 36 L5 20 Z M5 20 H35',
  10: 'M20 4 L35 18 L20 36 L5 18 Z M5 18 L20 24 L35 18 M20 24 V36',
  12: 'M20 4 L36 15.5 L30 35 H10 L4 15.5 Z M20 10 L28 16 L25 26 H15 L12 16 Z',
  20: 'M20 3 L35 11.5 V28.5 L20 37 L5 28.5 V11.5 Z M20 11 L29 26 H11 Z',
  100: 'M13 6 L22 15 L13 31 L4 15 Z M28 9 L37 18 L28 34 L19 18 Z',
};

@Component({
  selector: 'app-dice-panel',
  imports: [AudienceSelect, MessageLog, LucideMinus, LucidePlus],
  templateUrl: './dice-panel.html',
  styleUrl: './dice-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DicePanel {
  private readonly table = inject(TableState);
  private readonly store = inject(TabletopStore);

  protected readonly dice = DICE_SIDES;
  protected readonly shapes = SHAPES;
  protected readonly maxQuantity = DICE_QUANTITY_MAX;
  protected readonly quantity = signal(1);
  protected readonly rolling = signal(false);

  protected changeQuantity(step: number): void {
    this.quantity.update((value) => Math.min(DICE_QUANTITY_MAX, Math.max(1, value + step)));
  }

  protected async roll(sides: number): Promise<void> {
    if (this.rolling()) {
      return;
    }
    this.rolling.set(true);
    await this.table.rollDice(
      diceNotation(this.quantity(), sides),
      null,
      toAudience(this.store.chatAudience()),
    );
    this.rolling.set(false);
  }
}
