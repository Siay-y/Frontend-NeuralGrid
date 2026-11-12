import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
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
  private introTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly intro = signal<CombatIntro | null>(null);
  protected readonly passing = signal(false);
  protected readonly inFight = computed(() => {
    const me = this.table.me();
    const combat = this.table.combat();
    return (
      !!me &&
      me.role !== 'master' &&
      combat.round > 0 &&
      combat.combatants.some(({ tokenId }) => this.table.token(tokenId)?.ownerId === me.id)
    );
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.introTimer));
    effect(() => {
      const seq = this.table.combatStarts();
      if (seq > 0) {
        untracked(() => this.showIntro(seq));
      }
    });
  }

  protected closeIntro(): void {
    clearTimeout(this.introTimer);
    this.intro.set(null);
  }

  protected async pass(): Promise<void> {
    const turnId = this.table.combat().turnId;
    if (!turnId || this.passing() || !this.table.myTurn()) {
      return;
    }
    this.passing.set(true);
    try {
      await this.table.passTurn(turnId);
    } finally {
      this.passing.set(false);
    }
  }

  private showIntro(seq: number): void {
    clearTimeout(this.introTimer);
    const intro = combatIntro(
      seq,
      this.table.combat(),
      (id) => this.table.token(id),
      this.table.me()?.id ?? null,
    );
    if (intro.places.length === 0) {
      this.intro.set(null);
      return;
    }
    this.intro.set(intro);
    this.introTimer = setTimeout(() => this.intro.set(null), INTRO_MS);
  }
}
