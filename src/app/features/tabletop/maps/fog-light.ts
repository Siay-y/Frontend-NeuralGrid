export const FOG_RADIUS = { min: 2, max: 20, default: 6 } as const;
export const METERS_PER_SQUARE = 1.5;

export interface LightSource {
  x: number;
  y: number;
}

interface Placed {
  col: number;
  row: number;
  size: number;
}

export function lightOf(token: Placed): LightSource {
  return { x: token.col + token.size / 2, y: token.row + token.size / 2 };
}

export function isLit(lights: readonly LightSource[], token: Placed, radius: number): boolean {
  const center = lightOf(token);
  return lights.some((light) => Math.hypot(light.x - center.x, light.y - center.y) <= radius);
}

export function describeReach(radius: number): string {
  const meters = (radius * METERS_PER_SQUARE).toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  });
  return `${radius} quadrados · ${meters} m`;
}
