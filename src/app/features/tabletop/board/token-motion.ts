export interface Point {
  x: number;
  y: number;
}

const SETTLE_DISTANCE = 0.002;
const RESPONSE_MS = 70;

export class TokenMotion {
  private readonly positions = new Map<string, Point>();

  step(targets: ReadonlyMap<string, Point>, elapsedMs: number): boolean {
    const blend = 1 - Math.exp(-Math.max(0, elapsedMs) / RESPONSE_MS);
    let moving = false;

    for (const id of this.positions.keys()) {
      if (!targets.has(id)) {
        this.positions.delete(id);
      }
    }

    for (const [id, target] of targets) {
      const current = this.positions.get(id);
      if (!current) {
        this.positions.set(id, { ...target });
        continue;
      }
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      if (Math.abs(dx) < SETTLE_DISTANCE && Math.abs(dy) < SETTLE_DISTANCE) {
        current.x = target.x;
        current.y = target.y;
        continue;
      }
      current.x += dx * blend;
      current.y += dy * blend;
      moving = true;
    }
    return moving;
  }

  jump(id: string, point: Point): void {
    this.positions.set(id, { ...point });
  }

  position(id: string): Point | undefined {
    return this.positions.get(id);
  }
}
