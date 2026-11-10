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
  Quaternion,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Material,
} from 'three';
import { type DieFace, type DieModel, dieModel } from './dice-geometry';
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

function faceTexture(
  colors: DiceColors,
  paint: (context: CanvasRenderingContext2D) => void,
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const context = canvas.getContext('2d')!;
  context.fillStyle = colors.body;
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  context.fillStyle = colors.ink;
  paint(context);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const LABEL_SCALE: Record<DieModel['shape'], number> = {
  d4: 0.2,
  d6: 0.46,
  d8: 0.3,
  d10: 0.27,
  d12: 0.36,
  d20: 0.3,
};

function labelSize(model: DieModel, text: string): number {
  return TEXTURE_SIZE * LABEL_SCALE[model.shape] * (text.length > 1 ? 0.8 : 1);
}

export function buildDie(die: AnimatedDie, theme: DiceColors, radius: number): Group {
  const colors = die.critical ? { ...theme, body: theme.critical, ink: theme.criticalInk } : theme;
  const model = dieModel(die.shape);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const geometry = new BufferGeometry();
  const materials: Material[] = [];
  let vertexCount = 0;

  model.faces.forEach((face, faceIndex) => {
    const faceUvs = faceUv(face);
    for (let corner = 1; corner < face.points.length - 1; corner++) {
      for (const index of [0, corner, corner + 1]) {
        const point = face.points[index];
        positions.push(point.x, point.y, point.z);
        normals.push(face.normal.x, face.normal.y, face.normal.z);
        uvs.push(faceUvs[index].x, faceUvs[index].y);
      }
    }
    const count = (face.points.length - 2) * 3;
    geometry.addGroup(vertexCount, count, faceIndex);
    vertexCount += count;

    const texture = faceTexture(colors, (context) => {
      if (model.shape === 'd4') {
        face.points.forEach((point, index) => {
          const vertexIndex = model.vertices.findIndex(
            (vertex) => vertex.distanceToSquared(point) < 1e-8,
          );
          const corner = faceUvs[index];
          const x = (0.5 + (corner.x - 0.5) * 0.58) * TEXTURE_SIZE;
          const y = (1 - (0.5 + (corner.y - 0.5) * 0.58)) * TEXTURE_SIZE;
          const angle = Math.atan2(corner.x - 0.5, corner.y - 0.5);
          drawLabel(context, die.labels[vertexIndex], x, y, TEXTURE_SIZE * 0.2, angle, false);
        });
        return;
      }
      const text = die.labels[faceIndex];
      const underline = (text === '6' || text === '9') && model.shape !== 'd6';
      drawLabel(
        context,
        text,
        TEXTURE_SIZE / 2,
        TEXTURE_SIZE / 2,
        labelSize(model, text),
        0,
        underline,
      );
    });

    materials.push(
      new MeshStandardMaterial({
        map: texture,
        roughness: 0.42,
        metalness: 0.05,
        transparent: die.dropped,
        opacity: die.dropped ? 0.45 : 1,
      }),
    );
  });

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));

  const body = new Mesh(geometry, materials);
  body.castShadow = true;
  const edges = new LineSegments(
    new EdgesGeometry(geometry, 1),
    new LineBasicMaterial({ color: colors.ink, transparent: true, opacity: 0.18 }),
  );

  const group = new Group();
  group.add(body, edges);
  group.scale.setScalar(radius);
  return group;
}

export function disposeObject(group: Group): void {
  group.traverse((child) => {
    if (child instanceof Mesh || child instanceof LineSegments) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        (material as MeshStandardMaterial).map?.dispose();
        material.dispose();
      }
    }
  });
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
