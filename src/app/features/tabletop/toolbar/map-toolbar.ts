import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  LucideCircle,
  LucideDynamicIcon,
  LucideEraser,
  LucideMoveUpRight,
  LucideRuler,
  LucideSpline,
  LucideSquare,
  LucideTrash2,
  LucideUndo2,
  type LucideIconInput,
} from '@lucide/angular';
import { TableState } from '../realtime/table-state';
import {
  DRAWING_COLORS,
  DRAWING_WIDTHS,
  type DrawingShape,
  type DrawingStyle,
} from '../realtime/table.protocol';
import { TabletopStore } from '../tabletop.store';

const CONFIRM_WINDOW_MS = 3_000;

const SHAPES: readonly { id: DrawingShape; label: string; icon: LucideIconInput }[] = [
  { id: 'free', label: 'Traço livre', icon: LucideSpline },
  { id: 'arrow', label: 'Seta', icon: LucideMoveUpRight },
  { id: 'rect', label: 'Retângulo', icon: LucideSquare },
  { id: 'ellipse', label: 'Círculo', icon: LucideCircle },
];

const WIDTH_LABEL: Record<number, string> = { 2: 'Fino', 4: 'Médio', 8: 'Grosso' };

@Component({
  selector: 'app-map-toolbar',
  imports: [LucideDynamicIcon, LucideEraser, LucideRuler, LucideTrash2, LucideUndo2],
  templateUrl: './map-toolbar.html',
  styleUrl: './map-toolbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapToolbar {
  protected readonly store = inject(TabletopStore);
  protected readonly table = inject(TableState);

  protected readonly shapes = SHAPES;
  protected readonly colors = DRAWING_COLORS;
  protected readonly widths = DRAWING_WIDTHS;
  protected readonly widthLabel = WIDTH_LABEL;
  protected readonly style = this.store.drawingStyle;
  protected readonly confirming = signal(false);
  private confirmTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.confirmTimer));
  }

  protected pick(changes: Partial<DrawingStyle>): void {
    this.store.setDrawingStyle(changes);
  }

  protected undo(): void {
    void this.table.undoDrawing();
  }

  protected clearMine(): void {
    void this.table.clearDrawings('mine');
  }

  protected async clearAll(): Promise<void> {
    if (!this.confirming()) {
      this.confirming.set(true);
      this.confirmTimer = setTimeout(() => this.confirming.set(false), CONFIRM_WINDOW_MS);
      return;
    }
    clearTimeout(this.confirmTimer);
    this.confirming.set(false);
    await this.table.clearDrawings('all');
  }
}
