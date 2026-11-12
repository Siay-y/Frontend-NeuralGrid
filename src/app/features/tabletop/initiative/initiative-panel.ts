import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideDices,
  LucideEye,
  LucideEyeOff,
  LucidePlus,
  LucideX,
} from '@lucide/angular';
import { ActionMenu } from '../panel/action-menu';
import { Collapsible } from '../panel/collapsible';
import { TableState } from '../realtime/table-state';
import {
  INITIATIVE_LIMITS,
  type TableCombatant,
  type TableToken,
} from '../realtime/table.protocol';
import { TabletopStore } from '../tabletop.store';
import { TokenGlyph } from '../tokens/token-glyph';

interface CombatRow extends TableCombatant {
  token: TableToken;
  rollable: boolean;
}

const END_CONFIRM_MS = 3_000;
const ADD_SECTION = 'initiative-add';

export function parseInitiative(raw: string): number | null | undefined {
  const text = raw.trim();
  if (text === '') {
    return null;
  }
  const value = Number(text);
  return Number.isInteger(value) && value >= INITIATIVE_LIMITS.min && value <= INITIATIVE_LIMITS.max
    ? value
    : undefined;
}

@Component({
  selector: 'app-initiative-panel',
  imports: [
    ActionMenu,
    Collapsible,
    TokenGlyph,
    LucideChevronLeft,
    LucideChevronRight,
    LucideDices,
    LucideEye,
    LucideEyeOff,
    LucidePlus,
    LucideX,
  ],
  templateUrl: './initiative-panel.html',
  styleUrl: './initiative-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InitiativePanel {
  protected readonly table = inject(TableState);
  protected readonly store = inject(TabletopStore);
  private endTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly addSection = ADD_SECTION;
  protected readonly limits = INITIATIVE_LIMITS;
  protected readonly busy = signal(false);
  protected readonly confirmingEnd = signal(false);

  protected readonly started = computed(() => this.table.combat().round > 0);
  protected readonly rows = computed<CombatRow[]>(() =>
    this.table.combat().combatants.flatMap((combatant) => {
      const token = this.table.token(combatant.tokenId);
      return token ? [{ ...combatant, token, rollable: !!this.table.sheet(token.sheetId) }] : [];
    }),
  );
  protected readonly outside = computed(() => {
    const inside = new Set(this.table.combat().combatants.map(({ tokenId }) => tokenId));
    return this.table
      .tokens()
      .filter((token) => !inside.has(token.id))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  });
  protected readonly canRoll = computed(() =>
    this.rows().some((row) => row.rollable && row.initiative === null),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.endTimer));
  }

  protected isTurn(row: CombatRow): boolean {
    return this.started() && this.table.combat().turnId === row.tokenId;
  }

  protected isMine(token: TableToken): boolean {
    return token.ownerId !== null && token.ownerId === this.table.me()?.id;
  }

  protected locate(token: TableToken): void {
    this.store.selectToken(token.id);
    this.store.focusOn(token.col, token.row, token.size);
  }

  protected add(token: TableToken): void {
    void this.table.joinCombat([token.id]);
  }

  protected remove(row: CombatRow): void {
    void this.table.leaveCombat(row.tokenId);
  }

  protected toggleHidden(row: CombatRow): void {
    void this.table.updateCombatant(row.tokenId, { hidden: !row.hidden });
  }

  protected setInitiative(row: CombatRow, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInitiative(input.value);
    if (value === undefined) {
      input.value = row.initiative === null ? '' : String(row.initiative);
      this.store.notify(
        `Use um número inteiro de ${INITIATIVE_LIMITS.min} a ${INITIATIVE_LIMITS.max}.`,
      );
      return;
    }
    if (value !== row.initiative) {
      void this.table.updateCombatant(row.tokenId, { initiative: value });
    }
  }

  protected rollOne(row: CombatRow): void {
    void this.table.rollInitiative([row.tokenId]);
  }

  protected rollAll(): void {
    void this.run(() => this.table.rollInitiative());
  }

  protected start(): void {
    void this.run(() => this.table.startCombat());
  }

  protected step(step: 1 | -1): void {
    void this.run(() => this.table.stepTurn(step));
  }

  protected end(): void {
    clearTimeout(this.endTimer);
    if (!this.confirmingEnd()) {
      this.confirmingEnd.set(true);
      this.endTimer = setTimeout(() => this.confirmingEnd.set(false), END_CONFIRM_MS);
      return;
    }
    this.confirmingEnd.set(false);
    void this.run(() => this.table.endCombat());
  }

  private async run(action: () => Promise<boolean>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await action();
    } finally {
      this.busy.set(false);
    }
  }
}
