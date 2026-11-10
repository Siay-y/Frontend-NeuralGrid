import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { MapToolId, PanelId } from './tabletop.models';

export interface GridCell {
  col: number;
  row: number;
}

export interface Notice {
  id: number;
  message: string;
}

export interface FocusRequest extends GridCell {
  size: number;
  seq: number;
}

const NOTICE_DURATION_MS = 4_000;

@Injectable()
export class TabletopStore {
  private readonly tool = signal<MapToolId>('select');
  private readonly panel = signal<PanelId | null>(null);
  private readonly expanded = signal(false);
  private readonly selected = signal<string | null>(null);
  private readonly focus = signal<FocusRequest | null>(null);
  private readonly center = signal<GridCell>({ col: 0, row: 0 });
  private readonly currentNotice = signal<Notice | null>(null);
  private readonly audience = signal('public');
  private readonly closedSections = signal<ReadonlySet<string>>(new Set());
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;

  readonly activeTool = this.tool.asReadonly();
  readonly activePanel = this.panel.asReadonly();
  readonly sidebarExpanded = this.expanded.asReadonly();
  readonly selectedTokenId = this.selected.asReadonly();
  readonly focusRequest = this.focus.asReadonly();
  readonly viewCenter = this.center.asReadonly();
  readonly notice = this.currentNotice.asReadonly();
  readonly chatAudience = this.audience.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.noticeTimer));
  }

  isSectionOpen(section: string): boolean {
    return !this.closedSections().has(section);
  }

  toggleSection(section: string): void {
    this.closedSections.update((closed) => {
      const next = new Set(closed);
      if (!next.delete(section)) {
        next.add(section);
      }
      return next;
    });
  }

  openSection(section: string): void {
    if (!this.isSectionOpen(section)) {
      this.toggleSection(section);
    }
  }

  selectTool(tool: MapToolId): void {
    this.tool.set(tool);
  }

  togglePanel(panel: PanelId): void {
    this.panel.update((current) => (current === panel ? null : panel));
  }

  openPanel(panel: PanelId): void {
    this.panel.set(panel);
  }

  closePanel(): void {
    this.panel.set(null);
  }

  toggleSidebar(): void {
    this.expanded.update((expanded) => !expanded);
  }

  selectToken(id: string | null): void {
    this.selected.set(id);
  }

  clearSelection(id?: string): void {
    if (id === undefined || this.selected() === id) {
      this.selected.set(null);
    }
  }

  focusOn(col: number, row: number, size = 1): void {
    this.focus.update((previous) => ({ col, row, size, seq: (previous?.seq ?? 0) + 1 }));
  }

  setViewCenter(cell: GridCell): void {
    const current = this.center();
    if (current.col !== cell.col || current.row !== cell.row) {
      this.center.set(cell);
    }
  }

  setChatAudience(value: string): void {
    this.audience.set(value);
  }

  notify(message: string): void {
    clearTimeout(this.noticeTimer);
    this.currentNotice.update((previous) => ({ id: (previous?.id ?? 0) + 1, message }));
    this.noticeTimer = setTimeout(() => this.currentNotice.set(null), NOTICE_DURATION_MS);
  }

  dismissNotice(): void {
    clearTimeout(this.noticeTimer);
    this.currentNotice.set(null);
  }
}
