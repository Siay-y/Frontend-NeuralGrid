import type { LightSource } from '../maps/fog-light';

const LIGHT_STOPS: readonly [number, number][] = [
  [0, 1],
  [0.45, 0.92],
  [0.75, 0.5],
  [1, 0],
];

const FOG_SCALE = 0.25;
const FADE_MS = 500;
const RADIUS_EASE_MS = 140;
const MIST_STRENGTH = 0.7;
const MEMORY_REVEAL = 0.4;
const MEMORY_CELL_PX = 8;
const MEMORY_MAX_SIDE = 2048;
const MEMORY_STOPS: readonly [number, number][] = [
  [0, 1],
  [0.55, 0.85],
  [1, 0],
];

interface NoiseSheet {
  seed: number;
  size: number;
  cells: number;
  stretch: number;
  basePeriod: number;
  octaves: number;
  warp: number;
  floor: number;
  ceiling: number;
  speedX: number;
  speedY: number;
  alpha: number;
}

const MIST_LAYERS: readonly NoiseSheet[] = [
  {
    seed: 7,
    size: 256,
    cells: 84,
    stretch: 1.8,
    basePeriod: 2,
    octaves: 5,
    warp: 0.45,
    floor: -0.02,
    ceiling: 0.4,
    speedX: 0.3,
    speedY: 0.06,
    alpha: 1,
  },
  {
    seed: 29,
    size: 256,
    cells: 47,
    stretch: 2.2,
    basePeriod: 2,
    octaves: 5,
    warp: 0.6,
    floor: 0.04,
    ceiling: 0.4,
    speedX: 0.42,
    speedY: 0.02,
    alpha: 0.9,
  },
];

const MIST_MASK: NoiseSheet = {
  seed: 41,
  size: 128,
  cells: 150,
  stretch: 1.3,
  basePeriod: 3,
  octaves: 3,
  warp: 0.3,
  floor: -0.08,
  ceiling: 0.22,
  speedX: 0.12,
  speedY: 0.03,
  alpha: 1,
};

const MIST_SHEETS: readonly NoiseSheet[] = [...MIST_LAYERS, MIST_MASK];

export interface FogTarget {
  enabled: boolean;
  radius: number;
}

export interface FogView {
  originX: number;
  originY: number;
  cell: number;
}

export interface FogColors {
  fog: string;
  mist: string;
}

export interface FogMemory {
  spots: readonly LightSource[];
  radius: number;
}

interface MemoryFrame {
  left: number;
  top: number;
  scale: number;
}

export class LightFog {
  private readonly scratch = document.createElement('canvas');
  private readonly mist = document.createElement('canvas');
  private readonly tiles: (HTMLCanvasElement | null)[] = [];
  private readonly memoryMask = document.createElement('canvas');
  private memoryFor: FogMemory | null = null;
  private memoryFrame: MemoryFrame | null = null;
  private level = 0;
  private radius = 0;
  private seconds = 0;
  private moving = false;

  get drifting(): boolean {
    return this.moving;
  }

  get preparing(): boolean {
    return this.level > 0 && this.tiles.length < MIST_SHEETS.length;
  }

  get visible(): boolean {
    return this.level > 0;
  }

  step(target: FogTarget, elapsedMs: number, settle: boolean, still: boolean): boolean {
    const goal = target.enabled ? 1 : 0;
    if (settle || still) {
      this.level = goal;
      this.radius = target.radius;
    } else if (this.radius === 0) {
      this.radius = target.radius;
    }
    const delta = Math.min(elapsedMs, 100);
    if (this.level !== goal) {
      const change = delta / FADE_MS;
      this.level =
        goal > this.level
          ? Math.min(goal, this.level + change)
          : Math.max(goal, this.level - change);
    }
    if (this.radius !== target.radius) {
      this.radius += (target.radius - this.radius) * (1 - Math.exp(-delta / RADIUS_EASE_MS));
      if (Math.abs(target.radius - this.radius) < 0.01) {
        this.radius = target.radius;
      }
    }
    this.moving = this.level > 0 && !still;
    if (this.moving) {
      this.seconds += delta / 1000;
    }
    return this.level !== goal || this.radius !== target.radius;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    lights: readonly LightSource[],
    view: FogView,
    colors: FogColors,
    alpha: number,
    memory: FogMemory | null = null,
  ): void {
    if (this.level === 0) {
      return;
    }
    const { width, height } = ctx.canvas;
    const fogWidth = Math.max(1, Math.ceil(width * FOG_SCALE));
    const fogHeight = Math.max(1, Math.ceil(height * FOG_SCALE));
    const fog = this.layer(this.scratch, fogWidth, fogHeight);
    if (!fog) {
      return;
    }
    fog.globalAlpha = 1;
    fog.globalCompositeOperation = 'source-over';
    fog.clearRect(0, 0, fogWidth, fogHeight);
    fog.fillStyle = colors.fog;
    fog.fillRect(0, 0, fogWidth, fogHeight);
    if (this.paintMist(view, colors.mist, fogWidth, fogHeight)) {
      fog.globalAlpha = MIST_STRENGTH;
      fog.drawImage(this.mist, 0, 0);
    }

    fog.globalCompositeOperation = 'destination-out';
    const frame = memory ? this.paintMemory(memory) : null;
    if (frame) {
      const unit = view.cell * FOG_SCALE;
      fog.globalAlpha = MEMORY_REVEAL;
      fog.drawImage(
        this.memoryMask,
        (view.originX + frame.left * view.cell) * FOG_SCALE,
        (view.originY + frame.top * view.cell) * FOG_SCALE,
        (this.memoryMask.width / frame.scale) * unit,
        (this.memoryMask.height / frame.scale) * unit,
      );
    }

    fog.globalAlpha = 1;
    const radius = this.radius * view.cell;
    const reach = radius * FOG_SCALE;
    for (const light of lights) {
      if (
        light.x < -radius ||
        light.y < -radius ||
        light.x > width + radius ||
        light.y > height + radius
      ) {
        continue;
      }
      const x = light.x * FOG_SCALE;
      const y = light.y * FOG_SCALE;
      const glow = fog.createRadialGradient(x, y, 0, x, y, reach);
      for (const [offset, strength] of LIGHT_STOPS) {
        glow.addColorStop(offset, `rgba(0, 0, 0, ${strength})`);
      }
      fog.fillStyle = glow;
      fog.fillRect(x - reach, y - reach, reach * 2, reach * 2);
    }

    const eased = this.level * this.level * (3 - 2 * this.level);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha * eased;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.scratch, 0, 0, width, height);
    ctx.restore();
  }

  private paintMemory(memory: FogMemory): MemoryFrame | null {
    if (memory.spots.length === 0) {
      return null;
    }
    const cached = this.memoryFor;
    if (cached && cached.spots === memory.spots && cached.radius === memory.radius) {
      return this.memoryFrame;
    }
    const xs = memory.spots.map((spot) => spot.x);
    const ys = memory.spots.map((spot) => spot.y);
    const left = Math.min(...xs) - memory.radius;
    const top = Math.min(...ys) - memory.radius;
    const spanX = Math.max(...xs) + memory.radius - left;
    const spanY = Math.max(...ys) + memory.radius - top;
    const scale = Math.min(MEMORY_CELL_PX, MEMORY_MAX_SIDE / Math.max(spanX, spanY, 1));
    const mask = this.layer(
      this.memoryMask,
      Math.max(1, Math.ceil(spanX * scale)),
      Math.max(1, Math.ceil(spanY * scale)),
    );
    if (!mask) {
      return null;
    }
    mask.clearRect(0, 0, this.memoryMask.width, this.memoryMask.height);
    const reach = memory.radius * scale;
    for (const spot of memory.spots) {
      const x = (spot.x - left) * scale;
      const y = (spot.y - top) * scale;
      const glow = mask.createRadialGradient(x, y, 0, x, y, reach);
      for (const [offset, strength] of MEMORY_STOPS) {
        glow.addColorStop(offset, `rgba(255, 255, 255, ${strength})`);
      }
      mask.fillStyle = glow;
      mask.fillRect(x - reach, y - reach, reach * 2, reach * 2);
    }
    this.memoryFor = memory;
    this.memoryFrame = { left, top, scale };
    return this.memoryFrame;
  }

  private layer(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
  ): CanvasRenderingContext2D | null {
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return canvas.getContext('2d');
  }

  private paintMist(view: FogView, color: string, width: number, height: number): boolean {
    if (this.tiles.length < MIST_SHEETS.length) {
      this.tiles.push(noiseTile(MIST_SHEETS[this.tiles.length]));
      return false;
    }
    const mist = this.layer(this.mist, width, height);
    if (!mist || view.cell <= 0) {
      return false;
    }
    mist.globalCompositeOperation = 'source-over';
    mist.clearRect(0, 0, width, height);
    MIST_LAYERS.forEach((sheet, index) => {
      mist.globalAlpha = sheet.alpha;
      this.fillSheet(mist, sheet, this.tiles[index], view, width, height);
    });
    mist.globalAlpha = 1;
    mist.globalCompositeOperation = 'destination-in';
    this.fillSheet(mist, MIST_MASK, this.tiles[MIST_LAYERS.length], view, width, height);
    mist.globalCompositeOperation = 'source-in';
    mist.fillStyle = color;
    mist.fillRect(0, 0, width, height);
    return true;
  }

  private fillSheet(
    ctx: CanvasRenderingContext2D,
    sheet: NoiseSheet,
    tile: HTMLCanvasElement | null | undefined,
    view: FogView,
    width: number,
    height: number,
  ): void {
    const pattern = tile && ctx.createPattern(tile, 'repeat');
    if (!pattern) {
      return;
    }
    const tileHeight = sheet.cells * view.cell * FOG_SCALE;
    const tileWidth = tileHeight * sheet.stretch;
    const drift = this.seconds * view.cell * FOG_SCALE;
    const x = (view.originX * FOG_SCALE + drift * sheet.speedX) % tileWidth;
    const y = (view.originY * FOG_SCALE + drift * sheet.speedY) % tileHeight;
    pattern.setTransform(
      new DOMMatrix([tileWidth / sheet.size, 0, 0, tileHeight / sheet.size, x, y]),
    );
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
  }
}

function noiseTile(sheet: NoiseSheet): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = sheet.size;
  canvas.height = sheet.size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  const noise = tiledNoise(sheet, seeded(sheet.seed));
  const image = ctx.createImageData(sheet.size, sheet.size);
  for (let py = 0; py < sheet.size; py++) {
    for (let px = 0; px < sheet.size; px++) {
      const u = px / sheet.size;
      const v = py / sheet.size;
      const warpX = noise(u + 0.31, v + 0.17);
      const warpY = noise(u + 0.52, v + 0.83);
      const value = noise(u + sheet.warp * warpX, v + sheet.warp * warpY);
      const t = Math.min(1, Math.max(0, (value - sheet.floor) / (sheet.ceiling - sheet.floor)));
      const index = (py * sheet.size + px) * 4;
      image.data[index] = 255;
      image.data[index + 1] = 255;
      image.data[index + 2] = 255;
      image.data[index + 3] = Math.round(t * t * (3 - 2 * t) * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function tiledNoise(sheet: NoiseSheet, random: () => number): (u: number, v: number) => number {
  const octaves = Array.from({ length: sheet.octaves }, (_, octave) => {
    const period = sheet.basePeriod << octave;
    const gradients = Array.from({ length: period * period }, () => {
      const angle = random() * Math.PI * 2;
      return [Math.cos(angle), Math.sin(angle)] as const;
    });
    return { period, gradients };
  });
  return (u, v) => {
    let sum = 0;
    let amplitude = 0.5;
    for (const { period, gradients } of octaves) {
      sum += amplitude * gradientNoise(gradients, period, u * period, v * period);
      amplitude *= 0.5;
    }
    return sum;
  };
}

function gradientNoise(
  gradients: readonly (readonly [number, number])[],
  period: number,
  x: number,
  y: number,
): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const corner = (cx: number, cy: number, dx: number, dy: number) => {
    const wrap = (n: number) => ((n % period) + period) % period;
    const [gx, gy] = gradients[wrap(cy) * period + wrap(cx)];
    return gx * dx + gy * dy;
  };
  const sx = quintic(fx);
  const sy = quintic(fy);
  const top =
    corner(x0, y0, fx, fy) + (corner(x0 + 1, y0, fx - 1, fy) - corner(x0, y0, fx, fy)) * sx;
  const bottom =
    corner(x0, y0 + 1, fx, fy - 1) +
    (corner(x0 + 1, y0 + 1, fx - 1, fy - 1) - corner(x0, y0 + 1, fx, fy - 1)) * sx;
  return top + (bottom - top) * sy;
}

function quintic(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
