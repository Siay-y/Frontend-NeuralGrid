import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import {
  LucideArrowLeft,
  LucideChevronDown,
  LucideLocateFixed,
  LucideMapPin,
  LucideTrash2,
} from '@lucide/angular';
import { findFreeCell } from '../board/token-geometry';
import { Collapsible } from '../panel/collapsible';
import { TableState } from '../realtime/table-state';
import {
  TOKEN_KIND_LABEL,
  TOKEN_SEX_LABEL,
  type TableToken,
  type TokenKind,
  type TokenSex,
} from '../realtime/table.protocol';
import { TabletopStore } from '../tabletop.store';
import { SheetAttributesEditor } from './sheet-attributes';
import { SheetEquipmentEditor } from './sheet-equipment';
import {
  type CharacterSheet,
  clampInteger,
  SHEET_LIMITS,
  type SheetData,
  type SheetIdentity,
  type SheetSection,
  sheetSummary,
  sheetTokenLabel,
} from './sheet-model';
import { SheetSkillsEditor } from './sheet-skills';
import { SheetStatusEditor } from './sheet-status';

const SAVE_DELAY_MS = 600;
const CONFIRM_WINDOW_MS = 3_000;
const KINDS: readonly TokenKind[] = ['agent', 'npc', 'threat'];
const SEXES: readonly TokenSex[] = ['female', 'male', 'other'];

@Component({
  selector: 'app-sheet-editor',
  imports: [
    Collapsible,
    LucideArrowLeft,
    LucideChevronDown,
    LucideLocateFixed,
    LucideMapPin,
    LucideTrash2,
    SheetAttributesEditor,
    SheetEquipmentEditor,
    SheetSkillsEditor,
    SheetStatusEditor,
  ],
  templateUrl: './sheet-editor.html',
  styleUrl: './sheet-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetEditor {
  protected readonly table = inject(TableState);
  protected readonly store = inject(TabletopStore);

  readonly sheet = input.required<CharacterSheet>();
  readonly closed = output<void>();

  protected readonly limits = SHEET_LIMITS;
  protected readonly kinds = KINDS;
  protected readonly kindLabel = TOKEN_KIND_LABEL;
  protected readonly sexes = SEXES;
  protected readonly sexLabel = TOKEN_SEX_LABEL;
  protected readonly saving = signal(false);
  protected readonly placing = signal(false);
  protected readonly confirmingDelete = signal(false);

  private readonly dirty = new Set<SheetSection>();
  private readonly inFlight = new Set<SheetSection>();
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private confirmTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly draft = linkedSignal<CharacterSheet, SheetData>({
    source: this.sheet,
    computation: (sheet, previous) =>
      previous && previous.source.id === sheet.id
        ? this.absorb(previous.value, sheet.data)
        : sheet.data,
  });
  protected readonly name = computed(() => this.draft().identity.name.trim() || 'Sem nome');
  protected readonly summary = computed(() => sheetSummary(this.draft()));
  protected readonly placed = computed(() =>
    this.table.tokens().find((token) => token.sheetId === this.sheet().id),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.saveTimer);
      clearTimeout(this.confirmTimer);
      void this.flush();
    });
  }

  protected section(key: string): boolean {
    return this.store.isSectionOpen(`sheet-${key}`);
  }

  protected toggle(key: string): void {
    this.store.toggleSection(`sheet-${key}`);
  }

  protected edit<K extends SheetSection>(section: K, value: SheetData[K]): void {
    this.draft.update((data) => ({ ...data, [section]: value }));
    this.dirty.add(section);
    this.saving.set(true);
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), SAVE_DELAY_MS);
  }

  protected setIdentity<K extends keyof SheetIdentity>(field: K, value: SheetIdentity[K]): void {
    this.edit('identity', { ...this.draft().identity, [field]: value });
  }

  protected typeIdentity(field: 'name' | 'codename' | 'className', event: Event): void {
    this.setIdentity(field, (event.target as HTMLInputElement).value);
  }

  protected typeAge(event: Event): void {
    const element = event.target as HTMLInputElement;
    if (element.value.trim() === '') {
      this.setIdentity('age', null);
      return;
    }
    const age = clampInteger(element.value, 0, SHEET_LIMITS.age, this.draft().identity.age ?? 0);
    element.value = String(age);
    this.setIdentity('age', age);
  }

  protected pickSex(sex: TokenSex): void {
    this.setIdentity('sex', this.draft().identity.sex === sex ? null : sex);
  }

  protected assignKind(kind: TokenKind): void {
    if (kind !== this.sheet().kind) {
      void this.table.updateSheet(this.sheet().id, { kind });
    }
  }

  protected toggleFlag(flag: 'hidden' | 'nameHidden' | 'statsHidden'): void {
    void this.table.updateSheet(this.sheet().id, { [flag]: !this.sheet()[flag] });
  }

  protected assignOwner(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    void this.table.updateSheet(this.sheet().id, { ownerId: value === '' ? null : value });
  }

  protected locate(token: TableToken): void {
    this.store.selectToken(token.id);
    this.store.focusOn(token.col, token.row, token.size);
  }

  protected async place(): Promise<void> {
    if (this.placing() || this.placed()) {
      return;
    }
    const sheet = this.sheet();
    const cell = findFreeCell(this.table.tokens(), this.store.viewCenter(), 1);
    this.placing.set(true);
    const token = await this.table.createToken(
      {
        label: sheetTokenLabel(this.draft()),
        kind: sheet.kind,
        icon: null,
        sex: this.draft().identity.sex,
        hidden: sheet.hidden,
        nameHidden: sheet.nameHidden,
        ownerId: sheet.ownerId,
        size: 1,
        sheetId: sheet.id,
      },
      cell.col,
      cell.row,
    );
    this.placing.set(false);
    if (token) {
      this.store.focusOn(token.col, token.row, token.size);
      this.store.notify(`${token.label} entrou na mesa.`);
    }
  }

  protected async remove(): Promise<void> {
    if (!this.confirmingDelete()) {
      this.confirmingDelete.set(true);
      this.confirmTimer = setTimeout(() => this.confirmingDelete.set(false), CONFIRM_WINDOW_MS);
      return;
    }
    clearTimeout(this.confirmTimer);
    this.dirty.clear();
    if (await this.table.deleteSheet(this.sheet().id)) {
      this.closed.emit();
    }
  }

  private absorb(local: SheetData, remote: SheetData): SheetData {
    const next = { ...local } as Record<SheetSection, unknown>;
    for (const key of Object.keys(remote) as SheetSection[]) {
      if (!this.dirty.has(key) && !this.inFlight.has(key)) {
        next[key] = remote[key];
      }
    }
    return next as unknown as SheetData;
  }

  private async flush(): Promise<void> {
    if (this.dirty.size === 0) {
      return;
    }
    const sections = [...this.dirty];
    this.dirty.clear();
    sections.forEach((section) => this.inFlight.add(section));
    const draft = this.draft();
    const changes = Object.fromEntries(sections.map((section) => [section, draft[section]]));
    const saved = await this.table.updateSheet(this.sheet().id, { data: changes });
    sections.forEach((section) => this.inFlight.delete(section));
    if (!saved) {
      this.draft.update((data) => this.absorb(data, this.sheet().data));
    }
    this.saving.set(this.dirty.size > 0 || this.inFlight.size > 0);
  }
}
