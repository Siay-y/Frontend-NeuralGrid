import type { SessionUser, UserRole } from '../../../core/auth/auth.models';

export const TABLE_NAMESPACE = 'table';
export const HANDSHAKE_UNAUTHORIZED = 'UNAUTHORIZED';

export const TableClientEvent = {
  CreateToken: 'token:create',
  UpdateToken: 'token:update',
  MoveToken: 'token:move',
  DragToken: 'token:drag',
  DeleteToken: 'token:delete',
  SendMessage: 'chat:send',
  RollDice: 'dice:roll',
  ClearChat: 'chat:clear',
} as const;

export const TableServerEvent = {
  Snapshot: 'table:snapshot',
  TokenCreated: 'token:created',
  TokenUpdated: 'token:updated',
  TokenDeleted: 'token:deleted',
  TokenDragged: 'token:dragged',
  PresenceChanged: 'presence:changed',
  MessageCreated: 'chat:message',
  ChatCleared: 'chat:cleared',
  SessionExpired: 'session:expired',
} as const;

export type TokenKind = 'agent' | 'npc' | 'threat';

export const TOKEN_KIND_LABEL: Record<TokenKind, string> = {
  agent: 'Agente',
  npc: 'NPC',
  threat: 'Ameaça',
};

export const TOKEN_LABEL_MAX_LENGTH = 32;
export const TOKEN_SIZES = [1, 2, 3, 4] as const;

export interface TableToken {
  id: string;
  label: string;
  kind: TokenKind;
  ownerId: string | null;
  col: number;
  row: number;
  size: number;
  version: number;
}

export interface TableMember {
  id: string;
  displayName: string;
  role: UserRole;
}

export interface TableSnapshot {
  you: SessionUser;
  tokens: TableToken[];
  members: TableMember[];
  online: string[];
  messages: ChatMessage[];
}

export interface TokenPreview {
  id: string;
  by: string;
  col: number;
  row: number;
}

export interface TokenDraft {
  label: string;
  kind: TokenKind;
  ownerId: string | null;
  size: number;
}

export type MessageVisibility = 'public' | 'gm' | 'whisper';

export interface MessageAudience {
  visibility: MessageVisibility;
  recipientId: string | null;
}

export interface RolledDie {
  value: number;
  kept: boolean;
}

export interface DiceTermResult {
  kind: 'dice';
  sign: 1 | -1;
  count: number;
  sides: number;
  keep: { mode: 'highest' | 'lowest'; count: number } | null;
  rolls: RolledDie[];
  subtotal: number;
}

export interface FlatTermResult {
  kind: 'flat';
  sign: 1 | -1;
  value: number;
  subtotal: number;
}

export type RollTerm = DiceTermResult | FlatTermResult;

export interface RollResult {
  label: string | null;
  notation: string;
  terms: RollTerm[];
  total: number;
}

export interface ChatMessage extends MessageAudience {
  id: string;
  authorId: string | null;
  kind: 'text' | 'roll';
  text: string | null;
  roll: RollResult | null;
  createdAt: string;
}

export const MESSAGE_TEXT_MAX_LENGTH = 500;
export const ROLL_LABEL_MAX_LENGTH = 48;
export const DICE_EXPRESSION_MAX_LENGTH = 64;

export type AckResult<T> =
  { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export class TableActionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
