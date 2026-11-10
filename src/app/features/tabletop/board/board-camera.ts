export const CELL_SIZE = 48;
export const MAJOR_LINE_EVERY = 5;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 1.25;

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface Cell {
  col: number;
  row: number;
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function zoomAround(
  camera: Camera,
  nextZoom: number,
  screenX: number,
  screenY: number,
): Camera {
  const zoom = clampZoom(nextZoom);
  const worldX = (screenX - camera.x) / camera.zoom;
  const worldY = (screenY - camera.y) / camera.zoom;
  return { zoom, x: screenX - worldX * zoom, y: screenY - worldY * zoom };
}

export function centeredCamera(width: number, height: number): Camera {
  return { zoom: 1, x: width / 2 - CELL_SIZE / 2, y: height / 2 - CELL_SIZE / 2 };
}

export function cellAt(camera: Camera, screenX: number, screenY: number): Cell {
  const size = CELL_SIZE * camera.zoom;
  return {
    col: Math.floor((screenX - camera.x) / size),
    row: Math.floor((screenY - camera.y) / size),
  };
}

export function sameCell(a: Cell | null, b: Cell | null): boolean {
  return a === b || (!!a && !!b && a.col === b.col && a.row === b.row);
}

export function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function interpolateCamera(from: Camera, to: Camera, t: number): Camera {
  const zoom = from.zoom * Math.pow(to.zoom / from.zoom, t);
  return {
    zoom,
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}
