import { CINEMATIC_GAP_MS, CinematicQueue } from './cinematic-queue';

describe('CinematicQueue', () => {
  let log: string[];
  let queue: CinematicQueue;
  const scene = (name: string, duration: number) => ({
    duration,
    show: () => log.push(`show ${name}`),
    hide: () => log.push(`hide ${name}`),
  });

  beforeEach(() => {
    vi.useFakeTimers();
    log = [];
    queue = new CinematicQueue();
  });

  afterEach(() => {
    queue.ngOnDestroy();
    vi.useRealTimers();
  });

  it('plays one band at a time, waiting for the last one to leave', () => {
    queue.play(scene('combat', 1_000));
    queue.play(scene('death', 2_000));
    expect(log).toEqual(['show combat']);

    vi.advanceTimersByTime(1_000);
    expect(log).toEqual(['show combat', 'hide combat']);

    vi.advanceTimersByTime(CINEMATIC_GAP_MS);
    expect(log).toEqual(['show combat', 'hide combat', 'show death']);
  });

  it('skips the current band and moves on after the gap', () => {
    queue.play(scene('combat', 5_000));
    queue.play(scene('death', 2_000));

    queue.skip();
    vi.advanceTimersByTime(CINEMATIC_GAP_MS);

    expect(log).toEqual(['show combat', 'hide combat', 'show death']);
  });

  it('waits for the gap before a band that arrives right after another ends', () => {
    queue.play(scene('combat', 1_000));
    vi.advanceTimersByTime(1_000);
    queue.play(scene('death', 2_000));
    expect(log).toEqual(['show combat', 'hide combat']);

    vi.advanceTimersByTime(CINEMATIC_GAP_MS);
    expect(log.at(-1)).toBe('show death');
  });
});
