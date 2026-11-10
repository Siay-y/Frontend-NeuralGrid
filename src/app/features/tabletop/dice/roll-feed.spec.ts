import { TestBed } from '@angular/core/testing';
import type { ChatMessage } from '../realtime/table.protocol';
import { PREVIEW_DURATION_MS, REVEAL_FALLBACK_MS, RollFeed } from './roll-feed';

const rollMessage = (id: string): ChatMessage => ({
  id,
  authorId: 'ana',
  kind: 'roll',
  text: null,
  roll: { label: null, notation: '1d20', total: 12, terms: [] },
  visibility: 'public',
  recipientId: null,
  createdAt: '2026-11-10T20:00:00.000Z',
});

describe('RollFeed', () => {
  let feed: RollFeed;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [RollFeed] });
    feed = TestBed.inject(RollFeed);
  });

  afterEach(() => vi.useRealTimers());

  it('keeps at most three previews, dropping the oldest', () => {
    ['a', 'b', 'c', 'd'].forEach((id) => feed.show(rollMessage(id)));

    expect(feed.previews().map((message) => message.id)).toEqual(['b', 'c', 'd']);
  });

  it('ignores the same roll twice', () => {
    feed.show(rollMessage('a'));
    feed.show(rollMessage('a'));

    expect(feed.previews()).toHaveLength(1);
  });

  it('dismisses each preview on its own timer', () => {
    feed.show(rollMessage('first'));
    vi.advanceTimersByTime(1_000);
    feed.show(rollMessage('second'));

    vi.advanceTimersByTime(PREVIEW_DURATION_MS - 1_000);
    expect(feed.previews().map((message) => message.id)).toEqual(['second']);

    vi.advanceTimersByTime(1_000);
    expect(feed.previews()).toHaveLength(0);
  });

  it('ignores chat messages that are not rolls', () => {
    feed.show({ ...rollMessage('text'), kind: 'text', text: 'oi', roll: null });
    expect(feed.previews()).toHaveLength(0);
  });

  it('hands throws out in order', () => {
    feed.throwDice(rollMessage('first'));
    feed.throwDice(rollMessage('second'));

    expect(feed.takeThrow()?.id).toBe('first');
    expect(feed.takeThrow()?.id).toBe('second');
    expect(feed.takeThrow()).toBeUndefined();
  });

  it('keeps a roll hidden from the history until its dice stop', () => {
    feed.show(rollMessage('a'));
    expect(feed.hidden().has('a')).toBe(true);

    feed.reveal('a');
    expect(feed.hidden().has('a')).toBe(false);
  });

  it('reveals on its own if the card never reports back', () => {
    feed.show(rollMessage('a'));
    vi.advanceTimersByTime(REVEAL_FALLBACK_MS);
    expect(feed.hidden().size).toBe(0);
  });

  it('reveals a roll whose card was closed or pushed out', () => {
    ['a', 'b', 'c', 'd'].forEach((id) => feed.show(rollMessage(id)));
    feed.dismiss('d');

    expect([...feed.hidden()].sort()).toEqual(['b', 'c']);
  });
});
