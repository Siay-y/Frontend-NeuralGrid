import { computed, inject, Injectable, signal } from '@angular/core';
import type { SessionUser } from '../../../core/auth/auth.models';
import { TabletopStore } from '../tabletop.store';
import { TableConnection } from './table-connection';
import {
  TableActionError,
  TableClientEvent,
  type TableMember,
  TableServerEvent,
  type TableSnapshot,
  type TableToken,
  type TokenDraft,
  type TokenPreview,
} from './table.protocol';

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

  private readonly tokensById = signal<ReadonlyMap<string, TableToken>>(new Map());
  private readonly previewsById = signal<ReadonlyMap<string, TokenPreview>>(new Map());
  private readonly memberList = signal<readonly TableMember[]>([]);
  private readonly online = signal<ReadonlySet<string>>(new Set());
  private readonly self = signal<SessionUser | null>(null);
  private readonly synced = signal(false);

  readonly tokens = computed(() => [...this.tokensById().values()]);
  readonly previews = this.previewsById.asReadonly();
  readonly members = this.memberList.asReadonly();
  readonly onlineIds = this.online.asReadonly();
  readonly me = this.self.asReadonly();
  readonly ready = this.synced.asReadonly();
  readonly status = this.connection.status;
  readonly isMaster = computed(() => this.self()?.role === 'master');

  start(): void {
    this.connection.connect({
      [TableServerEvent.Snapshot]: (snapshot: TableSnapshot) => this.applySnapshot(snapshot),
      [TableServerEvent.TokenCreated]: (token: TableToken) => this.upsert(token),
      [TableServerEvent.TokenUpdated]: (token: TableToken) => this.upsert(token),
      [TableServerEvent.TokenDeleted]: ({ id }: { id: string }) => this.remove(id),
      [TableServerEvent.TokenDragged]: (preview: TokenPreview) => this.applyPreview(preview),
      [TableServerEvent.PresenceChanged]: ({ online }: { online: string[] }) =>
        this.applyPresence(online),
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
    this.synced.set(true);
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
