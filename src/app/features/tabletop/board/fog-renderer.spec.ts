import { LightFog } from './fog-renderer';

const lit = { enabled: true, radius: 6 };
const off = { enabled: false, radius: 6 };

describe('LightFog', () => {
  it('shows the fog at once when the table first loads', () => {
    const fog = new LightFog();

    const changing = fog.step(lit, 16, true, false);

    expect(changing).toBe(false);
    expect(fog.visible).toBe(true);
    expect(fog.drifting).toBe(true);
  });

  it('fades the fog in and out when the master toggles it', () => {
    const fog = new LightFog();
    fog.step(off, 16, true, false);

    expect(fog.step(lit, 100, false, false)).toBe(true);
    expect(fog.visible).toBe(true);
    for (let frame = 0; frame < 10; frame++) {
      fog.step(lit, 100, false, false);
    }
    expect(fog.step(lit, 16, false, false)).toBe(false);

    expect(fog.step(off, 100, false, false)).toBe(true);
    for (let frame = 0; frame < 10; frame++) {
      fog.step(off, 100, false, false);
    }
    expect(fog.visible).toBe(false);
    expect(fog.drifting).toBe(false);
  });

  it('eases the light reach towards a new radius', () => {
    const fog = new LightFog();
    fog.step(lit, 16, true, false);

    expect(fog.step({ enabled: true, radius: 12 }, 16, false, false)).toBe(true);
    for (let frame = 0; frame < 40; frame++) {
      fog.step({ enabled: true, radius: 12 }, 100, false, false);
    }
    expect(fog.step({ enabled: true, radius: 12 }, 16, false, false)).toBe(false);
  });

  it('skips every animation when the system asks for less motion', () => {
    const fog = new LightFog();
    fog.step(off, 16, true, true);

    expect(fog.step(lit, 16, false, true)).toBe(false);
    expect(fog.visible).toBe(true);
    expect(fog.drifting).toBe(false);
  });
});
