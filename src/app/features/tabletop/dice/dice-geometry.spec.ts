import { Vector3 } from 'three';
import type { DieShape } from './dice-rules';
import {
  dieModel,
  restingAxis,
  restingHeight,
  restingOrientation,
  WORLD_UP,
} from './dice-geometry';

const FACE_COUNTS: Record<DieShape, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
};

const SHAPES = Object.keys(FACE_COUNTS) as DieShape[];

describe('dieModel', () => {
  it.each(SHAPES)('builds %s with the right number of flat, outward faces', (shape) => {
    const model = dieModel(shape);

    expect(model.faces).toHaveLength(FACE_COUNTS[shape]);
    for (const face of model.faces) {
      expect(face.normal.dot(face.center)).toBeGreaterThan(0);
      for (const point of face.points) {
        expect(
          Math.abs(new Vector3().subVectors(point, face.center).dot(face.normal)),
        ).toBeLessThan(1e-6);
      }
    }
  });

  it.each(SHAPES)('fits %s inside the unit sphere', (shape) => {
    const radius = Math.max(...dieModel(shape).vertices.map((vertex) => vertex.length()));
    expect(radius).toBeCloseTo(1, 6);
  });

  it('gives one result direction per number', () => {
    expect(dieModel('d4').targets).toHaveLength(4);
    expect(dieModel('d10').targets).toHaveLength(10);
    expect(dieModel('d100').targets).toHaveLength(100);
  });
});

describe('restingOrientation', () => {
  it.each(SHAPES)('turns every %s result to face up', (shape) => {
    const model = dieModel(shape);
    model.targets.forEach((target, index) => {
      const turned = target.clone().applyQuaternion(restingOrientation(model, index, 0.7));
      expect(turned.angleTo(restingAxis(shape))).toBeLessThan(1e-6);
    });
  });

  it('faces the round d100 result towards the camera instead of straight up', () => {
    expect(restingAxis('d20')).toBe(WORLD_UP);
    expect(restingAxis('d100').y).toBeGreaterThan(0.9);
    expect(restingAxis('d100').z).toBeGreaterThan(0.1);
  });

  it('keeps the d100 number upright on screen', () => {
    const model = dieModel('d100');
    const axis = restingAxis('d100');
    const up = model.uprights[42]!.clone().applyQuaternion(restingOrientation(model, 42, 0));
    const screenUp = new Vector3(0, 0, -1).projectOnPlane(axis).normalize();
    expect(up.angleTo(screenUp)).toBeLessThan(1e-6);
  });

  it('keeps the number upright towards the top of the screen', () => {
    const model = dieModel('d20');
    const up = model.uprights[5]!.clone().applyQuaternion(restingOrientation(model, 5, 0));
    expect(up.z).toBeLessThan(-0.99);
  });

  it('rests the die on the floor', () => {
    const model = dieModel('d6');
    const height = restingHeight(model, restingOrientation(model, 0, 0));
    expect(height).toBeCloseTo(1 / Math.sqrt(3), 6);
  });
});
