import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Board } from './board/board';
import { TablePanelView } from './panel/panel';
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
  imports: [Board, Sidebar, TablePanelView],
  templateUrl: './tabletop.html',
  styleUrl: './tabletop.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TabletopStore],
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class TabletopPage {
  protected readonly store = inject(TabletopStore);
  protected readonly panel = computed(() => {
    const id = this.store.activePanel();
    return id ? TABLE_PANELS[id] : null;
  });

  protected onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (isEditableTarget(event.target)) {
      return;
    }

    if (event.key === 'Escape') {
      this.store.closePanel();
      return;
    }

    const tool = MAP_TOOLS.find((candidate) => candidate.shortcut === event.key.toUpperCase());
    if (tool) {
      event.preventDefault();
      this.store.selectTool(tool.id);
    }
  }
}
