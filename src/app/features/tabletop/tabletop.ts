import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { Board } from './board/board';
import { TablePanelView } from './panel/panel';
import { Presence } from './presence/presence';
import { TableConnection } from './realtime/table-connection';
import { TableState } from './realtime/table-state';
import { Sidebar } from './sidebar/sidebar';
import { MAP_TOOLS, TABLE_PANELS } from './tabletop.models';
import { TabletopStore } from './tabletop.store';

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

@Component({
  selector: 'app-tabletop',
  imports: [Board, Sidebar, TablePanelView, Presence, LucideX],
  templateUrl: './tabletop.html',
  styleUrl: './tabletop.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TabletopStore, TableConnection, TableState],
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class TabletopPage {
  protected readonly store = inject(TabletopStore);
  private readonly table = inject(TableState);
  protected readonly panel = computed(() => {
    const id = this.store.activePanel();
    return id ? TABLE_PANELS[id] : null;
  });

  constructor() {
    this.table.start();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (isEditableTarget(event.target)) {
      return;
    }

    if (event.key === 'Escape') {
      if (this.store.selectedTokenId()) {
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
}
