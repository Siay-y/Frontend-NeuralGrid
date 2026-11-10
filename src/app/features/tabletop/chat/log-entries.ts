import type { ChatMessage, TableMember } from '../realtime/table.protocol';

export interface LogEntry {
  message: ChatMessage;
  author: string;
  initials: string;
  master: boolean;
  mine: boolean;
  privacy: string | null;
  time: string;
  first: boolean;
  day: string | null;
}

export interface LogContext {
  myId: string | null;
  memberOf: (id: string | null) => TableMember | undefined;
  privacyOf: (message: ChatMessage) => string | null;
  now: Date;
}

export const GROUP_WINDOW_MS = 3 * 60_000;

const TIME = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const DATE = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.toUpperCase();
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function dayLabel(date: Date, now: Date): string {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(date) === dayKey(now)) {
    return 'Hoje';
  }
  if (dayKey(date) === dayKey(yesterday)) {
    return 'Ontem';
  }
  return DATE.format(date);
}

export function buildLogEntries(messages: readonly ChatMessage[], context: LogContext): LogEntry[] {
  let previous: { message: ChatMessage; at: Date; privacy: string | null } | null = null;

  return messages.map((message) => {
    const at = new Date(message.createdAt);
    const member = context.memberOf(message.authorId);
    const author = member?.displayName ?? 'Conta removida';
    const privacy = context.privacyOf(message);
    const newDay = !previous || dayKey(previous.at) !== dayKey(at);
    const first =
      newDay ||
      !previous ||
      previous.message.authorId !== message.authorId ||
      previous.privacy !== privacy ||
      at.getTime() - previous.at.getTime() > GROUP_WINDOW_MS;

    previous = { message, at, privacy };
    return {
      message,
      author,
      initials: initialsOf(author),
      master: member?.role === 'master',
      mine: message.authorId !== null && message.authorId === context.myId,
      privacy,
      time: TIME.format(at),
      first,
      day: newDay ? dayLabel(at, context.now) : null,
    };
  });
}
