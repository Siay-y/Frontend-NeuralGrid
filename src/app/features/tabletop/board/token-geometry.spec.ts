import type { TableToken } from '../realtime/table.protocol';
import { findFreeCell, hitTest, snapToCell, tokenInitials } from './token-geometry';

const token = (overrides: Partial<TableToken>): TableToken => ({
  id: 't',
  label: 'Token',
  kind: 'agent',
  ownerId: null,
  col: 0,
  row: 0,
  size: 1,
  version: 1,
  ...overrides,
});

describe('token geometry', () => {
  it('derives initials from one or two words', () => {
    expect(tokenInitials('Dante')).toBe('DA');
    expect(tokenInitials('  zumbi de sangue ')).toBe('ZD');
    expect(tokenInitials('   ')).toBe('?');
  });

  it('hits the round body of a token and favours the one drawn on top', () => {
    const below = { token: token({ id: 'below', size: 2 }), x: 0, y: 0 };
    const above = { token: token({ id: 'above' }), x: 0.5, y: 0.5 };

    expect(hitTest([below, above], 1, 1)?.token.id).toBe('above');
    expect(hitTest([below, above], 1.7, 1)?.token.id).toBe('below');
    expect(hitTest([below], 0.02, 0.02)).toBeUndefined();
  });

  it('snaps to the nearest cell within the grid limits', () => {
    expect(snapToCell(2.4, -1.6)).toEqual({ col: 2, row: -2 });
    expect(snapToCell(900, -900)).toEqual({ col: 500, row: -500 });
  });

  it('places new tokens on the closest free cell', () => {
    const occupied = [token({ col: 0, row: 0 })];

    expect(findFreeCell([], { col: 3, row: 3 })).toEqual({ col: 3, row: 3 });
    expect(findFreeCell(occupied, { col: 0, row: 0 })).toEqual({ col: -1, row: -1 });
  });

  it('considers the full footprint of large tokens', () => {
    const occupied = [token({ col: 0, row: 0 })];

    const cell = findFreeCell(occupied, { col: 0, row: 0 }, 2);

    expect([cell.col, cell.col + 1].includes(0) && [cell.row, cell.row + 1].includes(0)).toBe(
      false,
    );
  });
});
