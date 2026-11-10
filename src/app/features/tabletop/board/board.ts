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
  untracked,
  viewChild,
} from '@angular/core';
import { LucideLocateFixed, LucideMinus, LucidePlus } from '@lucide/angular';
import { ThemeService } from '../../../core/theme/theme.service';
import { TableState } from '../realtime/table-state';
import { type FocusRequest, TabletopStore } from '../tabletop.store';
import {
  type Camera,
  CELL_SIZE,
  type Cell,
  cellAt,
  centeredCamera,
  easeOutExpo,
  interpolateCamera,
  MAJOR_LINE_EVERY,
  sameCell,
  ZOOM_STEP,
  zoomAround,
} from './board-camera';
import { hitTest, type PlacedToken, snapToCell } from './token-geometry';
import { TokenHoverCard } from './token-hover-card';
import { type Point, TokenMotion } from './token-motion';
import {
  drawDropTarget,
  drawTokens,
  readTokenPalette,
  type RenderedToken,
  type RenderView,
} from './token-renderer';

interface PanDrag {
  pointerId: number;
  startX: number;
  startY: number;
  origin: Camera;
}

interface TokenDrag {
  pointerId: number;
  id: string;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
  originCol: number;
  originRow: number;
  lastCol: number;
  lastRow: number;
}

interface Viewport {
  width: number;
  height: number;
  dpr: number;
}

const CAMERA_TWEEN_MS = 420;
const MIN_MINOR_LINE_SPACING = 10;
const HOVER_CARD_GAP_PX = 10;
const HOVER_CARD_HALF_WIDTH_PX = 118;
const HOVER_CARD_ROOM_PX = 190;

@Component({
  selector: 'app-board',
  imports: [LucideLocateFixed, LucideMinus, LucidePlus, TokenHoverCard],
  templateUrl: './board.html',
  styleUrl: './board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Board {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly theme = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly table = inject(TableState);
  protected readonly store = inject(TabletopStore);

  protected readonly camera = signal<Camera>({ x: 0, y: 0, zoom: 1 });
  protected readonly hoveredCell = signal<Cell | null>(null);
  protected readonly panning = signal(false);
  protected readonly draggingToken = signal(false);
  protected readonly overMovableToken = signal(false);
  protected readonly hoveredTokenId = signal<string | null>(null);
  protected readonly hoverCard = computed(() => {
    const id = this.hoveredTokenId();
    const token = id ? this.table.token(id) : undefined;
    if (!token || this.panning() || this.draggingToken()) {
      return null;
    }
    const { x, y, zoom } = this.camera();
    const span = CELL_SIZE * zoom;
    const top = y + token.row * span;
    const below = top < HOVER_CARD_ROOM_PX;
    const centerX = x + (token.col + token.size / 2) * span;
    const maxX = Math.max(HOVER_CARD_HALF_WIDTH_PX, this.viewport.width - HOVER_CARD_HALF_WIDTH_PX);
    return {
      token,
      below,
      left: Math.min(Math.max(centerX, HOVER_CARD_HALF_WIDTH_PX), maxX),
      top: below ? top + token.size * span + HOVER_CARD_GAP_PX : top - HOVER_CARD_GAP_PX,
    };
  });
  protected readonly zoomPercent = computed(() => Math.round(this.camera().zoom * 100));
  protected readonly cellLabel = computed(() => {
    const cell = this.hoveredCell();
    return cell ? `${cell.col}, ${cell.row}` : '';
  });

  private viewport: Viewport = { width: 0, height: 0, dpr: 1 };
  private context: CanvasRenderingContext2D | null = null;
  private panDrag: PanDrag | null = null;
  private tokenDrag: TokenDrag | null = null;
  private readonly motion = new TokenMotion();
  private placed: PlacedToken[] = [];
  private frame = 0;
  private lastFrameAt = 0;
  private tween = 0;
  private initialized = false;

  constructor() {
    effect(() => {
      this.camera();
      this.hoveredCell();
      this.store.activeTool();
      this.store.selectedTokenId();
      this.table.tokens();
      this.table.previews();
      this.scheduleDraw();
    });

    effect(() => {
      this.camera();
      untracked(() => this.syncViewCenter());
    });

    effect(() => {
      const request = this.store.focusRequest();
      if (request) {
        untracked(() => this.focus(request));
      }
    });

    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      this.context = canvas.getContext('2d');
      const observer = new ResizeObserver(([entry]) => this.resize(entry.contentRect));
      observer.observe(canvas);
      const stopListening = this.theme.onApplied(() => this.draw(0));

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
    if (wantsPan) {
      this.startPan(event);
      return;
    }
    if (this.store.activeTool() === 'select' && event.button === 0) {
      this.pickToken(event);
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.panDrag?.pointerId === event.pointerId) {
      const { origin, startX, startY } = this.panDrag;
      this.camera.set({
        ...origin,
        x: origin.x + event.clientX - startX,
        y: origin.y + event.clientY - startY,
      });
      return;
    }

    const world = this.toWorld(event);
    if (this.tokenDrag?.pointerId === event.pointerId) {
      this.dragTokenTo(world);
      return;
    }

    const cell = { col: Math.floor(world.x), row: Math.floor(world.y) };
    if (!sameCell(cell, this.hoveredCell())) {
      this.hoveredCell.set(cell);
    }
    const hovered = hitTest(this.placed, world.x, world.y);
    this.hoveredTokenId.set(event.pointerType === 'mouse' ? (hovered?.token.id ?? null) : null);
    this.overMovableToken.set(
      this.store.activeTool() === 'select' && !!hovered && this.table.canMove(hovered.token),
    );
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.panDrag?.pointerId === event.pointerId) {
      this.panDrag = null;
      this.panning.set(false);
      return;
    }
    if (this.tokenDrag?.pointerId === event.pointerId) {
      this.dropToken(event.type !== 'pointercancel');
    }
  }

  protected onPointerLeave(): void {
    if (!this.panDrag && !this.tokenDrag) {
      this.hoveredCell.set(null);
      this.overMovableToken.set(false);
    }
    this.hoveredTokenId.set(null);
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

  private startPan(event: PointerEvent): void {
    event.preventDefault();
    cancelAnimationFrame(this.tween);
    this.canvasRef().nativeElement.setPointerCapture(event.pointerId);
    this.panDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: this.camera(),
    };
    this.panning.set(true);
  }

  private pickToken(event: PointerEvent): void {
    const world = this.toWorld(event);
    const hit = hitTest(this.placed, world.x, world.y);
    this.store.selectToken(hit?.token.id ?? null);
    if (!hit || !this.table.canMove(hit.token)) {
      return;
    }

    event.preventDefault();
    this.canvasRef().nativeElement.setPointerCapture(event.pointerId);
    this.tokenDrag = {
      pointerId: event.pointerId,
      id: hit.token.id,
      offsetX: world.x - hit.x,
      offsetY: world.y - hit.y,
      x: hit.x,
      y: hit.y,
      originCol: hit.token.col,
      originRow: hit.token.row,
      lastCol: hit.token.col,
      lastRow: hit.token.row,
    };
    this.draggingToken.set(true);
  }

  private dragTokenTo(world: Point): void {
    const drag = this.tokenDrag;
    if (!drag) {
      return;
    }
    drag.x = world.x - drag.offsetX;
    drag.y = world.y - drag.offsetY;

    const { col, row } = snapToCell(drag.x, drag.y);
    if (col !== drag.lastCol || row !== drag.lastRow) {
      drag.lastCol = col;
      drag.lastRow = row;
      this.table.dragToken(drag.id, col, row);
    }
    this.scheduleDraw();
  }

  private dropToken(commit: boolean): void {
    const drag = this.tokenDrag;
    if (!drag) {
      return;
    }
    this.tokenDrag = null;
    this.draggingToken.set(false);

    const target = snapToCell(drag.x, drag.y);
    const moved = target.col !== drag.originCol || target.row !== drag.originRow;
    if (commit && moved) {
      void this.table.moveToken(drag.id, target.col, target.row);
    } else if (drag.lastCol !== drag.originCol || drag.lastRow !== drag.originRow) {
      this.table.dragToken(drag.id, drag.originCol, drag.originRow);
    }
    this.scheduleDraw();
  }

  private focus(request: FocusRequest): void {
    const { width, height } = this.viewport;
    const { zoom } = this.camera();
    const size = CELL_SIZE * zoom;
    const centerX = (request.col + request.size / 2) * size;
    const centerY = (request.row + request.size / 2) * size;
    this.animateTo({ zoom, x: width / 2 - centerX, y: height / 2 - centerY });
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

  private syncViewCenter(): void {
    const { width, height } = this.viewport;
    if (width > 0) {
      this.store.setViewCenter(cellAt(this.camera(), width / 2, height / 2));
    }
  }

  private toLocal(event: MouseEvent): Point {
    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private toWorld(event: MouseEvent): Point {
    const { x, y } = this.toLocal(event);
    const camera = this.camera();
    const size = CELL_SIZE * camera.zoom;
    return { x: (x - camera.x) / size, y: (y - camera.y) / size };
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
    this.syncViewCenter();
    this.draw(0);
  }

  private scheduleDraw(): void {
    if (this.frame) {
      return;
    }
    this.lastFrameAt = this.lastFrameAt || performance.now();
    this.frame = requestAnimationFrame((now) => {
      this.frame = 0;
      const elapsed = now - this.lastFrameAt;
      this.lastFrameAt = now;
      if (this.draw(elapsed)) {
        this.scheduleDraw();
      } else {
        this.lastFrameAt = 0;
      }
    });
  }

  private tokenTargets(): Map<string, Point> {
    const previews = this.table.previews();
    const targets = new Map<string, Point>();
    for (const token of this.table.tokens()) {
      const drag = this.tokenDrag?.id === token.id ? this.tokenDrag : null;
      const preview = previews.get(token.id);
      targets.set(
        token.id,
        drag
          ? { x: drag.x, y: drag.y }
          : preview
            ? { x: preview.col, y: preview.row }
            : { x: token.col, y: token.row },
      );
    }
    return targets;
  }

  private draw(elapsedMs: number): boolean {
    const ctx = this.context;
    if (!ctx) {
      return false;
    }

    const targets = this.tokenTargets();
    const animating = this.motion.step(targets, elapsedMs);
    if (this.tokenDrag) {
      this.motion.jump(this.tokenDrag.id, { x: this.tokenDrag.x, y: this.tokenDrag.y });
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
    if (hovered && this.store.activeTool() !== 'pan' && !this.tokenDrag) {
      ctx.fillStyle = color('--grid-cell-hover');
      ctx.fillRect(originX + hovered.col * cell, originY + hovered.row * cell, cell, cell);
    }

    this.drawGrid(ctx, originX, originY, cell, dpr, color);

    const view: RenderView = { originX, originY, cell, dpr, zoom };
    const palette = readTokenPalette(styles);
    const previews = this.table.previews();
    const selectedId = this.store.selectedTokenId();

    if (this.tokenDrag) {
      const token = this.table.token(this.tokenDrag.id);
      const target = snapToCell(this.tokenDrag.x, this.tokenDrag.y);
      drawDropTarget(ctx, view, palette, target.col, target.row, token?.size ?? 1);
    }

    this.placed = [];
    const rendered: RenderedToken[] = [];
    for (const token of this.table.tokens()) {
      const position = this.motion.position(token.id) ?? { x: token.col, y: token.row };
      this.placed.push({ token, x: position.x, y: position.y });
      rendered.push({
        token,
        x: position.x,
        y: position.y,
        selected: token.id === selectedId,
        remote: previews.has(token.id),
      });
    }
    const draggedId = this.tokenDrag?.id;
    rendered.sort((a, b) => Number(a.token.id === draggedId) - Number(b.token.id === draggedId));
    drawTokens(ctx, rendered, view, palette);

    return animating;
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    cell: number,
    dpr: number,
    color: (token: string) => string,
  ): void {
    const canvas = ctx.canvas;
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
