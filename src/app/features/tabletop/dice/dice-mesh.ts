import {
  BufferGeometry,
  CanvasTexture,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  type PerspectiveCamera,
  Quaternion,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { DIE_SCALE, type DieFace, type DieModel, dieModel } from './dice-geometry';
import type { DiceColors } from './dice-env';
import type { AnimatedDie } from './dice-rules';

export type { DiceColors };

const TEXTURE_SIZE = 128;
const SPIN_DECAY = 2.4;
const FONT = '"Geist Mono Variable", ui-monospace, monospace';

export function random(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function randomQuaternion(): Quaternion {
  const axis = new Vector3(random(-1, 1), random(-1, 1), random(-1, 1)).normalize();
  return new Quaternion().setFromAxisAngle(axis, random(0, Math.PI * 2));
}

function faceUv(face: DieFace): Vector2[] {
  const right = new Vector3().crossVectors(face.up, face.normal);
  const local = face.points.map((point) => {
    const offset = new Vector3().subVectors(point, face.center);
    return new Vector2(offset.dot(right), offset.dot(face.up));
  });
  const reach = Math.max(...local.map((point) => point.length()));
  const scale = 0.5 / reach;
  return local.map((point) => new Vector2(0.5 + point.x * scale, 0.5 + point.y * scale));
}

function drawLabel(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  angle: number,
  underline: boolean,
): void {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.font = `600 ${size}px ${FONT}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 0, 0);
  if (underline) {
    const width = context.measureText(text).width;
    context.fillRect(-width / 2, size * 0.42, width, Math.max(2, size * 0.07));
  }
  context.restore();
}

const LABEL_SCALE: Record<DieModel['shape'], number> = {
  d4: 0.2,
  d6: 0.46,
  d8: 0.3,
  d10: 0.27,
  d12: 0.36,
  d20: 0.3,
  d100: 0.4,
};

const CELL_INSET = 0.96;

const LENGTH_SCALE = [1, 1, 0.8, 0.62];

const UPSIDE_DOWN: Readonly<Record<string, string>> = {
  '0': '0',
  '1': '1',
  '6': '9',
  '8': '8',
  '9': '6',
};

function readsAnotherWayUp(text: string): boolean {
  const digits = [...text];
  if (!digits.every((digit) => digit in UPSIDE_DOWN)) {
    return false;
  }
  const turned = digits
    .reverse()
    .map((digit) => UPSIDE_DOWN[digit])
    .join('');
  return turned !== text && !turned.startsWith('0');
}

function labelSize(model: DieModel, text: string): number {
  return TEXTURE_SIZE * LABEL_SCALE[model.shape] * LENGTH_SCALE[Math.min(text.length, 3)];
}

interface Atlas {
  columns: number;
  rows: number;
}

function atlasFor(model: DieModel): Atlas {
  const columns = Math.ceil(Math.sqrt(model.faces.length));
  return { columns, rows: Math.ceil(model.faces.length / columns) };
}

function paintFace(
  context: CanvasRenderingContext2D,
  model: DieModel,
  faceIndex: number,
  labels: readonly string[],
): void {
  const face = model.faces[faceIndex];
  if (model.shape === 'd4') {
    const corners = faceUv(face);
    face.points.forEach((point, index) => {
      const vertexIndex = model.vertices.findIndex(
        (vertex) => vertex.distanceToSquared(point) < 1e-8,
      );
      const corner = corners[index];
      const x = (0.5 + (corner.x - 0.5) * 0.58) * TEXTURE_SIZE;
      const y = (1 - (0.5 + (corner.y - 0.5) * 0.58)) * TEXTURE_SIZE;
      const angle = Math.atan2(corner.x - 0.5, corner.y - 0.5);
      drawLabel(context, labels[vertexIndex], x, y, TEXTURE_SIZE * 0.2, angle, false);
    });
    return;
  }
  const text = labels[faceIndex];
  const underline = model.shape !== 'd6' && readsAnotherWayUp(text);
  drawLabel(
    context,
    text,
    TEXTURE_SIZE / 2,
    TEXTURE_SIZE / 2,
    labelSize(model, text),
    0,
    underline,
  );
}

function atlasTexture(
  model: DieModel,
  labels: readonly string[],
  colors: Pick<DiceColors, 'body' | 'ink'>,
): CanvasTexture {
  const { columns, rows } = atlasFor(model);
  const canvas = document.createElement('canvas');
  canvas.width = columns * TEXTURE_SIZE;
  canvas.height = rows * TEXTURE_SIZE;
  const context = canvas.getContext('2d')!;
  context.fillStyle = colors.body;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = colors.ink;
  model.faces.forEach((_face, faceIndex) => {
    context.save();
    context.translate(
      (faceIndex % columns) * TEXTURE_SIZE,
      Math.floor(faceIndex / columns) * TEXTURE_SIZE,
    );
    paintFace(context, model, faceIndex, labels);
    context.restore();
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function dieGeometry(model: DieModel): BufferGeometry {
  const { columns, rows } = atlasFor(model);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  model.faces.forEach((face, faceIndex) => {
    const column = faceIndex % columns;
    const row = rows - 1 - Math.floor(faceIndex / columns);
    const faceUvs = faceUv(face).map(
      (uv) =>
        new Vector2(
          (column + 0.5 + (uv.x - 0.5) * CELL_INSET) / columns,
          (row + 0.5 + (uv.y - 0.5) * CELL_INSET) / rows,
        ),
    );
    for (let corner = 1; corner < face.points.length - 1; corner++) {
      for (const index of [0, corner, corner + 1]) {
        const point = face.points[index];
        positions.push(point.x, point.y, point.z);
        normals.push(face.normal.x, face.normal.y, face.normal.z);
        uvs.push(faceUvs[index].x, faceUvs[index].y);
      }
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  return geometry;
}

interface ShapeParts {
  body: BufferGeometry;
  edges: EdgesGeometry;
}

interface Look {
  body: MeshStandardMaterial;
  edges: LineBasicMaterial;
}

export class DiceKit {
  private readonly shapes = new Map<DieModel['shape'], ShapeParts>();
  private readonly looks = new Map<string, Look>();

  build(die: AnimatedDie, theme: DiceColors, radius: number): Group {
    const model = dieModel(die.shape);
    const parts = this.partsFor(model);
    const look = this.lookFor(model, die, this.colorsFor(die, theme));

    const body = new Mesh(parts.body, look.body);
    body.castShadow = true;
    const group = new Group();
    group.add(body, new LineSegments(parts.edges, look.edges));
    group.scale.setScalar(radius * DIE_SCALE[model.shape]);
    return group;
  }

  async warmUp(
    dice: readonly AnimatedDie[],
    theme: DiceColors,
    renderer: WebGLRenderer,
    scene: Object3D,
    camera: PerspectiveCamera,
  ): Promise<void> {
    for (const die of dice) {
      this.lookFor(dieModel(die.shape), die, this.colorsFor(die, theme));
    }
    for (const look of this.looks.values()) {
      if (look.body.map) {
        renderer.initTexture(look.body.map);
      }
    }
    await renderer.compileAsync(scene, camera);
  }

  dispose(): void {
    for (const parts of this.shapes.values()) {
      parts.body.dispose();
      parts.edges.dispose();
    }
    for (const look of this.looks.values()) {
      look.body.map?.dispose();
      look.body.dispose();
      look.edges.dispose();
    }
    this.shapes.clear();
    this.looks.clear();
  }

  private colorsFor(die: AnimatedDie, theme: DiceColors): Pick<DiceColors, 'body' | 'ink'> {
    if (die.outcome === 'failure') {
      return { body: theme.critical, ink: theme.criticalInk };
    }
    if (die.outcome === 'success') {
      return { body: theme.success, ink: theme.successInk };
    }
    return theme;
  }

  private partsFor(model: DieModel): ShapeParts {
    let parts = this.shapes.get(model.shape);
    if (!parts) {
      const body = dieGeometry(model);
      parts = { body, edges: new EdgesGeometry(body, 1) };
      this.shapes.set(model.shape, parts);
    }
    return parts;
  }

  private lookFor(
    model: DieModel,
    die: AnimatedDie,
    colors: Pick<DiceColors, 'body' | 'ink'>,
  ): Look {
    const key = [model.shape, die.labels.join(','), colors.body, colors.ink, die.dropped].join('|');
    let look = this.looks.get(key);
    if (!look) {
      look = {
        body: new MeshStandardMaterial({
          map: atlasTexture(model, die.labels, colors),
          roughness: 0.42,
          metalness: 0.05,
          transparent: die.dropped,
          opacity: die.dropped ? 0.45 : 1,
        }),
        edges: new LineBasicMaterial({ color: colors.ink, transparent: true, opacity: 0.18 }),
      };
      this.looks.set(key, look);
    }
    return look;
  }
}

export interface Tumble {
  axis: Vector3;
  speed: number;
  initial: Quaternion;
  target: Quaternion;
}

export function randomTumble(target: Quaternion): Tumble {
  return {
    axis: new Vector3(random(-1, 1), random(-0.4, 0.4), random(-1, 1)).normalize(),
    speed: random(13, 18),
    initial: randomQuaternion(),
    target,
  };
}

export function tumbleAt(tumble: Tumble, t: number, settle: number): Quaternion {
  const turned = (tumble.speed * (1 - Math.exp(-SPIN_DECAY * t))) / SPIN_DECAY;
  const free = new Quaternion().setFromAxisAngle(tumble.axis, turned).multiply(tumble.initial);
  const blend = easeInOutCubic(clamp01((t - settle * 0.22) / (settle * 0.72)));
  return free.slerp(tumble.target, blend);
}
