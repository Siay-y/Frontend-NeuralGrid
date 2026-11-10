import { Vector3 } from 'three';
import type { DieShape } from './dice-rules';
import { dieModel, restingHeight, restingOrientation, WORLD_UP } from './dice-geometry';

const FACE_COUNTS: Record<DieShape, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
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
  });
});

describe('restingOrientation', () => {
  it.each(SHAPES)('turns every %s result to face up', (shape) => {
    const model = dieModel(shape);
    model.targets.forEach((target, index) => {
      const turned = target.clone().applyQuaternion(restingOrientation(model, index, 0.7));
      expect(turned.angleTo(WORLD_UP)).toBeLessThan(1e-6);
    });
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
