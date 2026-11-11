import { Cooldown } from './cooldown';

describe('Cooldown', () => {
  let clock: number;
  let cooldown: Cooldown;

  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
    cooldown = new Cooldown({ capacity: 3, refillMs: 2_000 }, () => clock);
  });

  afterEach(() => {
    cooldown.dispose();
    vi.useRealTimers();
  });

  const advance = (ms: number) => {
    clock += ms;
    vi.advanceTimersByTime(ms);
  };

  it('lets a short burst through without waiting', () => {
    expect(cooldown.tryTake()).toBe(true);
    expect(cooldown.tryTake()).toBe(true);
    expect(cooldown.waiting()).toBe(false);
  });

  it('counts down after the burst and opens again when a slot refills', () => {
    cooldown.tryTake();
    cooldown.tryTake();
    cooldown.tryTake();

    expect(cooldown.waiting()).toBe(true);
    expect(cooldown.seconds()).toBe(2);
    expect(cooldown.period().ms).toBe(2_000);
    expect(cooldown.tryTake()).toBe(false);

    advance(1_200);
    expect(cooldown.seconds()).toBe(1);

    advance(800);
    expect(cooldown.waiting()).toBe(false);
    expect(cooldown.tryTake()).toBe(true);
    expect(cooldown.seconds()).toBe(2);
  });

  it('waits as long as the server asks, even with slots left here', () => {
    cooldown.hold(1_500);

    expect(cooldown.waiting()).toBe(true);
    expect(cooldown.tryTake()).toBe(false);

    advance(1_500);
    expect(cooldown.waiting()).toBe(false);
    expect(cooldown.tryTake()).toBe(true);
  });

  it('restarts the progress bar for every new wait', () => {
    cooldown.hold(1_000);
    const first = cooldown.period().cycle;
    advance(1_000);
    cooldown.hold(1_000);

    expect(cooldown.period().cycle).toBe(first + 1);
  });
});
