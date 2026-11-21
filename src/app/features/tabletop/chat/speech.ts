import type { ChatMessage, TableToken } from '../realtime/table.protocol';

export interface TableSpeech {
  id: string;
  authorId: string;
  text: string;
}

export const SPEECH_MIN_MS = 4_000;
export const SPEECH_MAX_MS = 10_000;
const SPEECH_MS_PER_CHAR = 60;

export function speechOf(message: ChatMessage): TableSpeech | null {
  const { id, authorId, text } = message;
  if (message.kind !== 'text' || message.visibility !== 'public' || !authorId || !text?.trim()) {
    return null;
  }
  return { id, authorId, text: text.trim() };
}

export function speechDuration(text: string): number {
  return Math.min(SPEECH_MAX_MS, Math.max(SPEECH_MIN_MS, text.length * SPEECH_MS_PER_CHAR));
}

export function speakerToken(
  tokens: readonly TableToken[],
  authorId: string,
): TableToken | undefined {
  return tokens.find(({ ownerId }) => ownerId === authorId);
}
