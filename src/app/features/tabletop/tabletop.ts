import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { Board } from './board/board';
import { DiceTray } from './dice/dice-tray';
import { RollFeed } from './dice/roll-feed';
import { RollPreviews } from './dice/roll-previews';
import { TablePanelView } from './panel/panel';
import { Presence } from './presence/presence';
import { SheetCard } from './sheets/sheet-card';
import { TableConnection } from './realtime/table-connection';
import { AppearanceService } from '../../core/appearance/appearance.service';
import { TableState } from './realtime/table-state';
import { Sidebar } from './sidebar/sidebar';
import { MapToolbar } from './toolbar/map-toolbar';
import { MAP_TOOLS, TABLE_PANELS } from './tabletop.models';
import { MapApi } from './maps/map-api';
import { MapScene } from './maps/map-scene';
import { MapUploader } from './maps/map-uploader';
import { TabletopStore } from './tabletop.store';

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'file']);

function isEditableTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) {
    return !NON_TEXT_INPUTS.has(target.type);
  }
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

@Component({
  selector: 'app-tabletop',
  imports: [
    Board,
    DiceTray,
    MapToolbar,
    RollPreviews,
    SheetCard,
    Sidebar,
    TablePanelView,
    Presence,
    LucideX,
  ],
  templateUrl: './tabletop.html',
  styleUrl: './tabletop.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TabletopStore, TableConnection, RollFeed, TableState, MapApi, MapScene, MapUploader],
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(document:dragover)': 'keepFileOnPage($event)',
    '(document:drop)': 'keepFileOnPage($event)',
  },
})
export class TabletopPage {
  protected readonly store = inject(TabletopStore);
  private readonly table = inject(TableState);
  protected readonly panel = computed(() => {
    const id = this.store.activePanel();
    return id ? TABLE_PANELS[id] : null;
  });

  constructor() {
    inject(AppearanceService);
    this.table.start();
  }

  protected keepFileOnPage(event: DragEvent): void {
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || isEditableTarget(event.target)) {
      return;
    }

    if (this.isUndo(event)) {
      event.preventDefault();
      void this.table.undoDrawing();
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === 'Escape') {
      if (this.store.mapAdjusting()) {
        this.store.setMapAdjusting(false);
      } else if (this.store.selectedTokenId()) {
        this.store.clearSelection();
      } else {
        this.store.closePanel();
      }
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selected = this.store.selectedTokenId();
      if (selected && this.table.isMaster()) {
        event.preventDefault();
        void this.table.deleteToken(selected);
      }
      return;
    }

    const tool = MAP_TOOLS.find((candidate) => candidate.shortcut === event.key.toUpperCase());
    if (tool) {
      event.preventDefault();
      this.store.selectTool(tool.id);
    }
  }

  private isUndo(event: KeyboardEvent): boolean {
    return (
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === 'z' &&
      this.store.activeTool() === 'draw'
    );
  }
}
