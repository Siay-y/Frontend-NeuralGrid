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
import {
  DRAWING_MAX_POINTS,
  type DrawingDraft,
  type RulerSpan,
  type TableDrawing,
} from '../realtime/table.protocol';
import { areaAt, MapScene } from '../maps/map-scene';
import { MapUploader } from '../maps/map-uploader';
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
import {
  type Bounds,
  drawingBounds,
  hitsSweep,
  isMeaningfulShape,
  simplifyStroke,
  sweepBounds,
} from './drawing-geometry';
import {
  drawDrawings,
  drawEraserCursor,
  drawRuler,
  readDrawPalette,
  readOverlayPalette,
} from './drawing-renderer';
import { clampToGrid, hitTest, type PlacedToken, snapToCell } from './token-geometry';
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

interface MapDrag {
  pointerId: number;
  id: string;
  startX: number;
  startY: number;
  originCol: number;
  originRow: number;
  cell: number;
  moved: boolean;
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

interface StrokeGesture {
  pointerId: number;
  draft: DrawingDraft;
}

interface EraseGesture {
  pointerId: number;
  ids: Set<string>;
  last: Point;
}

interface MeasureGesture {
  pointerId: number;
  span: RulerSpan;
  sentAt: number;
  timer?: ReturnType<typeof setTimeout>;
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
const ERASER_RADIUS_PX = 10;
const STROKE_STEP_PX = 2;
const STROKE_TOLERANCE_PX = 0.6;
const RULER_SEND_MS = 80;
const COORDINATE_PRECISION = 100;
const HOVER_TOOLS = new Set(['select', 'pan']);
const HIDDEN_AREA_ALPHA = 0.4;

function snapPoint(x: number, y: number): Point {
  const { col, row } = snapToCell(x, y);
  return { x: col, y: row };
}

function roundCoordinate(value: number): number {
  return Math.round(clampToGrid(value) * COORDINATE_PRECISION) / COORDINATE_PRECISION;
}

const GRID_FADE = { radiusX: 0.75, radiusY: 0.7, solidUntil: 0.3, edgeOpacity: 0.3 };

function fadeGridEdges(ctx: CanvasRenderingContext2D): void {
  const { width, height } = ctx.canvas;
  const reach = 1 / Math.min(GRID_FADE.radiusX, GRID_FADE.radiusY);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(GRID_FADE.solidUntil, '#000');
  gradient.addColorStop(1, `rgba(0, 0, 0, ${GRID_FADE.edgeOpacity})`);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.translate(width / 2, height / 2);
  ctx.scale(width * GRID_FADE.radiusX, height * GRID_FADE.radiusY);
  ctx.fillStyle = gradient;
  ctx.fillRect(-reach, -reach, reach * 2, reach * 2);
  ctx.restore();
}

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
  private readonly mapScene = inject(MapScene);
  protected readonly uploader = inject(MapUploader);
  protected readonly fileOver = signal(false);
  protected readonly dropLabel = computed(() =>
    this.table.maps().some((map) => map.active)
      ? 'Solte para adicionar uma área ao mapa da mesa'
      : 'Solte para colocar o mapa na mesa',
  );

  protected readonly camera = signal<Camera>({ x: 0, y: 0, zoom: 1 });
  protected readonly hoveredCell = signal<Cell | null>(null);
  protected readonly panning = signal(false);
  protected readonly draggingToken = signal(false);
  protected readonly overMovableToken = signal(false);
  protected readonly hoveredTokenId = signal<string | null>(null);
  protected readonly gesturing = signal(false);
  private readonly ownRuler = signal<RulerSpan | null>(null);
  protected readonly hoverCard = computed(() => {
    const id = this.hoveredTokenId();
    const token = id ? this.table.token(id) : undefined;
    const tool = this.store.activeTool();
    if (
      !token ||
      this.panning() ||
      this.draggingToken() ||
      this.gesturing() ||
      !HOVER_TOOLS.has(tool)
    ) {
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
  private mapDrag: MapDrag | null = null;
  private stroke: StrokeGesture | null = null;
  private erasing: EraseGesture | null = null;
  private measuring: MeasureGesture | null = null;
  private pendingDrafts: DrawingDraft[] = [];
  private pointer: Point | null = null;
  private readonly bounds = new WeakMap<TableDrawing, Bounds>();
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
      this.table.drawings();
      this.table.rulers();
      this.table.members();
      this.ownRuler();
      this.mapScene.layers();
      this.store.mapAdjusting();
      this.store.mapAreaId();
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
        clearTimeout(this.measuring?.timer);
      });
    });
  }

  protected onFileDrag(event: DragEvent): void {
    if (!this.acceptsFiles(event)) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.fileOver.set(true);
  }

  protected onFileLeave(event: DragEvent): void {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !this.host.nativeElement.contains(next)) {
      this.fileOver.set(false);
    }
  }

  protected onFileDrop(event: DragEvent): void {
    if (!this.acceptsFiles(event)) {
      return;
    }
    event.preventDefault();
    this.fileOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) {
      void this.placeDroppedMap(file, this.toWorld(event));
    }
  }

  protected uploadPercent(progress: number): string {
    return `${Math.round(progress * 100)}%`;
  }

  protected onPointerDown(event: PointerEvent): void {
    const tool = this.store.activeTool();
    if (tool === 'pan' || event.button === 1) {
      this.startPan(event);
      return;
    }
    if (this.store.mapAdjusting() && event.button === 0) {
      this.startMapDrag(event);
      return;
    }
    if (event.button !== 0 || this.stroke || this.erasing || this.measuring) {
      return;
    }
    switch (tool) {
      case 'select':
        this.pickToken(event);
        break;
      case 'draw':
        this.startStroke(event);
        break;
      case 'erase':
        this.startErase(event);
        break;
      case 'measure':
        this.startMeasure(event);
        break;
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
    if (this.mapDrag?.pointerId === event.pointerId) {
      this.dragMapTo(world);
      return;
    }
    if (this.tokenDrag?.pointerId === event.pointerId) {
      this.dragTokenTo(world);
      return;
    }
    if (this.store.activeTool() === 'erase') {
      this.pointer = this.toLocal(event);
      this.scheduleDraw();
    }
    if (this.stroke?.pointerId === event.pointerId) {
      this.extendStroke(world);
      return;
    }
    if (this.erasing?.pointerId === event.pointerId) {
      this.sweepErase(world);
      return;
    }
    if (this.measuring?.pointerId === event.pointerId) {
      this.extendMeasure(world);
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
    const commit = event.type !== 'pointercancel';
    if (this.mapDrag?.pointerId === event.pointerId) {
      void this.dropMap(commit);
    } else if (this.tokenDrag?.pointerId === event.pointerId) {
      this.dropToken(commit);
    } else if (this.stroke?.pointerId === event.pointerId) {
      this.finishStroke(commit);
    } else if (this.erasing?.pointerId === event.pointerId) {
      this.finishErase(commit);
    } else if (this.measuring?.pointerId === event.pointerId) {
      this.finishMeasure();
    }
  }

  protected onPointerLeave(): void {
    if (this.pointer) {
      this.pointer = null;
      this.scheduleDraw();
    }
    if (!this.panDrag && !this.tokenDrag && !this.measuring) {
      this.hoveredCell.set(null);
      this.overMovableToken.set(false);
    }
    this.hoveredTokenId.set(null);
  }

  protected onDoubleClick(event: MouseEvent): void {
    if (this.store.activeTool() !== 'select') {
      return;
    }
    const world = this.toWorld(event);
    const sheet = this.table.sheet(hitTest(this.placed, world.x, world.y)?.token.sheetId ?? null);
    if (sheet) {
      this.store.openSheet(sheet.id);
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

  private acceptsFiles(event: DragEvent): boolean {
    return (
      this.table.isMaster() &&
      !this.uploader.state() &&
      (event.dataTransfer?.types.includes('Files') ?? false)
    );
  }

  private async placeDroppedMap(file: File, world: Point): Promise<void> {
    const active = this.table.maps().find((map) => map.active);
    const center = { col: roundCoordinate(world.x), row: roundCoordinate(world.y) };
    const map = await this.uploader.upload(file, { mapId: active?.id, center });
    if (!map) {
      const problem = this.uploader.error();
      if (problem) {
        this.store.notify(problem);
      }
      return;
    }
    if (active) {
      this.store.selectMapArea(map.areas.at(-1)?.id ?? null);
    } else if (await this.table.activateMap(map.id)) {
      this.store.selectMapArea(map.areas[0]?.id ?? null);
    }
  }

  private startMapDrag(event: PointerEvent): void {
    const world = this.toWorld(event);
    const area = areaAt(this.mapScene.areas(), world.x, world.y);
    if (!area) {
      this.startPan(event);
      return;
    }
    event.preventDefault();
    this.canvasRef().nativeElement.setPointerCapture(event.pointerId);
    this.store.selectMapArea(area.id);
    this.mapDrag = {
      pointerId: event.pointerId,
      id: area.id,
      startX: world.x,
      startY: world.y,
      originCol: area.col,
      originRow: area.row,
      cell: area.cell,
      moved: false,
    };
    this.panning.set(true);
  }

  private dragMapTo(world: Point): void {
    const drag = this.mapDrag;
    if (!drag) {
      return;
    }
    drag.moved = true;
    this.store.setMapDraft({
      id: drag.id,
      col: roundCoordinate(drag.originCol + world.x - drag.startX),
      row: roundCoordinate(drag.originRow + world.y - drag.startY),
      cell: drag.cell,
    });
  }

  private async dropMap(commit: boolean): Promise<void> {
    const drag = this.mapDrag;
    this.mapDrag = null;
    this.panning.set(false);
    const draft = this.store.mapDraft();
    if (!drag || !draft || !drag.moved || !commit) {
      this.store.setMapDraft(null);
      return;
    }
    await this.table.updateArea(drag.id, { col: draft.col, row: draft.row });
    if (this.store.mapDraft() === draft) {
      this.store.setMapDraft(null);
    }
  }

  private drawMap(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    cell: number,
    dpr: number,
    color: (token: string) => string,
  ): void {
    const layers = this.mapScene.layers();
    if (layers.length === 0) {
      return;
    }
    const adjusting = this.store.mapAdjusting();
    const selectedId = this.store.mapAreaId();
    const frames: { x: number; y: number; width: number; height: number; selected: boolean }[] = [];
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.imageSmoothingQuality = 'high';
    for (let index = layers.length - 1; index >= 0; index--) {
      const { area, image } = layers[index];
      const scale = cell / area.cell;
      const x = originX + area.col * cell;
      const y = originY + area.row * cell;
      const width = area.width * scale;
      const height = area.height * scale;
      if (image) {
        ctx.globalAlpha = area.hidden ? HIDDEN_AREA_ALPHA : 1;
        ctx.drawImage(image, x, y, width, height);
      }
      if (adjusting) {
        frames.push({ x, y, width, height, selected: area.id === selectedId });
      }
    }
    ctx.restore();
    if (frames.length === 0) {
      return;
    }
    ctx.save();
    ctx.strokeStyle = color('--color-text');
    for (const frame of frames) {
      ctx.lineWidth = (frame.selected ? 2 : 1) * dpr;
      ctx.setLineDash(frame.selected ? [] : [6 * dpr, 4 * dpr]);
      ctx.strokeRect(
        Math.round(frame.x) + 0.5,
        Math.round(frame.y) + 0.5,
        Math.round(frame.width),
        Math.round(frame.height),
      );
    }
    ctx.restore();
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

  private capture(event: PointerEvent): void {
    event.preventDefault();
    this.canvasRef().nativeElement.setPointerCapture(event.pointerId);
    this.gesturing.set(true);
  }

  private cellsPerPixel(): number {
    return 1 / (CELL_SIZE * this.camera().zoom);
  }

  private startStroke(event: PointerEvent): void {
    this.capture(event);
    const world = this.toWorld(event);
    const x = roundCoordinate(world.x);
    const y = roundCoordinate(world.y);
    const style = this.store.drawingStyle();
    this.stroke = {
      pointerId: event.pointerId,
      draft: { ...style, points: style.shape === 'free' ? [x, y] : [x, y, x, y] },
    };
    this.scheduleDraw();
  }

  private extendStroke(world: Point): void {
    const draft = this.stroke?.draft;
    if (!draft) {
      return;
    }
    const x = roundCoordinate(world.x);
    const y = roundCoordinate(world.y);
    const { points } = draft;
    if (draft.shape !== 'free') {
      points[2] = x;
      points[3] = y;
    } else {
      const lastX = points[points.length - 2];
      const lastY = points[points.length - 1];
      if (Math.hypot(x - lastX, y - lastY) < STROKE_STEP_PX * this.cellsPerPixel()) {
        return;
      }
      points.push(x, y);
    }
    this.scheduleDraw();
  }

  private finishStroke(commit: boolean): void {
    const draft = this.stroke?.draft;
    this.stroke = null;
    this.gesturing.set(false);
    this.scheduleDraw();
    if (!draft || !commit || !isMeaningfulShape(draft.shape, draft.points)) {
      return;
    }

    const points =
      draft.shape === 'free'
        ? simplifyStroke(
            draft.points.length === 2 ? [...draft.points, ...draft.points] : draft.points,
            STROKE_TOLERANCE_PX * this.cellsPerPixel(),
            DRAWING_MAX_POINTS,
          )
        : draft.points;
    const pending: DrawingDraft = { ...draft, points };
    this.pendingDrafts = [...this.pendingDrafts, pending];
    void this.table.createDrawing(pending).finally(() => {
      this.pendingDrafts = this.pendingDrafts.filter((item) => item !== pending);
      this.scheduleDraw();
    });
  }

  private startErase(event: PointerEvent): void {
    this.capture(event);
    const world = this.toWorld(event);
    this.erasing = { pointerId: event.pointerId, ids: new Set(), last: world };
    this.pointer = this.toLocal(event);
    this.sweepErase(world);
  }

  private sweepErase(world: Point): void {
    const erasing = this.erasing;
    if (!erasing) {
      return;
    }
    const sweep = { x0: erasing.last.x, y0: erasing.last.y, x1: world.x, y1: world.y };
    const radius = ERASER_RADIUS_PX * this.cellsPerPixel();
    const area = sweepBounds(sweep, radius);
    for (const drawing of this.table.drawings()) {
      if (
        !erasing.ids.has(drawing.id) &&
        this.table.canErase(drawing) &&
        this.boundsOf(drawing).intersects(area) &&
        hitsSweep(drawing, sweep, radius)
      ) {
        erasing.ids.add(drawing.id);
      }
    }
    erasing.last = world;
    this.scheduleDraw();
  }

  private boundsOf(drawing: TableDrawing): Bounds {
    let bounds = this.bounds.get(drawing);
    if (!bounds) {
      bounds = drawingBounds(drawing);
      this.bounds.set(drawing, bounds);
    }
    return bounds;
  }

  private finishErase(commit: boolean): void {
    const ids = this.erasing?.ids;
    this.erasing = null;
    this.gesturing.set(false);
    this.scheduleDraw();
    if (commit && ids && ids.size > 0) {
      void this.table.eraseDrawings([...ids]);
    }
  }

  private startMeasure(event: PointerEvent): void {
    this.capture(event);
    const world = this.toWorld(event);
    const col = clampToGrid(Math.floor(world.x));
    const row = clampToGrid(Math.floor(world.y));
    const span = { fromCol: col, fromRow: row, toCol: col, toRow: row };
    this.measuring = { pointerId: event.pointerId, span, sentAt: 0 };
    this.ownRuler.set(span);
    this.sendRuler();
  }

  private extendMeasure(world: Point): void {
    const measuring = this.measuring;
    if (!measuring) {
      return;
    }
    const toCol = clampToGrid(Math.floor(world.x));
    const toRow = clampToGrid(Math.floor(world.y));
    if (toCol === measuring.span.toCol && toRow === measuring.span.toRow) {
      return;
    }
    measuring.span = { ...measuring.span, toCol, toRow };
    this.ownRuler.set(measuring.span);
    this.hoveredCell.set({ col: toCol, row: toRow });
    this.sendRuler();
  }

  private sendRuler(): void {
    const measuring = this.measuring;
    if (!measuring || measuring.timer) {
      return;
    }
    const wait = measuring.sentAt + RULER_SEND_MS - performance.now();
    const send = () => {
      measuring.timer = undefined;
      measuring.sentAt = performance.now();
      if (this.measuring === measuring) {
        this.table.moveRuler(measuring.span);
      }
    };
    if (wait <= 0) {
      send();
    } else {
      measuring.timer = setTimeout(send, wait);
    }
  }

  private finishMeasure(): void {
    clearTimeout(this.measuring?.timer);
    this.measuring = null;
    this.gesturing.set(false);
    this.ownRuler.set(null);
    this.table.clearRuler();
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
          ? snapPoint(drag.x, drag.y)
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

    this.drawGrid(ctx, originX, originY, cell, dpr, color);
    fadeGridEdges(ctx);
    this.drawMap(ctx, originX, originY, cell, dpr, color);

    const tool = this.store.activeTool();
    const hovered = this.hoveredCell();
    const showsHover = tool === 'select' || (tool === 'measure' && !this.measuring);
    if (hovered && showsHover && !this.tokenDrag) {
      ctx.fillStyle = color('--grid-cell-hover');
      ctx.fillRect(originX + hovered.col * cell, originY + hovered.row * cell, cell, cell);
    }

    const view: RenderView = { originX, originY, cell, dpr, zoom };
    const drawPalette = readDrawPalette(styles);
    drawDrawings(ctx, this.table.drawings(), view, drawPalette, {
      cache: true,
      faded: this.erasing?.ids,
    });
    const live = this.stroke ? [...this.pendingDrafts, this.stroke.draft] : this.pendingDrafts;
    drawDrawings(ctx, live, view, drawPalette, { cache: false });
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
        lifted: token.id === this.tokenDrag?.id,
        masked: this.table.isMasked(token),
      });
    }
    const draggedId = this.tokenDrag?.id;
    rendered.sort((a, b) => Number(a.token.id === draggedId) - Number(b.token.id === draggedId));
    drawTokens(ctx, rendered, view, palette);

    const overlay = readOverlayPalette(styles);
    for (const ruler of this.table.rulers()) {
      drawRuler(ctx, ruler, view, overlay, this.table.member(ruler.by)?.displayName ?? '?');
    }
    const ownRuler = this.ownRuler();
    if (ownRuler) {
      drawRuler(ctx, ownRuler, view, overlay, null);
    }
    if (tool === 'erase' && this.pointer) {
      drawEraserCursor(
        ctx,
        this.pointer.x * dpr,
        this.pointer.y * dpr,
        ERASER_RADIUS_PX * dpr,
        dpr,
        overlay,
      );
    }

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
