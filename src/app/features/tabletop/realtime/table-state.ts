import { computed, inject, Injectable, signal } from '@angular/core';
import type { SessionUser } from '../../../core/auth/auth.models';
import { RollFeed } from '../dice/roll-feed';
import { TabletopStore } from '../tabletop.store';
import { TableConnection } from './table-connection';
import {
  type ChatMessage,
  type MessageAudience,
  TableActionError,
  TableClientEvent,
  type TableMember,
  TableServerEvent,
  type TableSnapshot,
  type TableToken,
  type TokenDraft,
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

  async updateToken(id: string, draft: TokenDraft): Promise<TableToken | null> {
    return this.attempt(async () => {
      const token = await this.connection.request<TableToken>(TableClientEvent.UpdateToken, {
        id,
        ...draft,
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
    const sent = await this.attempt(async () => {
      const message = await this.connection.request<ChatMessage>(TableClientEvent.SendMessage, {
        text,
        ...audience,
      });
      this.append(message);
      return true;
    });
    return sent ?? false;
  }

  async rollDice(
    expression: string,
    label: string | null,
    audience: MessageAudience,
  ): Promise<ChatMessage | null> {
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
    });
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
  }

  private async attempt<T>(action: () => Promise<T>): Promise<T | null> {
    try {
      return await action();
    } catch (error) {
      this.report(error);
      return null;
    }
  }

  private report(error: unknown): void {
    this.store.notify(
      error instanceof TableActionError ? error.message : 'Não foi possível concluir a ação.',
    );
  }
}
