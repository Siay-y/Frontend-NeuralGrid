import type { SessionUser, UserRole } from '../../../core/auth/auth.models';

export const TABLE_NAMESPACE = 'table';
export const HANDSHAKE_UNAUTHORIZED = 'UNAUTHORIZED';

export const TableClientEvent = {
  CreateToken: 'token:create',
  UpdateToken: 'token:update',
  MoveToken: 'token:move',
  DragToken: 'token:drag',
  DeleteToken: 'token:delete',
} as const;

export const TableServerEvent = {
  Snapshot: 'table:snapshot',
  TokenCreated: 'token:created',
  TokenUpdated: 'token:updated',
  TokenDeleted: 'token:deleted',
  TokenDragged: 'token:dragged',
  PresenceChanged: 'presence:changed',
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
