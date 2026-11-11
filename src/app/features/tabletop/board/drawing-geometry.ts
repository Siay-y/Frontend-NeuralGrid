import type { DrawingShape, RulerSpan, TableDrawing } from '../realtime/table.protocol';
import { CELL_SIZE } from './board-camera';

export const METERS_PER_SQUARE = 1.5;

const ELLIPSE_SAMPLES = 48;
const ARROW_HEAD_ANGLE = Math.PI / 7;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  intersects(other: Bounds): boolean;
}

function bounds(minX: number, minY: number, maxX: number, maxY: number): Bounds {
  return {
    minX,
    minY,
    maxX,
    maxY,
    intersects(other) {
      return (
        other.minX <= this.maxX &&
        other.maxX >= this.minX &&
        other.minY <= this.maxY &&
        other.maxY >= this.minY
      );
    },
  };
}

export interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function strokeWidthInCells(width: number): number {
  return width / CELL_SIZE;
}

export function arrowHeadLength(width: number): number {
  return Math.max(0.3, strokeWidthInCells(width) * 4);
}

export function arrowHead(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  length: number,
): [number, number, number, number] {
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const span = Math.min(length, Math.hypot(x1 - x0, y1 - y0) * 0.6);
  return [
    x1 - span * Math.cos(angle - ARROW_HEAD_ANGLE),
    y1 - span * Math.sin(angle - ARROW_HEAD_ANGLE),
    x1 - span * Math.cos(angle + ARROW_HEAD_ANGLE),
    y1 - span * Math.sin(angle + ARROW_HEAD_ANGLE),
  ];
}

function polyline(points: readonly number[]): Segment[] {
  const segments: Segment[] = [];
  for (let index = 0; index + 3 < points.length; index += 2) {
    segments.push({
      x0: points[index],
      y0: points[index + 1],
      x1: points[index + 2],
      y1: points[index + 3],
    });
  }
  return segments;
}

export function drawingSegments(
  drawing: Pick<TableDrawing, 'shape' | 'points' | 'width'>,
): Segment[] {
  const { points } = drawing;
  const [x0, y0, x1, y1] = points;
  switch (drawing.shape) {
    case 'free':
      return points.length === 2 ? [{ x0, y0, x1: x0, y1: y0 }] : polyline(points);
    case 'arrow': {
      const [ax, ay, bx, by] = arrowHead(x0, y0, x1, y1, arrowHeadLength(drawing.width));
      return [
        { x0, y0, x1, y1 },
        { x0: x1, y0: y1, x1: ax, y1: ay },
        { x0: x1, y0: y1, x1: bx, y1: by },
      ];
    }
    case 'rect':
      return polyline([x0, y0, x1, y0, x1, y1, x0, y1, x0, y0]);
    case 'ellipse': {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const rx = Math.abs(x1 - x0) / 2;
      const ry = Math.abs(y1 - y0) / 2;
      const ring: number[] = [];
      for (let step = 0; step <= ELLIPSE_SAMPLES; step++) {
        const angle = (step / ELLIPSE_SAMPLES) * Math.PI * 2;
        ring.push(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
      }
      return polyline(ring);
    }
  }
}

export function drawingBounds(drawing: Pick<TableDrawing, 'shape' | 'points' | 'width'>): Bounds {
  const pad =
    strokeWidthInCells(drawing.width) / 2 +
    (drawing.shape === 'arrow' ? arrowHeadLength(drawing.width) : 0);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = 0; index + 1 < drawing.points.length; index += 2) {
    minX = Math.min(minX, drawing.points[index]);
    maxX = Math.max(maxX, drawing.points[index]);
    minY = Math.min(minY, drawing.points[index + 1]);
    maxY = Math.max(maxY, drawing.points[index + 1]);
  }
  return bounds(minX - pad, minY - pad, maxX + pad, maxY + pad);
}

export function sweepBounds(sweep: Segment, radius: number): Bounds {
  return bounds(
    Math.min(sweep.x0, sweep.x1) - radius,
    Math.min(sweep.y0, sweep.y1) - radius,
    Math.max(sweep.x0, sweep.x1) + radius,
    Math.max(sweep.y0, sweep.y1) + radius,
  );
}

export function distanceToSegment(px: number, py: number, segment: Segment): number {
  const dx = segment.x1 - segment.x0;
  const dy = segment.y1 - segment.y0;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - segment.x0) * dx + (py - segment.y0) * dy) / lengthSquared));
  return Math.hypot(px - (segment.x0 + t * dx), py - (segment.y0 + t * dy));
}

export function hitsDrawing(
  drawing: Pick<TableDrawing, 'shape' | 'points' | 'width'>,
  x: number,
  y: number,
  radius: number,
): boolean {
  const reach = radius + strokeWidthInCells(drawing.width) / 2;
  return drawingSegments(drawing).some((segment) => distanceToSegment(x, y, segment) <= reach);
}

export function hitsSweep(
  drawing: Pick<TableDrawing, 'shape' | 'points' | 'width'>,
  sweep: Segment,
  radius: number,
): boolean {
  const reach = radius + strokeWidthInCells(drawing.width) / 2;
  const samples = Math.max(
    1,
    Math.ceil(Math.hypot(sweep.x1 - sweep.x0, sweep.y1 - sweep.y0) / (radius || 1)),
  );
  const segments = drawingSegments(drawing);
  for (let step = 0; step <= samples; step++) {
    const t = step / samples;
    const x = sweep.x0 + (sweep.x1 - sweep.x0) * t;
    const y = sweep.y0 + (sweep.y1 - sweep.y0) * t;
    if (segments.some((segment) => distanceToSegment(x, y, segment) <= reach)) {
      return true;
    }
  }
  return false;
}

function simplifyRange(
  points: readonly number[],
  first: number,
  last: number,
  tolerance: number,
  keep: boolean[],
): void {
  const segment = {
    x0: points[first * 2],
    y0: points[first * 2 + 1],
    x1: points[last * 2],
    y1: points[last * 2 + 1],
  };
  let farthest = -1;
  let maxDistance = tolerance;
  for (let index = first + 1; index < last; index++) {
    const distance = distanceToSegment(points[index * 2], points[index * 2 + 1], segment);
    if (distance > maxDistance) {
      maxDistance = distance;
      farthest = index;
    }
  }
  if (farthest >= 0) {
    keep[farthest] = true;
    simplifyRange(points, first, farthest, tolerance, keep);
    simplifyRange(points, farthest, last, tolerance, keep);
  }
}

export function simplifyStroke(
  points: readonly number[],
  tolerance: number,
  maxPoints: number,
): number[] {
  const count = points.length / 2;
  if (count <= 2) {
    return [...points];
  }
  let current = tolerance;
  for (;;) {
    const keep = Array.from({ length: count }, (_, index) => index === 0 || index === count - 1);
    simplifyRange(points, 0, count - 1, current, keep);
    const kept = keep.flatMap((flag, index) =>
      flag ? [points[index * 2], points[index * 2 + 1]] : [],
    );
    if (kept.length / 2 <= maxPoints) {
      return kept;
    }
    current *= 2;
  }
}

export function isMeaningfulShape(shape: DrawingShape, points: readonly number[]): boolean {
  if (shape === 'free') {
    return points.length >= 2;
  }
  const [x0, y0, x1, y1] = points;
  const minimum = 0.15;
  return shape === 'arrow'
    ? Math.hypot(x1 - x0, y1 - y0) >= minimum
    : Math.abs(x1 - x0) >= minimum || Math.abs(y1 - y0) >= minimum;
}

export function rulerSquares(span: RulerSpan): number {
  const dx = Math.abs(span.toCol - span.fromCol);
  const dy = Math.abs(span.toRow - span.fromRow);
  const diagonal = Math.min(dx, dy);
  const straight = Math.max(dx, dy) - diagonal;
  return straight + diagonal + Math.floor(diagonal / 2);
}

export function formatMeters(squares: number): string {
  const meters = squares * METERS_PER_SQUARE;
  return `${meters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m`;
}

export function rulerLabel(span: RulerSpan): string {
  const squares = rulerSquares(span);
  return `${formatMeters(squares)} · ${squares} ${squares === 1 ? 'quadrado' : 'quadrados'}`;
}
