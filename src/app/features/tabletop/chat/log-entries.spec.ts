import type { ChatMessage, TableMember } from '../realtime/table.protocol';
import { buildLogEntries, dayLabel, initialsOf, type LogContext } from './log-entries';

const members: TableMember[] = [
  { id: 'mestre', displayName: 'Mestre', role: 'master' },
  { id: 'ana', displayName: 'Ana Clara', role: 'player' },
];

const context: LogContext = {
  myId: 'ana',
  memberOf: (id) => members.find((member) => member.id === id),
  privacyOf: (message) => (message.visibility === 'whisper' ? 'Sussurro' : null),
  now: new Date(2026, 10, 10, 21, 0),
};

function message(
  id: string,
  authorId: string | null,
  at: Date,
  visibility: ChatMessage['visibility'] = 'public',
): ChatMessage {
  return {
    id,
    authorId,
    kind: 'text',
    text: id,
    roll: null,
    visibility,
    recipientId: visibility === 'whisper' ? 'mestre' : null,
    createdAt: at.toISOString(),
  };
}

describe('initialsOf', () => {
  it('takes the first letters of up to two words', () => {
    expect(initialsOf('Ana Clara')).toBe('AC');
    expect(initialsOf('mestre')).toBe('ME');
    expect(initialsOf('  ')).toBe('?');
  });
});

describe('dayLabel', () => {
  it('says today, yesterday or the date', () => {
    expect(dayLabel(new Date(2026, 10, 10, 8), context.now)).toBe('Hoje');
    expect(dayLabel(new Date(2026, 10, 9, 23), context.now)).toBe('Ontem');
    expect(dayLabel(new Date(2026, 10, 2, 12), context.now)).toBe('2 de novembro');
  });
});

describe('buildLogEntries', () => {
  it('groups consecutive messages from the same person', () => {
    const entries = buildLogEntries(
      [
        message('a', 'mestre', new Date(2026, 10, 10, 20, 0)),
        message('b', 'mestre', new Date(2026, 10, 10, 20, 1)),
        message('c', 'ana', new Date(2026, 10, 10, 20, 2)),
        message('d', 'ana', new Date(2026, 10, 10, 20, 9)),
      ],
      context,
    );

    expect(entries.map((entry) => entry.first)).toEqual([true, false, true, true]);
    expect(entries.map((entry) => entry.mine)).toEqual([false, false, true, true]);
    expect(entries[0]).toMatchObject({ initials: 'ME', master: true });
  });

  it('starts a new group when the privacy changes', () => {
    const entries = buildLogEntries(
      [
        message('a', 'ana', new Date(2026, 10, 10, 20, 0)),
        message('b', 'ana', new Date(2026, 10, 10, 20, 0), 'whisper'),
      ],
      context,
    );

    expect(entries.map((entry) => entry.first)).toEqual([true, true]);
  });

  it('adds a day separator only when the day changes', () => {
    const entries = buildLogEntries(
      [
        message('a', 'mestre', new Date(2026, 10, 9, 23, 59)),
        message('b', 'mestre', new Date(2026, 10, 10, 0, 1)),
        message('c', 'mestre', new Date(2026, 10, 10, 0, 2)),
      ],
      context,
    );

    expect(entries.map((entry) => entry.day)).toEqual(['Ontem', 'Hoje', null]);
    expect(entries[1].first).toBe(true);
  });

  it('names a deleted account', () => {
    const [entry] = buildLogEntries([message('a', null, new Date(2026, 10, 10))], context);
    expect(entry).toMatchObject({ author: 'Conta removida', mine: false });
  });
});
