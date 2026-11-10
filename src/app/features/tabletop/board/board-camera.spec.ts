import {
  CELL_SIZE,
  cellAt,
  centeredCamera,
  interpolateCamera,
  MAX_ZOOM,
  MIN_ZOOM,
  zoomAround,
} from './board-camera';

describe('board camera', () => {
  it('centers the origin cell in the viewport', () => {
    const camera = centeredCamera(800, 600);

    expect(cellAt(camera, 400, 300)).toEqual({ col: 0, row: 0 });
  });

  it('maps screen points to grid cells, including negative ones', () => {
    const camera = { x: 100, y: 100, zoom: 1 };

    expect(cellAt(camera, 100 + CELL_SIZE * 2 + 1, 100 + 1)).toEqual({ col: 2, row: 0 });
    expect(cellAt(camera, 99, 99)).toEqual({ col: -1, row: -1 });
  });

  it('keeps the point under the cursor fixed while zooming', () => {
    const camera = { x: 37, y: -12, zoom: 1 };
    const before = cellAt(camera, 250, 180);

    const zoomed = zoomAround(camera, 2, 250, 180);

    expect(zoomed.zoom).toBe(2);
    expect(cellAt(zoomed, 250, 180)).toEqual(before);
  });

  it('clamps zoom to the supported range', () => {
    const camera = { x: 0, y: 0, zoom: 1 };

    expect(zoomAround(camera, 100, 0, 0).zoom).toBe(MAX_ZOOM);
    expect(zoomAround(camera, 0.001, 0, 0).zoom).toBe(MIN_ZOOM);
  });

  it('interpolates between cameras', () => {
    const from = { x: 0, y: 0, zoom: 1 };
    const to = { x: 100, y: 50, zoom: 4 };

    expect(interpolateCamera(from, to, 0)).toEqual(from);
    expect(interpolateCamera(from, to, 1)).toEqual(to);
    expect(interpolateCamera(from, to, 0.5).zoom).toBeCloseTo(2);
  });
});
