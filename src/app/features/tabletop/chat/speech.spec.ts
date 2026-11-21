import type { ChatMessage, TableToken } from '../realtime/table.protocol';
import { SPEECH_MAX_MS, SPEECH_MIN_MS, speakerToken, speechDuration, speechOf } from './speech';

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  authorId: 'u1',
  kind: 'text',
  text: ' Olá ',
  roll: null,
  visibility: 'public',
  recipientId: null,
  createdAt: '2026-11-21T12:00:00.000Z',
  ...overrides,
});

const token = (id: string, ownerId: string | null): TableToken => ({
  id,
  label: id,
  kind: 'agent',
  icon: null,
  sex: null,
  hidden: false,
  nameHidden: false,
  emitsLight: true,
  ownerId,
  sheetId: null,
  col: 0,
  row: 0,
  size: 1,
  version: 1,
});

describe('speechOf', () => {
  it('turns a public text into a speech', () => {
    expect(speechOf(message())).toEqual({ id: 'm1', authorId: 'u1', text: 'Olá' });
  });

  it('ignores rolls, private messages and messages without an author', () => {
    expect(speechOf(message({ kind: 'roll', text: null }))).toBeNull();
    expect(speechOf(message({ visibility: 'gm' }))).toBeNull();
    expect(speechOf(message({ visibility: 'whisper', recipientId: 'u2' }))).toBeNull();
    expect(speechOf(message({ authorId: null }))).toBeNull();
  });
});

describe('speechDuration', () => {
  it('grows with the text, within bounds', () => {
    expect(speechDuration('Oi')).toBe(SPEECH_MIN_MS);
    expect(speechDuration('a'.repeat(100))).toBe(6_000);
    expect(speechDuration('a'.repeat(500))).toBe(SPEECH_MAX_MS);
  });
});

describe('speakerToken', () => {
  it('picks the first token the author added', () => {
    const tokens = [token('Lich', null), token('Kael', 'u1'), token('Mira', 'u1')];
    expect(speakerToken(tokens, 'u1')?.id).toBe('Kael');
    expect(speakerToken(tokens, 'u2')).toBeUndefined();
  });
});
