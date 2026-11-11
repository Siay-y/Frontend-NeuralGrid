import {
  drawingBounds,
  formatMeters,
  hitsDrawing,
  hitsSweep,
  isMeaningfulShape,
  rulerLabel,
  rulerSquares,
  simplifyStroke,
  sweepBounds,
} from './drawing-geometry';

const span = (toCol: number, toRow: number) => ({ fromCol: 0, fromRow: 0, toCol, toRow });

describe('drawing geometry', () => {
  it('counts straight lines one square at a time', () => {
    expect(rulerSquares(span(4, 0))).toBe(4);
    expect(rulerSquares(span(0, -3))).toBe(3);
    expect(rulerSquares(span(0, 0))).toBe(0);
  });

  it('charges every second diagonal square twice', () => {
    expect(rulerSquares(span(1, 1))).toBe(1);
    expect(rulerSquares(span(2, 2))).toBe(3);
    expect(rulerSquares(span(3, 3))).toBe(4);
    expect(rulerSquares(span(5, 2))).toBe(6);
  });

  it('writes the distance in meters, 1,5 m per square', () => {
    expect(formatMeters(4)).toBe('6 m');
    expect(formatMeters(3)).toBe('4,5 m');
    expect(rulerLabel(span(1, 0))).toBe('1,5 m · 1 quadrado');
    expect(rulerLabel(span(4, 0))).toBe('6 m · 4 quadrados');
  });

  it('hits a stroke near its line and misses it far away', () => {
    const stroke = { shape: 'free' as const, width: 4 as const, points: [0, 0, 4, 0] };

    expect(hitsDrawing(stroke, 2, 0.08, 0.05)).toBe(true);
    expect(hitsDrawing(stroke, 2, 1, 0.05)).toBe(false);
  });

  it('hits only the outline of rectangles and circles', () => {
    const rect = { shape: 'rect' as const, width: 2 as const, points: [0, 0, 4, 4] };
    const circle = { shape: 'ellipse' as const, width: 2 as const, points: [0, 0, 4, 4] };

    expect(hitsDrawing(rect, 0, 2, 0.1)).toBe(true);
    expect(hitsDrawing(rect, 2, 2, 0.1)).toBe(false);
    expect(hitsDrawing(circle, 2, 0, 0.1)).toBe(true);
    expect(hitsDrawing(circle, 2, 2, 0.1)).toBe(false);
  });

  it('catches a stroke crossed by a fast eraser sweep', () => {
    const line = { shape: 'free' as const, width: 2 as const, points: [2, -2, 2, 2] };
    const sweep = { x0: 0, y0: 0, x1: 4, y1: 0 };

    expect(hitsDrawing(line, 0, 0, 0.1)).toBe(false);
    expect(hitsSweep(line, sweep, 0.1)).toBe(true);
    expect(drawingBounds(line).intersects(sweepBounds(sweep, 0.1))).toBe(true);
    expect(drawingBounds(line).intersects(sweepBounds({ x0: 9, y0: 9, x1: 10, y1: 9 }, 0.1))).toBe(
      false,
    );
  });

  it('simplifies a stroke without losing its corners and respects the point limit', () => {
    const noisy = [0, 0, 1, 0.001, 2, 0, 3, 0.002, 4, 0, 4, 1, 4, 2];
    expect(simplifyStroke(noisy, 0.01, 1000)).toEqual([0, 0, 4, 0, 4, 2]);

    const zigzag = Array.from({ length: 400 }, (_, index) =>
      index % 2 === 0 ? index / 2 : (index % 4) - 2,
    );
    expect(simplifyStroke(zigzag, 0.001, 50).length / 2).toBeLessThanOrEqual(50);
  });

  it('ignores clicks that would draw an invisible shape', () => {
    expect(isMeaningfulShape('rect', [1, 1, 1, 1])).toBe(false);
    expect(isMeaningfulShape('arrow', [1, 1, 3, 1])).toBe(true);
    expect(isMeaningfulShape('free', [1, 1])).toBe(true);
  });
});
