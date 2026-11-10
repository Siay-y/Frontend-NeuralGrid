import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { LucideLocateFixed, LucideMinus, LucidePlus } from '@lucide/angular';
import { ThemeService } from '../../../core/theme/theme.service';
import { TabletopStore } from '../tabletop.store';
import {
  Camera,
  CELL_SIZE,
  Cell,
  cellAt,
  centeredCamera,
  easeOutExpo,
  interpolateCamera,
  MAJOR_LINE_EVERY,
  sameCell,
  ZOOM_STEP,
  zoomAround,
} from './board-camera';

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  origin: Camera;
}

interface Viewport {
  width: number;
  height: number;
  dpr: number;
}

const CAMERA_TWEEN_MS = 420;
const MIN_MINOR_LINE_SPACING = 10;

@Component({
  selector: 'app-board',
  imports: [LucideLocateFixed, LucideMinus, LucidePlus],
  templateUrl: './board.html',
  styleUrl: './board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Board {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly theme = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly store = inject(TabletopStore);

  protected readonly camera = signal<Camera>({ x: 0, y: 0, zoom: 1 });
  protected readonly hoveredCell = signal<Cell | null>(null);
  protected readonly panning = signal(false);
  protected readonly zoomPercent = computed(() => Math.round(this.camera().zoom * 100));
  protected readonly cellLabel = computed(() => {
    const cell = this.hoveredCell();
    return cell ? `${cell.col}, ${cell.row}` : '';
  });

  private viewport: Viewport = { width: 0, height: 0, dpr: 1 };
  private context: CanvasRenderingContext2D | null = null;
  private drag: DragState | null = null;
  private frame = 0;
  private tween = 0;
  private initialized = false;

  constructor() {
    effect(() => {
      this.camera();
      this.hoveredCell();
      this.store.activeTool();
      this.scheduleDraw();
    });

    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      this.context = canvas.getContext('2d');
      const observer = new ResizeObserver(([entry]) => this.resize(entry.contentRect));
      observer.observe(canvas);
      const stopListening = this.theme.onApplied(() => this.draw());

      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        stopListening();
        cancelAnimationFrame(this.frame);
        cancelAnimationFrame(this.tween);
      });
    });
  }

  protected onPointerDown(event: PointerEvent): void {
    const wantsPan = this.store.activeTool() === 'pan' || event.button === 1;
    if (!wantsPan) {
      return;
    }
    event.preventDefault();
    cancelAnimationFrame(this.tween);
    this.canvasRef().nativeElement.setPointerCapture(event.pointerId);
    this.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: this.camera(),
    };
    this.panning.set(true);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) {
      const { origin, startX, startY } = this.drag;
      this.camera.set({
        ...origin,
        x: origin.x + event.clientX - startX,
        y: origin.y + event.clientY - startY,
      });
      return;
    }

    const { x, y } = this.toLocal(event);
    const cell = cellAt(this.camera(), x, y);
    if (!sameCell(cell, this.hoveredCell())) {
      this.hoveredCell.set(cell);
    }
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.drag?.pointerId !== event.pointerId) {
      return;
    }
    this.drag = null;
    this.panning.set(false);
  }

  protected onPointerLeave(): void {
    if (!this.drag) {
      this.hoveredCell.set(null);
    }
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    cancelAnimationFrame(this.tween);
    const { x, y } = this.toLocal(event);
    const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
    const camera = this.camera();
    this.camera.set(zoomAround(camera, camera.zoom * Math.exp(-delta * 0.0015), x, y));
  }

  protected zoomIn(): void {
    this.zoomFromCenter(ZOOM_STEP);
  }

  protected zoomOut(): void {
    this.zoomFromCenter(1 / ZOOM_STEP);
  }

  protected resetView(): void {
    this.animateTo(centeredCamera(this.viewport.width, this.viewport.height));
  }

  private zoomFromCenter(factor: number): void {
    const camera = this.camera();
    const { width, height } = this.viewport;
    this.animateTo(zoomAround(camera, camera.zoom * factor, width / 2, height / 2));
  }

  private animateTo(target: Camera): void {
    cancelAnimationFrame(this.tween);
    const from = this.camera();
    const startedAt = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / CAMERA_TWEEN_MS);
      this.camera.set(interpolateCamera(from, target, easeOutExpo(progress)));
      if (progress < 1) {
        this.tween = requestAnimationFrame(step);
      }
    };
    this.tween = requestAnimationFrame(step);
  }

  private toLocal(event: MouseEvent): { x: number; y: number } {
    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private resize(rect: DOMRectReadOnly): void {
    const canvas = this.canvasRef().nativeElement;
    const dpr = window.devicePixelRatio || 1;
    this.viewport = { width: rect.width, height: rect.height, dpr };
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    if (!this.initialized && rect.width > 0) {
      this.initialized = true;
      this.camera.set(centeredCamera(rect.width, rect.height));
    }
    this.draw();
  }

  private scheduleDraw(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.draw());
  }

  private draw(): void {
    const ctx = this.context;
    if (!ctx) {
      return;
    }

    const canvas = ctx.canvas;
    const styles = getComputedStyle(this.host.nativeElement);
    const color = (token: string) => styles.getPropertyValue(token).trim();
    const { dpr } = this.viewport;
    const { x, y, zoom } = this.camera();
    const cell = CELL_SIZE * zoom * dpr;
    const originX = x * dpr;
    const originY = y * dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const hovered = this.hoveredCell();
    if (hovered && this.store.activeTool() !== 'pan') {
      ctx.fillStyle = color('--grid-cell-hover');
      ctx.fillRect(originX + hovered.col * cell, originY + hovered.row * cell, cell, cell);
    }

    const firstCol = Math.floor(-originX / cell);
    const lastCol = Math.ceil((canvas.width - originX) / cell);
    const firstRow = Math.floor(-originY / cell);
    const lastRow = Math.ceil((canvas.height - originY) / cell);
    const showMinor = cell >= MIN_MINOR_LINE_SPACING * dpr;
    const isMajor = (index: number) =>
      ((index % MAJOR_LINE_EVERY) + MAJOR_LINE_EVERY) % MAJOR_LINE_EVERY === 0;
    const crisp = (value: number) => Math.round(value) + 0.5;

    const strokeLines = (major: boolean) => {
      ctx.beginPath();
      for (let col = firstCol; col <= lastCol; col++) {
        if (isMajor(col) === major) {
          const px = crisp(originX + col * cell);
          ctx.moveTo(px, 0);
          ctx.lineTo(px, canvas.height);
        }
      }
      for (let row = firstRow; row <= lastRow; row++) {
        if (isMajor(row) === major) {
          const py = crisp(originY + row * cell);
          ctx.moveTo(0, py);
          ctx.lineTo(canvas.width, py);
        }
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = color(major ? '--grid-line-strong' : '--grid-line');
      ctx.stroke();
    };

    if (showMinor) {
      strokeLines(false);
    }
    strokeLines(true);

    const arm = 6 * dpr;
    ctx.beginPath();
    ctx.moveTo(crisp(originX) - arm, crisp(originY));
    ctx.lineTo(crisp(originX) + arm, crisp(originY));
    ctx.moveTo(crisp(originX), crisp(originY) - arm);
    ctx.lineTo(crisp(originX), crisp(originY) + arm);
    ctx.strokeStyle = color('--grid-origin');
    ctx.stroke();
  }
}
