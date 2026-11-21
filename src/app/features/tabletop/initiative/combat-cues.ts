import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CinematicQueue } from '../cinematic-queue';
import { TableState } from '../realtime/table-state';
import { CombatIntroBand } from './combat-intro-band';
import type { TableCombat, TableToken } from '../realtime/table.protocol';

export interface CombatPlace {
  label: string;
  position: number;
  initiative: number | null;
}

export interface CombatIntro {
  seq: number;
  round: number;
  places: CombatPlace[];
  first: string | null;
  firstIsMine: boolean;
}

const INTRO_MS = 3_600;

export function combatIntro(
  seq: number,
  combat: TableCombat,
  token: (id: string) => TableToken | undefined,
  meId: string | null,
): CombatIntro {
  const order = combat.combatants.filter(({ tokenId }) => token(tokenId));
  const places = order.flatMap((combatant, index) => {
    const owned = token(combatant.tokenId);
    return owned && meId !== null && owned.ownerId === meId
      ? [{ label: owned.label, position: index + 1, initiative: combatant.initiative }]
      : [];
  });
  const first = combat.turnId ? token(combat.turnId) : undefined;
  return {
    seq,
    round: combat.round,
    places,
    first: first?.label ?? null,
    firstIsMine: !!first && meId !== null && first.ownerId === meId,
  };
}

@Component({
  selector: 'app-combat-cues',
  imports: [CombatIntroBand],
  templateUrl: './combat-cues.html',
  styleUrl: './combat-cues.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closeIntro()' },
})
export class CombatCues {
  protected readonly table = inject(TableState);
  private readonly queue = inject(CinematicQueue);

  protected readonly intro = signal<CombatIntro | null>(null);

  constructor() {
    effect(() => {
      const seq = this.table.combatStarts();
      if (seq > 0) {
        untracked(() => this.showIntro(seq));
      }
    });
  }

  protected closeIntro(): void {
    if (this.intro()) {
      this.queue.skip();
    }
  }

  private showIntro(seq: number): void {
    const intro = combatIntro(
      seq,
      this.table.combat(),
      (id) => this.table.token(id),
      this.table.me()?.id ?? null,
    );
    if (intro.places.length === 0) {
      return;
    }
    this.queue.play({
      duration: INTRO_MS,
      show: () => this.intro.set(intro),
      hide: () => this.intro.set(null),
    });
  }
}
