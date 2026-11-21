import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { LucideChevronDown } from '@lucide/angular';
import { TableState } from '../realtime/table-state';
import type { TableCombat, TableToken } from '../realtime/table.protocol';
import { TokenGlyph } from '../tokens/token-glyph';

export interface UpcomingTurn {
  key: string;
  token: TableToken;
  current: boolean;
  nextRound: boolean;
}

export const UPCOMING_LIMIT = 5;

export function upcomingTurns(
  combat: TableCombat,
  token: (id: string) => TableToken | undefined,
  limit = UPCOMING_LIMIT,
): UpcomingTurn[] {
  const order = combat.combatants.flatMap(({ tokenId }) => {
    const found = token(tokenId);
    return found ? [found] : [];
  });
  const start = Math.max(
    0,
    order.findIndex(({ id }) => id === combat.turnId),
  );
  const current = order.some(({ id }) => id === combat.turnId);
  return Array.from({ length: Math.min(limit, order.length) }, (_, step) => {
    const index = start + step;
    const found = order[index % order.length];
    return {
      key: `${found.id}:${Math.floor(index / order.length)}`,
      token: found,
      current: current && step === 0,
      nextRound: index >= order.length,
    };
  });
}

@Component({
  selector: 'app-turn-hud',
  imports: [LucideChevronDown, TokenGlyph],
  templateUrl: './turn-hud.html',
  styleUrl: './turn-hud.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TurnHud {
  protected readonly table = inject(TableState);
  protected readonly open = signal(true);
  protected readonly round = computed(() => this.table.combat().round);
  protected readonly turns = computed(() =>
    upcomingTurns(this.table.combat(), (id) => this.table.token(id)),
  );
  protected readonly now = computed(() => this.turns().find(({ current }) => current) ?? null);
  protected readonly passing = signal(false);
  protected readonly inFight = computed(() => {
    const me = this.table.me();
    return (
      !!me &&
      me.role !== 'master' &&
      this.table
        .combat()
        .combatants.some(({ tokenId }) => this.table.token(tokenId)?.ownerId === me.id)
    );
  });

  constructor() {
    effect(() => {
      if (this.round() > 0) {
        untracked(() => this.open.set(true));
      }
    });
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

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected fallen(token: TableToken): string | null {
    const death = this.table.deathOf(token.id);
    if (!death) {
      return null;
    }
    return death.turns === null ? 'morto' : 'caído';
  }

  protected isMine(token: TableToken): boolean {
    const me = this.table.me();
    return !!me && token.ownerId === me.id;
  }
}
