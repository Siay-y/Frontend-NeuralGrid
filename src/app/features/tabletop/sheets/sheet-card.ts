import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { LucideDynamicIcon, LucideIdCard, LucideShield, LucideX } from '@lucide/angular';
import { BrandMark } from '../../../shared/ui/brand-mark/brand-mark';
import { TableState } from '../realtime/table-state';
import { TabletopStore } from '../tabletop.store';
import { ATTRIBUTE_ICONS } from './attribute-icons';
import {
  ATTRIBUTES,
  carriedWeight,
  type CharacterSheet,
  d20Roll,
  defense,
  formatWeight,
  gaugeRatio,
  METERS_PER_CELL,
  modifier,
  rollLabel,
  signed,
} from './sheet-model';
import { injectSheetRoll } from './sheet-roller';

const CARD_KEY_PREFIX = 'neuralgrid.sheet-card.';

function readCardChoice(userId: string): string | null {
  try {
    return localStorage.getItem(CARD_KEY_PREFIX + userId);
  } catch {
    return null;
  }
}

function writeCardChoice(userId: string, sheetId: string): void {
  try {
    localStorage.setItem(CARD_KEY_PREFIX + userId, sheetId);
  } catch {
    return;
  }
}

@Component({
  selector: 'app-sheet-card',
  imports: [BrandMark, LucideDynamicIcon, LucideIdCard, LucideShield, LucideX],
  templateUrl: './sheet-card.html',
  styleUrl: './sheet-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open.set(false)' },
})
export class SheetCard {
  private readonly table = inject(TableState);
  private readonly store = inject(TabletopStore);
  private readonly roll = injectSheetRoll();

  protected readonly attributes = ATTRIBUTES;
  protected readonly icons = ATTRIBUTE_ICONS;
  protected readonly signed = signed;
  protected readonly modifier = modifier;
  protected readonly ratio = gaugeRatio;
  protected readonly formatWeight = formatWeight;
  protected readonly cooldown = this.table.diceCooldown;
  protected readonly open = signal(false);

  protected readonly mine = computed(() => {
    const me = this.table.me();
    if (!me) {
      return [];
    }
    const placed = new Set(this.table.tokens().map((token) => token.sheetId));
    return this.table
      .sheetsByCreation()
      .filter((sheet) => sheet.ownerId === me.id && placed.has(sheet.id));
  });

  private readonly selectedSheetId = computed(() => {
    const id = this.store.selectedTokenId();
    const token = id ? this.table.tokens().find((candidate) => candidate.id === id) : undefined;
    const sheetId = token?.sheetId;
    return sheetId && this.mine().some((sheet) => sheet.id === sheetId) ? sheetId : null;
  });

  private readonly chosen = linkedSignal<
    { me: string | null; selected: string | null },
    string | null
  >({
    source: () => ({ me: this.table.me()?.id ?? null, selected: this.selectedSheetId() }),
    computation: ({ me, selected }, previous) => {
      if (selected) {
        return selected;
      }
      return previous?.value ?? (me ? readCardChoice(me) : null);
    },
  });

  constructor() {
    effect(() => {
      const selected = this.selectedSheetId();
      const me = this.table.me()?.id;
      if (selected && me) {
        writeCardChoice(me, selected);
      }
    });
  }

  protected readonly sheet = computed(() => {
    const sheets = this.mine();
    return sheets.find((sheet) => sheet.id === this.chosen()) ?? sheets[0];
  });

  protected title(sheet: CharacterSheet): string {
    const { codename, name } = sheet.data.identity;
    return codename.trim() || name.trim() || 'Sem nome';
  }

  protected subtitle(sheet: CharacterSheet): string {
    const { codename, name, className } = sheet.data.identity;
    return [codename.trim() ? name : '', className].filter((part) => part.trim()).join(' · ');
  }

  protected defense(sheet: CharacterSheet): number {
    return defense(sheet.data);
  }

  protected cells(sheet: CharacterSheet): string {
    return formatWeight(sheet.data.status.movement / METERS_PER_CELL);
  }

  protected load(sheet: CharacterSheet): string {
    return formatWeight(carriedWeight(sheet.data.equipment));
  }

  protected pick(id: string): void {
    this.chosen.set(id);
    const me = this.table.me();
    if (me) {
      writeCardChoice(me.id, id);
    }
  }

  protected test(sheet: CharacterSheet, attribute: (typeof ATTRIBUTES)[number]): void {
    this.roll(
      d20Roll(modifier(sheet.data.attributes[attribute.id])),
      rollLabel(sheet.data.identity.name.trim() || 'Sem nome', attribute.label),
    );
  }
}
