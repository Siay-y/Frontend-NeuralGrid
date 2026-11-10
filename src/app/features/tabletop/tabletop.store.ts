import { Injectable, signal } from '@angular/core';
import type { MapToolId, PanelId } from './tabletop.models';

@Injectable()
export class TabletopStore {
  private readonly tool = signal<MapToolId>('select');
  private readonly panel = signal<PanelId | null>(null);
  private readonly expanded = signal(false);

  readonly activeTool = this.tool.asReadonly();
  readonly activePanel = this.panel.asReadonly();
  readonly sidebarExpanded = this.expanded.asReadonly();

  selectTool(tool: MapToolId): void {
    this.tool.set(tool);
  }

  togglePanel(panel: PanelId): void {
    this.panel.update((current) => (current === panel ? null : panel));
  }

  closePanel(): void {
    this.panel.set(null);
  }

  toggleSidebar(): void {
    this.expanded.update((expanded) => !expanded);
  }
}
