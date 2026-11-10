import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { LucideDynamicIcon, LucideX } from '@lucide/angular';
import type { TablePanel } from '../tabletop.models';
import { TabletopStore } from '../tabletop.store';

@Component({
  selector: 'app-table-panel',
  imports: [LucideDynamicIcon, LucideX],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablePanelView {
  protected readonly store = inject(TabletopStore);
  readonly panel = input.required<TablePanel>();
}
