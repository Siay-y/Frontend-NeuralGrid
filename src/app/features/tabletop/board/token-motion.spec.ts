import { TokenMotion } from './token-motion';

describe('TokenMotion', () => {
  it('places new tokens directly at their target', () => {
    const motion = new TokenMotion();

    const moving = motion.step(new Map([['a', { x: 3, y: 4 }]]), 16);

    expect(moving).toBe(false);
    expect(motion.position('a')).toEqual({ x: 3, y: 4 });
  });

  it('eases towards a new target and settles', () => {
    const motion = new TokenMotion();
    motion.step(new Map([['a', { x: 0, y: 0 }]]), 16);

    expect(motion.step(new Map([['a', { x: 10, y: 0 }]]), 16)).toBe(true);
    const halfway = motion.position('a')!.x;
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(10);

    for (let frame = 0; frame < 120; frame++) {
      motion.step(new Map([['a', { x: 10, y: 0 }]]), 16);
    }
    expect(motion.position('a')).toEqual({ x: 10, y: 0 });
  });

  it('forgets tokens that left the table', () => {
    const motion = new TokenMotion();
    motion.step(new Map([['a', { x: 0, y: 0 }]]), 16);

    motion.step(new Map(), 16);

    expect(motion.position('a')).toBeUndefined();
  });
});
