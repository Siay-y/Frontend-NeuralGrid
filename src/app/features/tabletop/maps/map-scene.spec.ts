import { areaAt } from './map-scene';

const entrance = { id: 'a', width: 700, height: 700, col: 0, row: 0, cell: 70 };
const tower = { id: 'b', width: 350, height: 350, col: 8, row: 2, cell: 70 };

describe('map scene', () => {
  it('finds the area under a grid point, preferring the one drawn on top', () => {
    expect(areaAt([entrance, tower], 3, 3)?.id).toBe('a');
    expect(areaAt([entrance, tower], 12.5, 6)?.id).toBe('b');
    expect(areaAt([entrance, { ...tower, col: 5 }], 6, 3)?.id).toBe('b');
    expect(areaAt([entrance, tower], 20, 20)).toBeNull();
  });
});
