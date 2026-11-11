import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import {
  DRAWING_COLORS,
  DRAWING_WIDTHS,
  type DrawingShape,
  type DrawingStyle,
} from './realtime/table.protocol';
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
const DRAWING_STYLE_KEY = 'neuralgrid.drawing-style';
const DRAWING_SHAPES: readonly DrawingShape[] = ['free', 'arrow', 'rect', 'ellipse'];

export const DEFAULT_DRAWING_STYLE: DrawingStyle = { shape: 'free', color: 'rose', width: 4 };

export function parseDrawingStyle(raw: string | null): DrawingStyle {
  try {
    const value = JSON.parse(raw ?? '{}') as Partial<Record<keyof DrawingStyle, unknown>>;
    return {
      shape: DRAWING_SHAPES.find((shape) => shape === value.shape) ?? DEFAULT_DRAWING_STYLE.shape,
      color:
        DRAWING_COLORS.find((color) => color.id === value.color)?.id ?? DEFAULT_DRAWING_STYLE.color,
      width: DRAWING_WIDTHS.find((width) => width === value.width) ?? DEFAULT_DRAWING_STYLE.width,
    };
  } catch {
    return DEFAULT_DRAWING_STYLE;
  }
}

function readDrawingStyle(): DrawingStyle {
  try {
    return parseDrawingStyle(localStorage.getItem(DRAWING_STYLE_KEY));
  } catch {
    return DEFAULT_DRAWING_STYLE;
  }
}

function writeDrawingStyle(style: DrawingStyle): void {
  try {
    localStorage.setItem(DRAWING_STYLE_KEY, JSON.stringify(style));
  } catch {
    return;
  }
}

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
  private readonly style = signal<DrawingStyle>(readDrawingStyle());
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;

  readonly activeTool = this.tool.asReadonly();
  readonly activePanel = this.panel.asReadonly();
  readonly sidebarExpanded = this.expanded.asReadonly();
  readonly selectedTokenId = this.selected.asReadonly();
  readonly focusRequest = this.focus.asReadonly();
  readonly viewCenter = this.center.asReadonly();
  readonly notice = this.currentNotice.asReadonly();
  readonly chatAudience = this.audience.asReadonly();
  readonly drawingStyle = this.style.asReadonly();

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

  setDrawingStyle(changes: Partial<DrawingStyle>): void {
    const next = { ...this.style(), ...changes };
    this.style.set(next);
    writeDrawingStyle(next);
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
