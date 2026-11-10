import type { TableToken } from '../realtime/table.protocol';
import type { GridCell } from '../tabletop.store';

export const GRID_LIMIT = 500;
export const TOKEN_BODY_RATIO = 0.84;

export interface PlacedToken {
  token: TableToken;
  x: number;
  y: number;
}

export function tokenInitials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.toUpperCase();
}

export function hitTest(
  placed: readonly PlacedToken[],
  worldX: number,
  worldY: number,
): PlacedToken | undefined {
  for (let index = placed.length - 1; index >= 0; index--) {
    const item = placed[index];
    const half = item.token.size / 2;
    const dx = worldX - (item.x + half);
    const dy = worldY - (item.y + half);
    const radius = half * TOKEN_BODY_RATIO;
    if (dx * dx + dy * dy <= radius * radius) {
      return item;
    }
  }
  return undefined;
}

export function clampToGrid(value: number): number {
  return Math.min(GRID_LIMIT, Math.max(-GRID_LIMIT, value));
}

export function snapToCell(x: number, y: number): GridCell {
  return { col: clampToGrid(Math.round(x)), row: clampToGrid(Math.round(y)) };
}

function occupiedCells(tokens: readonly TableToken[]): Set<string> {
  const cells = new Set<string>();
  for (const token of tokens) {
    for (let dx = 0; dx < token.size; dx++) {
      for (let dy = 0; dy < token.size; dy++) {
        cells.add(`${token.col + dx}:${token.row + dy}`);
      }
    }
  }
  return cells;
}

export function findFreeCell(
  tokens: readonly TableToken[],
  origin: GridCell,
  size = 1,
  maxRadius = 8,
): GridCell {
  const occupied = occupiedCells(tokens);
  const fits = (col: number, row: number) => {
    for (let dx = 0; dx < size; dx++) {
      for (let dy = 0; dy < size; dy++) {
        if (occupied.has(`${col + dx}:${row + dy}`)) {
          return false;
        }
      }
    }
    return true;
  };

  for (let radius = 0; radius <= maxRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) {
          continue;
        }
        const col = clampToGrid(origin.col + dx);
        const row = clampToGrid(origin.row + dy);
        if (fits(col, row)) {
          return { col, row };
        }
      }
    }
  }
  return origin;
}
