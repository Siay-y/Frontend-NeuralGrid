import type { SessionUser } from '../../../core/auth/auth.models';
import type { ChatMessage, MessageAudience, TableMember } from '../realtime/table.protocol';

export interface AudienceOption {
  value: string;
  label: string;
}

const WHISPER_PREFIX = 'whisper:';

export const PUBLIC_AUDIENCE = 'public';

export function audienceOptions(
  me: SessionUser | null,
  members: readonly TableMember[],
): AudienceOption[] {
  const options: AudienceOption[] = [
    { value: PUBLIC_AUDIENCE, label: 'Toda a mesa' },
    { value: 'gm', label: me?.role === 'master' ? 'Só eu (oculta)' : 'Só o mestre' },
  ];
  for (const member of members) {
    if (member.id !== me?.id) {
      options.push({
        value: `${WHISPER_PREFIX}${member.id}`,
        label: `Sussurro para ${member.displayName}`,
      });
    }
  }
  return options;
}

export function toAudience(value: string): MessageAudience {
  if (value.startsWith(WHISPER_PREFIX)) {
    return { visibility: 'whisper', recipientId: value.slice(WHISPER_PREFIX.length) };
  }
  return { visibility: value === 'gm' ? 'gm' : 'public', recipientId: null };
}

export function describePrivacy(
  message: ChatMessage,
  myId: string | null,
  memberOf: (id: string | null) => TableMember | undefined,
): string | null {
  if (message.visibility === 'public') {
    return null;
  }
  if (message.visibility === 'gm') {
    return memberOf(message.authorId)?.role === 'master' ? 'Oculta' : 'Para o mestre';
  }
  if (message.authorId === myId) {
    const recipient = memberOf(message.recipientId)?.displayName;
    return recipient ? `Sussurro para ${recipient}` : 'Sussurro';
  }
  return 'Sussurro para você';
}
