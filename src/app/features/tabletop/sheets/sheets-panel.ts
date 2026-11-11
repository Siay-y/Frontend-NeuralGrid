import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideLoaderCircle, LucidePlus } from '@lucide/angular';
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

@Component({
  selector: 'app-sheets-panel',
  imports: [LucideLoaderCircle, LucidePlus, SheetEditor, TokenGlyph],
  templateUrl: './sheets-panel.html',
  styleUrl: './sheets-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetsPanel {
  protected readonly table = inject(TableState);
  protected readonly store = inject(TabletopStore);

  protected readonly ratio = gaugeRatio;
  protected readonly summary = sheetSummary;
  protected readonly perPlayer = SHEETS_PER_PLAYER;
  protected readonly creating = signal(false);
  protected readonly active = computed(() => this.table.sheet(this.store.activeSheetId()));
  protected readonly placed = computed(
    () => new Set(this.table.tokens().map((token) => token.sheetId)),
  );
  protected readonly atLimit = computed(
    () => !this.table.isMaster() && this.table.ownSheetCount() >= SHEETS_PER_PLAYER,
  );

  protected owner(sheet: CharacterSheet): string {
    return this.table.member(sheet.ownerId)?.displayName ?? 'Mestre';
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
