import { describeReach, isLit, lightOf } from './fog-light';

describe('fog light', () => {
  it('shines from the center of the token', () => {
    expect(lightOf({ col: 2, row: 3, size: 1 })).toEqual({ x: 2.5, y: 3.5 });
    expect(lightOf({ col: 0, row: 0, size: 2 })).toEqual({ x: 1, y: 1 });
  });

  it('lights tokens whose center is within the reach of any light', () => {
    const lights = [lightOf({ col: 0, row: 0, size: 1 })];
    expect(isLit(lights, { col: 4, row: 3, size: 1 }, 6)).toBe(true);
    expect(isLit(lights, { col: 5, row: 4, size: 1 }, 6)).toBe(false);
    expect(isLit([], { col: 0, row: 0, size: 1 }, 6)).toBe(false);
  });

  it('describes the reach in squares and meters', () => {
    expect(describeReach(6)).toBe('6 quadrados · 9 m');
    expect(describeReach(5)).toBe('5 quadrados · 7,5 m');
  });
});
