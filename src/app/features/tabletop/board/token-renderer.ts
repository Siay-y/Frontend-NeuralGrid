import type { TableToken } from '../realtime/table.protocol';
import { TOKEN_BODY_RATIO, tokenInitials } from './token-geometry';

export interface TokenPalette {
  agentFill: string;
  agentText: string;
  surface: string;
  stroke: string;
  text: string;
  labelFill: string;
  labelBorder: string;
  ghost: string;
}

export interface RenderedToken {
  token: TableToken;
  x: number;
  y: number;
  selected: boolean;
  remote: boolean;
}

export interface RenderView {
  originX: number;
  originY: number;
  cell: number;
  dpr: number;
  zoom: number;
}

export function readTokenPalette(styles: CSSStyleDeclaration): TokenPalette {
  const read = (token: string) => styles.getPropertyValue(token).trim();
  return {
    agentFill: read('--color-inverse'),
    agentText: read('--color-inverse-text'),
    surface: read('--color-surface-raised'),
    stroke: read('--color-text-muted'),
    text: read('--color-text'),
    labelFill: read('--color-surface'),
    labelBorder: read('--color-border'),
    ghost: read('--grid-origin'),
  };
}

export function drawDropTarget(
  ctx: CanvasRenderingContext2D,
  view: RenderView,
  palette: TokenPalette,
  col: number,
  row: number,
  size: number,
): void {
  const inset = 2 * view.dpr;
  ctx.save();
  ctx.setLineDash([4 * view.dpr, 3 * view.dpr]);
  ctx.lineWidth = view.dpr;
  ctx.strokeStyle = palette.ghost;
  ctx.strokeRect(
    view.originX + col * view.cell + inset,
    view.originY + row * view.cell + inset,
    size * view.cell - inset * 2,
    size * view.cell - inset * 2,
  );
  ctx.restore();
}

export function drawTokens(
  ctx: CanvasRenderingContext2D,
  items: readonly RenderedToken[],
  view: RenderView,
  palette: TokenPalette,
): void {
  const { dpr } = view;
  const showLabels = view.zoom >= 0.7;

  for (const item of items) {
    const { token } = item;
    const half = (token.size * view.cell) / 2;
    const cx = view.originX + item.x * view.cell + half;
    const cy = view.originY + item.y * view.cell + half;
    const radius = half * TOKEN_BODY_RATIO;

    ctx.save();
    ctx.globalAlpha = item.remote ? 0.65 : 1;

    if (item.selected) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 4 * dpr, 0, Math.PI * 2);
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeStyle = palette.text;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = token.kind === 'agent' ? palette.agentFill : palette.surface;
    ctx.fill();

    if (token.kind !== 'agent') {
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeStyle = token.kind === 'threat' ? palette.text : palette.stroke;
      ctx.setLineDash(token.kind === 'threat' ? [3 * dpr, 2.5 * dpr] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (radius >= 9 * dpr) {
      ctx.fillStyle = token.kind === 'agent' ? palette.agentText : palette.text;
      ctx.font = `600 ${Math.round(radius * 0.6)}px 'Geist Mono Variable', ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tokenInitials(token.label), cx, cy + dpr * 0.5);
    }

    if (showLabels) {
      drawLabel(ctx, token.label, cx, cy + radius + 6 * dpr, dpr, palette);
    }
    ctx.restore();
  }
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  top: number,
  dpr: number,
  palette: TokenPalette,
): void {
  ctx.font = `500 ${11 * dpr}px 'Geist Variable', ui-sans-serif, sans-serif`;
  const width = ctx.measureText(text).width + 12 * dpr;
  const height = 18 * dpr;

  ctx.beginPath();
  ctx.roundRect(cx - width / 2, top, width, height, height / 2);
  ctx.fillStyle = palette.labelFill;
  ctx.fill();
  ctx.lineWidth = dpr;
  ctx.strokeStyle = palette.labelBorder;
  ctx.stroke();

  ctx.fillStyle = palette.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, top + height / 2 + dpr * 0.5);
}
