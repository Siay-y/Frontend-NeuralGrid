import {
  DRAWING_COLORS,
  type DrawingColor,
  type DrawingDraft,
  type RulerSpan,
} from '../realtime/table.protocol';
import { arrowHead, arrowHeadLength, rulerLabel, strokeWidthInCells } from './drawing-geometry';
import type { RenderView } from './token-renderer';

export type DrawPalette = Readonly<Record<DrawingColor, string>>;

export interface OverlayPalette {
  text: string;
  halo: string;
  cell: string;
  labelFill: string;
  labelBorder: string;
}

const FADED_ALPHA = 0.22;
const paths = new WeakMap<DrawingDraft, Path2D>();

export function readDrawPalette(styles: CSSStyleDeclaration): DrawPalette {
  return Object.fromEntries(
    DRAWING_COLORS.map(({ id }) => [id, styles.getPropertyValue(`--draw-${id}`).trim()]),
  ) as Record<DrawingColor, string>;
}

export function readOverlayPalette(styles: CSSStyleDeclaration): OverlayPalette {
  const read = (token: string) => styles.getPropertyValue(token).trim();
  return {
    text: read('--color-text'),
    halo: read('--color-bg'),
    cell: read('--grid-cell-hover'),
    labelFill: read('--color-surface'),
    labelBorder: read('--color-border-strong'),
  };
}

function buildPath(drawing: DrawingDraft): Path2D {
  const path = new Path2D();
  const { points } = drawing;
  const [x0, y0, x1, y1] = points;

  switch (drawing.shape) {
    case 'free': {
      path.moveTo(x0, y0);
      if (points.length <= 4) {
        path.lineTo(points.length === 2 ? x0 + 0.001 : x1, points.length === 2 ? y0 : y1);
        break;
      }
      for (let index = 2; index + 3 < points.length; index += 2) {
        const midX = (points[index] + points[index + 2]) / 2;
        const midY = (points[index + 1] + points[index + 3]) / 2;
        path.quadraticCurveTo(points[index], points[index + 1], midX, midY);
      }
      path.lineTo(points[points.length - 2], points[points.length - 1]);
      break;
    }
    case 'arrow': {
      const [ax, ay, bx, by] = arrowHead(x0, y0, x1, y1, arrowHeadLength(drawing.width));
      path.moveTo(x0, y0);
      path.lineTo(x1, y1);
      path.moveTo(ax, ay);
      path.lineTo(x1, y1);
      path.lineTo(bx, by);
      break;
    }
    case 'rect':
      path.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      break;
    case 'ellipse':
      path.ellipse(
        (x0 + x1) / 2,
        (y0 + y1) / 2,
        Math.abs(x1 - x0) / 2,
        Math.abs(y1 - y0) / 2,
        0,
        0,
        Math.PI * 2,
      );
      break;
  }
  return path;
}

function pathFor(drawing: DrawingDraft, cache: boolean): Path2D {
  if (!cache) {
    return buildPath(drawing);
  }
  let path = paths.get(drawing);
  if (!path) {
    path = buildPath(drawing);
    paths.set(drawing, path);
  }
  return path;
}

export function drawDrawings(
  ctx: CanvasRenderingContext2D,
  drawings: readonly DrawingDraft[],
  view: RenderView,
  palette: DrawPalette,
  options: { cache: boolean; faded?: ReadonlySet<string> },
): void {
  if (drawings.length === 0) {
    return;
  }
  ctx.save();
  ctx.setTransform(view.cell, 0, 0, view.cell, view.originX, view.originY);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const drawing of drawings) {
    const id = (drawing as { id?: string }).id;
    ctx.globalAlpha = id && options.faded?.has(id) ? FADED_ALPHA : 1;
    ctx.strokeStyle = palette[drawing.color];
    ctx.lineWidth = strokeWidthInCells(drawing.width);
    ctx.stroke(pathFor(drawing, options.cache));
  }
  ctx.restore();
}

export function drawRuler(
  ctx: CanvasRenderingContext2D,
  span: RulerSpan,
  view: RenderView,
  palette: OverlayPalette,
  owner: string | null,
): void {
  const { dpr, cell } = view;
  const center = (index: number, origin: number) => origin + (index + 0.5) * cell;
  const ax = center(span.fromCol, view.originX);
  const ay = center(span.fromRow, view.originY);
  const bx = center(span.toCol, view.originX);
  const by = center(span.toRow, view.originY);

  ctx.save();
  ctx.fillStyle = palette.cell;
  ctx.fillRect(view.originX + span.fromCol * cell, view.originY + span.fromRow * cell, cell, cell);
  ctx.fillRect(view.originX + span.toCol * cell, view.originY + span.toRow * cell, cell, cell);

  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.strokeStyle = palette.halo;
  ctx.lineWidth = 5 * dpr;
  ctx.stroke();
  ctx.setLineDash([6 * dpr, 5 * dpr]);
  ctx.strokeStyle = palette.text;
  ctx.lineWidth = 2 * dpr;
  ctx.stroke();
  ctx.setLineDash([]);

  for (const [x, y] of [
    [ax, ay],
    [bx, by],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 4 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = palette.text;
    ctx.fill();
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = palette.halo;
    ctx.stroke();
  }

  const text = owner ? `${owner} · ${rulerLabel(span)}` : rulerLabel(span);
  ctx.font = `600 ${12 * dpr}px 'Geist Variable', ui-sans-serif, sans-serif`;
  const width = ctx.measureText(text).width + 16 * dpr;
  const height = 24 * dpr;
  const right = bx + 12 * dpr + width > ctx.canvas.width;
  const left = right ? bx - 12 * dpr - width : bx + 12 * dpr;
  const top = Math.max(4 * dpr, by - height - 8 * dpr);

  ctx.beginPath();
  ctx.roundRect(left, top, width, height, height / 2);
  ctx.fillStyle = palette.labelFill;
  ctx.fill();
  ctx.lineWidth = dpr;
  ctx.strokeStyle = palette.labelBorder;
  ctx.stroke();
  ctx.fillStyle = palette.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + width / 2, top + height / 2 + dpr * 0.5);
  ctx.restore();
}

export function drawEraserCursor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  dpr: number,
  palette: OverlayPalette,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = palette.cell;
  ctx.fill();
  ctx.lineWidth = 1.5 * dpr;
  ctx.strokeStyle = palette.text;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.restore();
}
