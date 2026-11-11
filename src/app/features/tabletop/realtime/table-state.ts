import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { SessionUser } from '../../../core/auth/auth.models';
import { RollFeed } from '../dice/roll-feed';
import { TabletopStore } from '../tabletop.store';
import type { CharacterSheet, SheetData } from '../sheets/sheet-model';
import { CHAT_COOLDOWN, Cooldown, DICE_COOLDOWN } from './cooldown';
import { TableConnection } from './table-connection';
import {
  type ChatMessage,
  COOLDOWN_ERROR,
  type DrawingClearScope,
  type DrawingDraft,
  type DrawingsErased,
  type MessageAudience,
  type RemoteRuler,
  type RulerSpan,
  TableActionError,
  TableClientEvent,
  type TableDrawing,
  type TableMember,
  TableServerEvent,
  type TableSnapshot,
  type TableToken,
  type TokenDraft,
  type TokenKind,
  type TokenPreview,
} from './table.protocol';

export const CHAT_MEMORY_LIMIT = 200;

const CLEARED_KEY_PREFIX = 'neuralgrid.chat-cleared.';

function readClearedAt(userId: string): string | null {
  try {
    return localStorage.getItem(CLEARED_KEY_PREFIX + userId);
  } catch {
    return null;
  }
}

function writeClearedAt(userId: string, value: string): void {
  try {
    localStorage.setItem(CLEARED_KEY_PREFIX + userId, value);
  } catch {
    return;
  }
}

function withEntry<K, V>(map: ReadonlyMap<K, V>, key: K, value: V): Map<K, V> {
  const next = new Map(map);
  next.set(key, value);
  return next;
}

function withoutEntry<K, V>(map: ReadonlyMap<K, V>, key: K): ReadonlyMap<K, V> {
  if (!map.has(key)) {
    return map;
  }
  const next = new Map(map);
  next.delete(key);
  return next;
}

function restoreDrawings(
  before: ReadonlyMap<string, TableDrawing>,
  current: ReadonlyMap<string, TableDrawing>,
  restored: readonly string[],
): Map<string, TableDrawing> {
  const next = new Map<string, TableDrawing>();
  for (const [id, drawing] of before) {
    if (current.has(id) || restored.includes(id)) {
      next.set(id, current.get(id) ?? drawing);
    }
  }
  for (const [id, drawing] of current) {
    next.set(id, drawing);
  }
  return next;
}

@Injectable()
export class TableState {
  private readonly connection = inject(TableConnection);
  private readonly store = inject(TabletopStore);
  private readonly feed = inject(RollFeed);

  private readonly tokensById = signal<ReadonlyMap<string, TableToken>>(new Map());
  private readonly previewsById = signal<ReadonlyMap<string, TokenPreview>>(new Map());
  private readonly memberList = signal<readonly TableMember[]>([]);
  private readonly online = signal<ReadonlySet<string>>(new Set());
  private readonly self = signal<SessionUser | null>(null);
  private readonly synced = signal(false);
  private readonly messageList = signal<readonly ChatMessage[]>([]);
  private readonly unreadCount = signal(0);
  private readonly clearedAt = signal<string | null>(null);
  private readonly drawingsById = signal<ReadonlyMap<string, TableDrawing>>(new Map());
  private readonly rulersBy = signal<ReadonlyMap<string, RemoteRuler>>(new Map());
  private readonly sheetsById = signal<ReadonlyMap<string, CharacterSheet>>(new Map());

  readonly tokens = computed(() => [...this.tokensById().values()]);
  readonly previews = this.previewsById.asReadonly();
  readonly members = this.memberList.asReadonly();
  readonly onlineIds = this.online.asReadonly();
  readonly me = this.self.asReadonly();
  readonly ready = this.synced.asReadonly();
  readonly status = this.connection.status;
  readonly isMaster = computed(() => this.self()?.role === 'master');
  readonly messages = computed(() => {
    const clearedAt = this.clearedAt();
    const list = this.messageList();
    return clearedAt ? list.filter((message) => message.createdAt > clearedAt) : list;
  });
  readonly unread = this.unreadCount.asReadonly();
  readonly chatCooldown = new Cooldown(CHAT_COOLDOWN);
  readonly diceCooldown = new Cooldown(DICE_COOLDOWN);
  readonly drawings = computed(() => [...this.drawingsById().values()]);
  readonly rulers = computed(() => [...this.rulersBy().values()]);
  readonly sheets = computed(() =>
    [...this.sheetsById().values()].sort((a, b) =>
      a.data.identity.name.localeCompare(b.data.identity.name, 'pt-BR'),
    ),
  );
  readonly ownSheetCount = computed(() => {
    const me = this.self();
    return me ? this.sheets().filter((sheet) => sheet.ownerId === me.id).length : 0;
  });
  readonly hasOwnDrawings = computed(() => {
    const me = this.self();
    return !!me && this.drawings().some((drawing) => drawing.authorId === me.id);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.chatCooldown.dispose();
      this.diceCooldown.dispose();
    });
  }

  start(): void {
    this.connection.connect({
      [TableServerEvent.Snapshot]: (snapshot: TableSnapshot) => this.applySnapshot(snapshot),
      [TableServerEvent.TokenCreated]: (token: TableToken) => this.upsert(token),
      [TableServerEvent.TokenUpdated]: (token: TableToken) => this.upsert(token),
      [TableServerEvent.TokenDeleted]: ({ id }: { id: string }) => this.remove(id),
      [TableServerEvent.TokenDragged]: (preview: TokenPreview) => this.applyPreview(preview),
      [TableServerEvent.PresenceChanged]: ({ online }: { online: string[] }) =>
        this.applyPresence(online),
      [TableServerEvent.MessageCreated]: (message: ChatMessage) => this.receive(message),
      [TableServerEvent.ChatCleared]: ({ by }: { by: string }) => this.applyChatCleared(by),
      [TableServerEvent.DrawingCreated]: (drawing: TableDrawing) => this.addDrawing(drawing),
      [TableServerEvent.DrawingsErased]: ({ ids }: DrawingsErased) => this.dropDrawings(ids),
      [TableServerEvent.RulerMoved]: (ruler: RemoteRuler) =>
        this.rulersBy.update((rulers) => withEntry(rulers, ruler.by, ruler)),
      [TableServerEvent.RulerCleared]: ({ by }: { by: string }) =>
        this.rulersBy.update((rulers) => withoutEntry(rulers, by)),
      [TableServerEvent.SheetCreated]: (sheet: CharacterSheet) => this.upsertSheet(sheet),
      [TableServerEvent.SheetUpdated]: (sheet: CharacterSheet) => this.upsertSheet(sheet),
      [TableServerEvent.SheetDeleted]: ({ id }: { id: string }) => this.removeSheet(id),
    });
  }

  token(id: string): TableToken | undefined {
    return this.tokensById().get(id);
  }

  member(id: string | null): TableMember | undefined {
    return id ? this.memberList().find((member) => member.id === id) : undefined;
  }

  canMove(token: TableToken): boolean {
    const me = this.self();
    return !!me && (me.role === 'master' || token.ownerId === me.id);
  }

  sheet(id: string | null): CharacterSheet | undefined {
    return id ? this.sheetsById().get(id) : undefined;
  }

  async createSheet(
    data: SheetData,
    assignment: { kind?: TokenKind; ownerId?: string | null } = {},
  ): Promise<CharacterSheet | null> {
    return this.attempt(async () => {
      const sheet = await this.connection.request<CharacterSheet>(TableClientEvent.CreateSheet, {
        ...assignment,
        data,
      });
      this.upsertSheet(sheet);
      return sheet;
    });
  }

  async updateSheet(
    id: string,
    changes: { data?: Partial<SheetData>; kind?: TokenKind; ownerId?: string | null },
  ): Promise<CharacterSheet | null> {
    const before = this.sheetsById().get(id);
    if (!before) {
      return null;
    }
    this.sheetsById.update((sheets) =>
      withEntry(sheets, id, {
        ...before,
        kind: changes.kind ?? before.kind,
        ownerId: changes.ownerId === undefined ? before.ownerId : changes.ownerId,
        data: { ...before.data, ...changes.data },
      }),
    );
    try {
      const saved = await this.connection.request<CharacterSheet>(TableClientEvent.UpdateSheet, {
        id,
        ...changes,
      });
      this.upsertSheet(saved);
      return saved;
    } catch (error) {
      const current = this.sheetsById().get(id);
      if (current && current.version === before.version) {
        this.sheetsById.update((sheets) => withEntry(sheets, id, before));
      }
      this.report(error);
      return null;
    }
  }

  async deleteSheet(id: string): Promise<boolean> {
    const removed = await this.attempt(async () => {
      await this.connection.request(TableClientEvent.DeleteSheet, { id });
      this.removeSheet(id);
      return true;
    });
    return removed ?? false;
  }

  isMasked(token: TableToken): boolean {
    return token.nameHidden && !this.isMaster();
  }

  canErase(drawing: TableDrawing): boolean {
    const me = this.self();
    return !!me && (me.role === 'master' || drawing.authorId === me.id);
  }

  async createDrawing(draft: DrawingDraft): Promise<TableDrawing | null> {
    return this.attempt(async () => {
      const drawing = await this.connection.request<TableDrawing>(
        TableClientEvent.CreateDrawing,
        draft,
      );
      this.addDrawing(drawing);
      return drawing;
    });
  }

  async eraseDrawings(ids: readonly string[]): Promise<boolean> {
    const before = this.drawingsById();
    const known = ids.filter((id) => before.has(id));
    if (known.length === 0) {
      return false;
    }
    this.dropDrawings(known);
    try {
      await this.connection.request<DrawingsErased>(TableClientEvent.EraseDrawings, {
        ids: known,
      });
      return true;
    } catch (error) {
      this.drawingsById.update((current) => restoreDrawings(before, current, known));
      this.report(error);
      return false;
    }
  }

  async undoDrawing(): Promise<boolean> {
    const me = this.self();
    const last = me
      ? [...this.drawings()].reverse().find((drawing) => drawing.authorId === me.id)
      : undefined;
    return last ? this.eraseDrawings([last.id]) : false;
  }

  async clearDrawings(scope: DrawingClearScope): Promise<boolean> {
    const cleared = await this.attempt(async () => {
      const erased = await this.connection.request<DrawingsErased>(TableClientEvent.ClearDrawings, {
        scope,
      });
      this.dropDrawings(erased.ids);
      return true;
    });
    return cleared ?? false;
  }

  moveRuler(span: RulerSpan): void {
    this.connection.notify(TableClientEvent.MoveRuler, span);
  }

  clearRuler(): void {
    this.connection.notify(TableClientEvent.ClearRuler, {});
  }

  async createToken(draft: TokenDraft, col: number, row: number): Promise<TableToken | null> {
    return this.attempt(async () => {
      const token = await this.connection.request<TableToken>(TableClientEvent.CreateToken, {
        ...draft,
        col,
        row,
      });
      this.upsert(token);
      return token;
    });
  }

  async updateToken(id: string, changes: Partial<TokenDraft>): Promise<TableToken | null> {
    return this.attempt(async () => {
      const token = await this.connection.request<TableToken>(TableClientEvent.UpdateToken, {
        id,
        ...changes,
      });
      this.upsert(token);
      return token;
    });
  }

  async deleteToken(id: string): Promise<boolean> {
    const removed = await this.attempt(async () => {
      await this.connection.request(TableClientEvent.DeleteToken, { id });
      this.remove(id);
      return true;
    });
    return removed ?? false;
  }

  async sendMessage(text: string, audience: MessageAudience): Promise<boolean> {
    if (!this.chatCooldown.tryTake()) {
      return false;
    }
    const sent = await this.attempt(async () => {
      const message = await this.connection.request<ChatMessage>(TableClientEvent.SendMessage, {
        text,
        ...audience,
      });
      this.append(message);
      return true;
    }, this.chatCooldown);
    return sent ?? false;
  }

  async rollDice(
    expression: string,
    label: string | null,
    audience: MessageAudience,
  ): Promise<ChatMessage | null> {
    if (!this.diceCooldown.tryTake()) {
      return null;
    }
    return this.attempt(async () => {
      const message = await this.connection.request<ChatMessage>(TableClientEvent.RollDice, {
        expression,
        label,
        ...audience,
      });
      this.append(message);
      this.feed.throwDice(message);
      this.feed.show(message);
      return message;
    }, this.diceCooldown);
  }

  markChatRead(): void {
    this.unreadCount.set(0);
  }

  clearChatForMe(): void {
    const me = this.self();
    const last = this.messageList().at(-1);
    if (!me || !last) {
      return;
    }
    this.clearedAt.set(last.createdAt);
    writeClearedAt(me.id, last.createdAt);
    this.unreadCount.set(0);
  }

  async clearChatForEveryone(): Promise<boolean> {
    const cleared = await this.attempt(async () => {
      await this.connection.request(TableClientEvent.ClearChat, {});
      this.messageList.set([]);
      this.unreadCount.set(0);
      return true;
    });
    return cleared ?? false;
  }

  dragToken(id: string, col: number, row: number): void {
    this.connection.notify(TableClientEvent.DragToken, { id, col, row });
  }

  async moveToken(id: string, col: number, row: number): Promise<void> {
    const before = this.tokensById().get(id);
    if (!before || (before.col === col && before.row === row)) {
      return;
    }

    this.tokensById.update((tokens) => withEntry(tokens, id, { ...before, col, row }));

    try {
      const saved = await this.connection.request<TableToken>(TableClientEvent.MoveToken, {
        id,
        col,
        row,
      });
      this.upsert(saved);
    } catch (error) {
      const current = this.tokensById().get(id);
      if (current && current.version === before.version) {
        this.tokensById.update((tokens) => withEntry(tokens, id, before));
      }
      this.report(error);
    }
  }

  private applySnapshot(snapshot: TableSnapshot): void {
    this.self.set(snapshot.you);
    this.memberList.set(snapshot.members);
    this.online.set(new Set(snapshot.online));
    this.tokensById.set(new Map(snapshot.tokens.map((token) => [token.id, token])));
    this.previewsById.set(new Map());
    this.messageList.set(snapshot.messages.slice(-CHAT_MEMORY_LIMIT));
    this.clearedAt.set(readClearedAt(snapshot.you.id));
    this.drawingsById.set(
      new Map((snapshot.drawings ?? []).map((drawing) => [drawing.id, drawing])),
    );
    this.rulersBy.set(new Map());
    this.sheetsById.set(new Map((snapshot.sheets ?? []).map((sheet) => [sheet.id, sheet])));
    this.synced.set(true);
  }

  private receive(message: ChatMessage): void {
    const isNew = this.append(message);
    if (!isNew || message.authorId === this.self()?.id) {
      return;
    }
    if (message.kind === 'roll') {
      this.feed.show(message);
    }
    const panel = this.store.activePanel();
    const seen = panel === 'chat' || (panel === 'dice' && message.kind === 'roll');
    if (!seen) {
      this.unreadCount.update((count) => count + 1);
    }
  }

  private applyChatCleared(by: string): void {
    this.messageList.set([]);
    this.unreadCount.set(0);
    if (by !== this.self()?.id) {
      this.store.notify('O mestre limpou o chat da mesa.');
    }
  }

  private append(message: ChatMessage): boolean {
    if (this.messageList().some((known) => known.id === message.id)) {
      return false;
    }
    this.messageList.update((list) => [...list, message].slice(-CHAT_MEMORY_LIMIT));
    return true;
  }

  private upsert(token: TableToken): void {
    const current = this.tokensById().get(token.id);
    if (current && current.version > token.version) {
      return;
    }
    this.tokensById.update((tokens) => withEntry(tokens, token.id, token));
    this.previewsById.update((previews) => withoutEntry(previews, token.id));
  }

  private remove(id: string): void {
    this.tokensById.update((tokens) => withoutEntry(tokens, id));
    this.previewsById.update((previews) => withoutEntry(previews, id));
    this.store.clearSelection(id);
  }

  private upsertSheet(sheet: CharacterSheet): void {
    const current = this.sheetsById().get(sheet.id);
    if (current && current.version >= sheet.version) {
      return;
    }
    this.sheetsById.update((sheets) => withEntry(sheets, sheet.id, sheet));
  }

  private removeSheet(id: string): void {
    this.sheetsById.update((sheets) => withoutEntry(sheets, id));
    this.tokensById.update((tokens) => {
      let next = tokens;
      for (const token of tokens.values()) {
        if (token.sheetId === id) {
          next = withEntry(next, token.id, { ...token, sheetId: null });
        }
      }
      return next;
    });
    if (this.store.activeSheetId() === id) {
      this.store.showSheet(null);
    }
  }

  private addDrawing(drawing: TableDrawing): void {
    if (!this.drawingsById().has(drawing.id)) {
      this.drawingsById.update((drawings) => withEntry(drawings, drawing.id, drawing));
    }
  }

  private dropDrawings(ids: readonly string[]): void {
    this.drawingsById.update((drawings) =>
      ids.reduce<ReadonlyMap<string, TableDrawing>>((acc, id) => withoutEntry(acc, id), drawings),
    );
  }

  private applyPreview(preview: TokenPreview): void {
    const token = this.tokensById().get(preview.id);
    if (!token) {
      return;
    }
    const atRest = token.col === preview.col && token.row === preview.row;
    this.previewsById.update((previews) =>
      atRest ? withoutEntry(previews, preview.id) : withEntry(previews, preview.id, preview),
    );
  }

  private applyPresence(online: string[]): void {
    const ids = new Set(online);
    this.online.set(ids);
    this.previewsById.update((previews) => {
      const stale = [...previews.values()].filter((preview) => !ids.has(preview.by));
      return stale.reduce((acc, preview) => withoutEntry(acc, preview.id), previews);
    });
    this.rulersBy.update((rulers) =>
      [...rulers.keys()]
        .filter((by) => !ids.has(by))
        .reduce<ReadonlyMap<string, RemoteRuler>>((acc, by) => withoutEntry(acc, by), rulers),
    );
  }

  private async attempt<T>(action: () => Promise<T>, cooldown?: Cooldown): Promise<T | null> {
    try {
      return await action();
    } catch (error) {
      if (cooldown && error instanceof TableActionError && error.code === COOLDOWN_ERROR) {
        cooldown.hold(error.retryAfterMs);
      } else {
        this.report(error);
      }
      return null;
    }
  }

  private report(error: unknown): void {
    this.store.notify(
      error instanceof TableActionError ? error.message : 'Não foi possível concluir a ação.',
    );
  }
}
