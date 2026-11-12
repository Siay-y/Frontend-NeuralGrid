import { cellsAcross, clampCell, mapBytes, rescaleAroundCenter } from './maps-panel';

const map = { width: 2100, height: 1400, col: -15, row: -10, cell: 70 };

describe('maps panel helpers', () => {
  it('describes how many grid squares the image covers', () => {
    expect(cellsAcross(map)).toBe('30 × 20 quadrados');
    expect(cellsAcross({ ...map, cell: 100 })).toBe('21 × 14 quadrados');
  });

  it('keeps the map centered while the square size changes', () => {
    expect(rescaleAroundCenter(map, 140)).toEqual({ col: -7.5, row: -5, cell: 140 });
    const shifted = { ...map, col: 4, row: 2 };
    const scaled = rescaleAroundCenter(shifted, 35);
    expect(scaled.col + map.width / 35 / 2).toBeCloseTo(4 + 15);
    expect(scaled.row + map.height / 35 / 2).toBeCloseTo(2 + 10);
  });

  it('keeps the square size inside what the server accepts', () => {
    expect(clampCell(2)).toBe(8);
    expect(clampCell(5000)).toBe(1024);
    expect(clampCell(70.4)).toBe(70);
    expect(clampCell(Number.NaN)).toBeNull();
  });

  it('adds up the size of every area of a map', () => {
    const area = { ...map, id: 'a', name: 'A', bytes: 1000, hidden: false };
    expect(
      mapBytes({ id: 'm', name: 'M', active: false, areas: [area, { ...area, bytes: 500 }] }),
    ).toBe(1500);
  });
});
