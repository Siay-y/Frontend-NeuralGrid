import type { SessionUser, UserRole } from '../../../core/auth/auth.models';
import type { CharacterSheet, SheetStats } from '../sheets/sheet-model';

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
  CreateDrawing: 'drawing:create',
  EraseDrawings: 'drawing:erase',
  ClearDrawings: 'drawing:clear',
  MoveRuler: 'ruler:move',
  ClearRuler: 'ruler:clear',
  CreateSheet: 'sheet:create',
  UpdateSheet: 'sheet:update',
  DeleteSheet: 'sheet:delete',
  RenameMap: 'map:rename',
  ActivateMap: 'map:activate',
  DeleteMap: 'map:delete',
  UpdateArea: 'area:update',
  DeleteArea: 'area:delete',
  UpdateFog: 'fog:update',
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
  DrawingCreated: 'drawing:created',
  DrawingsErased: 'drawing:erased',
  RulerMoved: 'ruler:moved',
  RulerCleared: 'ruler:cleared',
  SheetCreated: 'sheet:created',
  SheetUpdated: 'sheet:updated',
  SheetDeleted: 'sheet:deleted',
  SheetStats: 'sheet:stats',
  MapCreated: 'map:created',
  MapUpdated: 'map:updated',
  MapDeleted: 'map:deleted',
  SceneChanged: 'scene:changed',
  FogChanged: 'fog:changed',
  SessionExpired: 'session:expired',
  ConnectionLimit: 'session:limit',
} as const;

export type TokenKind = 'agent' | 'npc' | 'threat';

export const TOKEN_KIND_LABEL: Record<TokenKind, string> = {
  agent: 'Agente',
  npc: 'NPC',
  threat: 'Ameaça',
};

export type TokenSex = 'female' | 'male' | 'other';

export const TOKEN_SEX_LABEL: Record<TokenSex, string> = {
  female: 'Feminino',
  male: 'Masculino',
  other: 'Outro',
};

export const TOKEN_LABEL_MAX_LENGTH = 32;
export const TOKEN_SIZES = [1, 2, 3, 4] as const;

export interface TableToken {
  id: string;
  label: string;
  kind: TokenKind;
  icon: string | null;
  sex: TokenSex | null;
  hidden: boolean;
  nameHidden: boolean;
  ownerId: string | null;
  sheetId: string | null;
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
  drawings: TableDrawing[];
  sheets: CharacterSheet[];
  sheetStats?: SheetStats[];
  maps?: TableMap[];
  scene?: TableScene | null;
  fog?: TableFog;
}

export interface TableFog {
  enabled: boolean;
  radius: number;
}

export interface MapPlacement {
  col: number;
  row: number;
  cell: number;
}

export interface SceneArea extends MapPlacement {
  id: string;
  width: number;
  height: number;
  hidden?: boolean;
}

export interface TableScene {
  id: string;
  areas: SceneArea[];
}

export interface MapArea extends SceneArea {
  name: string;
  bytes: number;
  hidden: boolean;
}

export interface TableMap {
  id: string;
  name: string;
  active: boolean;
  areas: MapArea[];
}

export interface AreaChanges extends Partial<MapPlacement> {
  name?: string;
  hidden?: boolean;
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
  icon: string | null;
  sex: TokenSex | null;
  hidden: boolean;
  nameHidden: boolean;
  ownerId: string | null;
  size: number;
  sheetId?: string | null;
}

export type DrawingShape = 'free' | 'arrow' | 'rect' | 'ellipse';

export type DrawingColor = 'chalk' | 'rose' | 'peach' | 'butter' | 'mint' | 'sky' | 'lavender';

export const DRAWING_COLORS: readonly { id: DrawingColor; label: string }[] = [
  { id: 'chalk', label: 'Giz' },
  { id: 'rose', label: 'Rosa' },
  { id: 'peach', label: 'Pêssego' },
  { id: 'butter', label: 'Amarelo' },
  { id: 'mint', label: 'Menta' },
  { id: 'sky', label: 'Azul' },
  { id: 'lavender', label: 'Lavanda' },
];

export const DRAWING_WIDTHS = [2, 4, 8] as const;

export type DrawingWidth = (typeof DRAWING_WIDTHS)[number];

export const DRAWING_MAX_POINTS = 1000;

export interface DrawingStyle {
  shape: DrawingShape;
  color: DrawingColor;
  width: DrawingWidth;
}

export interface DrawingDraft extends DrawingStyle {
  points: number[];
}

export interface TableDrawing extends DrawingDraft {
  id: string;
  authorId: string;
}

export interface DrawingsErased {
  by: string;
  ids: string[];
}

export type DrawingClearScope = 'mine' | 'all';

export interface RulerSpan {
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
}

export interface RemoteRuler extends RulerSpan {
  by: string;
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

export interface AckError {
  code: string;
  message: string;
  retryAfterMs?: number;
}

export type AckResult<T> = { ok: true; data: T } | { ok: false; error: AckError };

export const COOLDOWN_ERROR = 'COOLDOWN';

export class TableActionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryAfterMs = 0,
  ) {
    super(message);
  }
}
