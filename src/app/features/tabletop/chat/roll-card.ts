import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { dieOutcome, rollHighlights } from '../dice/dice-rules';
import type { RollResult } from '../realtime/table.protocol';

@Component({
  selector: 'app-roll-card',
  templateUrl: './roll-card.html',
  styleUrl: './roll-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RollCard {
  readonly roll = input.required<RollResult>();
  readonly pending = input(false);

  protected readonly highlights = computed(() => rollHighlights(this.roll()));
  protected readonly outcome = dieOutcome;
  protected readonly title = computed(() => this.roll().label ?? 'Rolagem');
  protected readonly summary = computed(() => {
    const roll = this.roll();
    if (this.pending()) {
      return `${this.title()}: rolando ${roll.notation}.`;
    }
    const dice = roll.terms
      .map((term) =>
        term.kind === 'dice'
          ? term.rolls.map((die) => (die.kept ? String(die.value) : `(${die.value})`)).join(' ')
          : String(term.value),
      )
      .join(', ');
    return `${this.title()}: ${roll.total}. ${roll.notation}, dados ${dice}.`;
  });
}
