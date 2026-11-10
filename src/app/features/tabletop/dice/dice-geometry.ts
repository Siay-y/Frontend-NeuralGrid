import {
  type BufferGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  Quaternion,
  TetrahedronGeometry,
  Vector3,
} from 'three';
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js';
import type { DieShape } from './dice-rules';

export interface DieFace {
  points: Vector3[];
  center: Vector3;
  normal: Vector3;
  up: Vector3;
}

export interface DieModel {
  shape: DieShape;
  faces: DieFace[];
  vertices: Vector3[];
  targets: Vector3[];
  uprights: (Vector3 | null)[];
}

export const WORLD_UP = new Vector3(0, 1, 0);

export const DIE_SCALE: Readonly<Record<DieShape, number>> = {
  d4: 1,
  d6: 1,
  d8: 1,
  d10: 1,
  d12: 1,
  d20: 1,
  d100: 1.15,
};
const SCREEN_UP = new Vector3(0, 0, -1);

function key(point: Vector3): string {
  return `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.z.toFixed(4)}`;
}

function uniqueVertices(faces: Vector3[][]): Vector3[] {
  const seen = new Map<string, Vector3>();
  for (const point of faces.flat()) {
    seen.set(key(point), point);
  }
  return [...seen.values()];
}

function makeFace(raw: Vector3[], upTowardsEdge: boolean): DieFace {
  const center = raw.reduce((sum, point) => sum.add(point), new Vector3()).divideScalar(raw.length);
  const normal = new Vector3()
    .subVectors(raw[1], raw[0])
    .cross(new Vector3().subVectors(raw[2], raw[0]))
    .normalize();
  let points = raw;
  if (normal.dot(center) < 0) {
    points = [raw[0], ...raw.slice(1).reverse()];
    normal.negate();
  }
  const anchor = upTowardsEdge
    ? new Vector3().addVectors(points[0], points[1]).multiplyScalar(0.5)
    : points[0];
  const toApex = new Vector3().subVectors(anchor, center);
  const up = toApex.sub(normal.clone().multiplyScalar(toApex.dot(normal))).normalize();
  return { points, center, normal, up };
}

function triangles(geometry: BufferGeometry): Vector3[][] {
  const position = geometry.getAttribute('position');
  const faces: Vector3[][] = [];
  for (let index = 0; index < position.count; index += 3) {
    faces.push(
      [0, 1, 2].map((offset) => new Vector3().fromBufferAttribute(position, index + offset)),
    );
  }
  geometry.dispose();
  return faces;
}

function cube(): Vector3[][] {
  const s = 1 / Math.sqrt(3);
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const faces: Vector3[][] = [];
  for (const axis of [0, 1, 2]) {
    for (const sign of [-1, 1]) {
      faces.push(
        corners.map(([a, b]) => {
          const coords = [0, 0, 0];
          coords[axis] = sign * s;
          coords[(axis + 1) % 3] = a * s;
          coords[(axis + 2) % 3] = b * s;
          return new Vector3(coords[0], coords[1], coords[2]);
        }),
      );
    }
  }
  return faces;
}

function trapezohedron(): Vector3[][] {
  const ring = 0.1;
  const cos36 = Math.cos(Math.PI / 5);
  const apex = (ring * (1 + cos36)) / (1 - cos36);
  const upper = (k: number) => {
    const angle = (2 * Math.PI * k) / 5;
    return new Vector3(Math.cos(angle), ring, Math.sin(angle));
  };
  const lower = (k: number) => {
    const angle = (2 * Math.PI * k) / 5 + Math.PI / 5;
    return new Vector3(Math.cos(angle), -ring, Math.sin(angle));
  };
  const top = new Vector3(0, apex, 0);
  const bottom = new Vector3(0, -apex, 0);
  const faces: Vector3[][] = [];
  for (let k = 0; k < 5; k++) {
    faces.push([top, upper(k), lower(k), upper(k + 1)]);
    faces.push([bottom, lower(k), upper(k + 1), lower(k + 1)]);
  }
  return faces;
}

function dodecahedron(): Vector3[][] {
  const icosa = triangles(new IcosahedronGeometry(1, 0));
  return uniqueVertices(icosa).map((vertex) => {
    const axis = vertex.clone().normalize();
    const reference = Math.abs(axis.y) < 0.9 ? WORLD_UP : new Vector3(1, 0, 0);
    const u = new Vector3().crossVectors(reference, axis).normalize();
    const w = new Vector3().crossVectors(axis, u);
    return icosa
      .filter((face) => face.some((point) => key(point) === key(vertex)))
      .map((face) => face.reduce((sum, point) => sum.add(point), new Vector3()).divideScalar(3))
      .sort((a, b) => Math.atan2(a.dot(w), a.dot(u)) - Math.atan2(b.dot(w), b.dot(u)));
  });
}

const SPHERE_FACES = 100;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function sphere(count: number): Vector3[][] {
  const centers = Array.from({ length: count }, (_, index) => {
    const y = 1 - (2 * (index + 0.5)) / count;
    const ring = Math.sqrt(1 - y * y);
    const angle = GOLDEN_ANGLE * index;
    return new Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring);
  });
  const corners = new Map<Vector3, Vector3[]>(centers.map((center) => [center, []]));
  for (const face of new ConvexHull().setFromPoints(centers).faces) {
    const corner = face.normal.clone().divideScalar(face.constant);
    let edge = face.edge;
    do {
      corners.get(edge.head().point)?.push(corner);
      edge = edge.next;
    } while (edge !== face.edge);
  }
  return centers.map((center) => {
    const reference = Math.abs(center.y) < 0.9 ? WORLD_UP : new Vector3(1, 0, 0);
    const u = new Vector3().crossVectors(reference, center).normalize();
    const w = new Vector3().crossVectors(center, u);
    const seen = new Map<string, Vector3>();
    for (const point of corners.get(center) ?? []) {
      seen.set(key(point), point);
    }
    return [...seen.values()].sort(
      (a, b) => Math.atan2(a.dot(w), a.dot(u)) - Math.atan2(b.dot(w), b.dot(u)),
    );
  });
}

function rawFaces(shape: DieShape): Vector3[][] {
  switch (shape) {
    case 'd4':
      return triangles(new TetrahedronGeometry(1, 0));
    case 'd6':
      return cube();
    case 'd8':
      return triangles(new OctahedronGeometry(1, 0));
    case 'd10':
      return trapezohedron();
    case 'd12':
      return dodecahedron();
    case 'd20':
      return triangles(new IcosahedronGeometry(1, 0));
    case 'd100':
      return sphere(SPHERE_FACES);
  }
}

const cache = new Map<DieShape, DieModel>();

export function dieModel(shape: DieShape): DieModel {
  const cached = cache.get(shape);
  if (cached) {
    return cached;
  }

  const raw = rawFaces(shape);
  const radius = Math.max(...raw.flat().map((point) => point.length()));
  const scaled = raw.map((face) => face.map((point) => point.clone().divideScalar(radius)));
  const faces = scaled.map((face) => makeFace(face, shape === 'd6'));
  const vertices = uniqueVertices(scaled);

  const model: DieModel =
    shape === 'd4'
      ? {
          shape,
          faces,
          vertices,
          targets: vertices.map((vertex) => vertex.clone().normalize()),
          uprights: vertices.map(() => null),
        }
      : {
          shape,
          faces,
          vertices,
          targets: faces.map((face) => face.normal),
          uprights: faces.map((face) => face.up),
        };
  cache.set(shape, model);
  return model;
}

const VIEW_AXIS = new Vector3(0, 27, 5).normalize();

export function restingAxis(shape: DieShape): Vector3 {
  return shape === 'd100' ? VIEW_AXIS : WORLD_UP;
}

export function restingOrientation(model: DieModel, resultIndex: number, yaw: number): Quaternion {
  const axis = restingAxis(model.shape);
  const facing = new Quaternion().setFromUnitVectors(model.targets[resultIndex], axis);
  const upright = model.uprights[resultIndex];
  if (upright) {
    const turned = upright.clone().applyQuaternion(facing).projectOnPlane(axis);
    const screenUp = SCREEN_UP.clone().projectOnPlane(axis).normalize();
    if (turned.lengthSq() > 1e-6) {
      facing.premultiply(new Quaternion().setFromUnitVectors(turned.normalize(), screenUp));
    }
  }
  return facing.premultiply(new Quaternion().setFromAxisAngle(axis, yaw));
}

export function restingHeight(model: DieModel, orientation: Quaternion): number {
  const lowest = Math.min(
    ...model.vertices.map((vertex) => vertex.clone().applyQuaternion(orientation).y),
  );
  return -lowest * DIE_SCALE[model.shape];
}
