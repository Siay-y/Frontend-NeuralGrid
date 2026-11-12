import type { LightSource } from '../maps/fog-light';

const LIGHT_STOPS: readonly [number, number][] = [
  [0, 1],
  [0.45, 0.92],
  [0.75, 0.5],
  [1, 0],
];

// The fog is painted on a reusable offscreen canvas, then each light erases a
// soft circle from it, bright in the middle and fading towards its reach.
export class LightFog {
  private readonly scratch = document.createElement('canvas');

  draw(
    ctx: CanvasRenderingContext2D,
    lights: readonly LightSource[],
    radius: number,
    color: string,
    alpha: number,
  ): void {
    const { width, height } = ctx.canvas;
    if (this.scratch.width !== width || this.scratch.height !== height) {
      this.scratch.width = width;
      this.scratch.height = height;
    }
    const fog = this.scratch.getContext('2d');
    if (!fog) {
      return;
    }
    fog.globalCompositeOperation = 'source-over';
    fog.clearRect(0, 0, width, height);
    fog.fillStyle = color;
    fog.fillRect(0, 0, width, height);
    fog.globalCompositeOperation = 'destination-out';
    for (const light of lights) {
      if (
        light.x < -radius ||
        light.y < -radius ||
        light.x > width + radius ||
        light.y > height + radius
      ) {
        continue;
      }
      const glow = fog.createRadialGradient(light.x, light.y, 0, light.x, light.y, radius);
      for (const [offset, strength] of LIGHT_STOPS) {
        glow.addColorStop(offset, `rgba(0, 0, 0, ${strength})`);
      }
      fog.fillStyle = glow;
      fog.fillRect(light.x - radius, light.y - radius, radius * 2, radius * 2);
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.scratch, 0, 0);
    ctx.restore();
  }
}
