import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { LucideLoaderCircle, LucidePlus, LucideTrash2 } from '@lucide/angular';
import { TableState } from '../realtime/table-state';
import { TabletopStore } from '../tabletop.store';
import { TokenGlyph } from '../tokens/token-glyph';
import { SheetEditor } from './sheet-editor';
import {
  type CharacterSheet,
  gaugeRatio,
  newSheetData,
  SHEETS_PER_PLAYER,
  sheetSummary,
} from './sheet-model';

const DELETE_CONFIRM_MS = 3_000;

@Component({
  selector: 'app-sheets-panel',
  imports: [LucideLoaderCircle, LucidePlus, LucideTrash2, SheetEditor, TokenGlyph],
  templateUrl: './sheets-panel.html',
  styleUrl: './sheets-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetsPanel {
  protected readonly table = inject(TableState);
  protected readonly store = inject(TabletopStore);
  private confirmTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly ratio = gaugeRatio;
  protected readonly summary = sheetSummary;
  protected readonly perPlayer = SHEETS_PER_PLAYER;
  protected readonly creating = signal(false);
  protected readonly confirmingId = signal<string | null>(null);
  protected readonly active = computed(() => this.table.sheet(this.store.activeSheetId()));
  protected readonly placed = computed(
    () => new Set(this.table.tokens().map((token) => token.sheetId)),
  );
  protected readonly atLimit = computed(
    () => !this.table.isMaster() && this.table.ownSheetCount() >= SHEETS_PER_PLAYER,
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.confirmTimer));
  }

  protected owner(sheet: CharacterSheet): string {
    return this.table.member(sheet.ownerId)?.displayName ?? 'Mestre';
  }

  protected remove(sheet: CharacterSheet): void {
    clearTimeout(this.confirmTimer);
    if (this.confirmingId() !== sheet.id) {
      this.confirmingId.set(sheet.id);
      this.confirmTimer = setTimeout(() => this.confirmingId.set(null), DELETE_CONFIRM_MS);
      return;
    }
    this.confirmingId.set(null);
    void this.table.deleteSheet(sheet.id);
  }

  protected async create(): Promise<void> {
    if (this.creating() || this.atLimit()) {
      return;
    }
    this.creating.set(true);
    const name = this.table.isMaster() ? 'Novo personagem' : 'Novo agente';
    const sheet = await this.table.createSheet(newSheetData(name));
    this.creating.set(false);
    if (sheet) {
      this.store.openSection('sheet-identity');
      this.store.showSheet(sheet.id);
    }
  }
}
