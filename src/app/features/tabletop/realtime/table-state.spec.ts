import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RollFeed } from '../dice/roll-feed';
import { TabletopStore } from '../tabletop.store';
import { TableConnection, type ServerEventHandlers } from './table-connection';
import { TableState } from './table-state';
import {
  type ChatMessage,
  TableActionError,
  TableServerEvent,
  type TableSnapshot,
  type TableToken,
} from './table.protocol';

class FakeConnection {
  readonly status = signal('online');
  handlers: ServerEventHandlers = {};
  readonly request = vi.fn<(event: string, payload: unknown) => Promise<unknown>>();
  readonly notify = vi.fn();

  connect(handlers: ServerEventHandlers): void {
    this.handlers = handlers;
  }

  emit(event: string, payload: unknown): void {
    (this.handlers[event] as (value: unknown) => void)(payload);
  }
}

const dante: TableToken = {
  id: 'dante',
  label: 'Dante',
  kind: 'agent',
  ownerId: 'ana',
  col: 0,
  row: 0,
  size: 1,
  version: 1,
};

const snapshot = (role: 'master' | 'player', id = 'ana'): TableSnapshot => ({
  you: { id, username: id, displayName: id, role },
  tokens: [dante],
  members: [
    { id: 'mestre', displayName: 'Mestre', role: 'master' },
    { id: 'ana', displayName: 'Ana', role: 'player' },
  ],
  online: ['mestre', 'ana'],
  messages: [],
});

const message = (id: string, authorId: string): ChatMessage => ({
  id,
  authorId,
  kind: 'text',
  text: `mensagem ${id}`,
  roll: null,
  visibility: 'public',
  recipientId: null,
  createdAt: '2026-11-10T20:00:00.000Z',
});

describe('TableState', () => {
  let connection: FakeConnection;
  let state: TableState;
  let store: TabletopStore;

  beforeEach(() => {
    localStorage.clear();
    connection = new FakeConnection();
    TestBed.configureTestingModule({
      providers: [
        TabletopStore,
        RollFeed,
        TableState,
        { provide: TableConnection, useValue: connection },
      ],
    });
    state = TestBed.inject(TableState);
    store = TestBed.inject(TabletopStore);
    state.start();
    connection.emit(TableServerEvent.Snapshot, snapshot('player'));
  });

  it('loads the snapshot and derives permissions', () => {
    expect(state.ready()).toBe(true);
    expect(state.isMaster()).toBe(false);
    expect(state.canMove(dante)).toBe(true);
    expect(state.canMove({ ...dante, ownerId: 'bruno' })).toBe(false);
  });

  it('ignores updates older than what it already has', () => {
    connection.emit(TableServerEvent.TokenUpdated, { ...dante, col: 5, version: 3 });
    connection.emit(TableServerEvent.TokenUpdated, { ...dante, col: 2, version: 2 });

    expect(state.token('dante')?.col).toBe(5);
  });

  it('moves optimistically and keeps the server answer', async () => {
    let resolve!: (token: TableToken) => void;
    connection.request.mockReturnValue(new Promise((done) => (resolve = done)));

    const pending = state.moveToken('dante', 3, 2);
    expect(state.token('dante')).toMatchObject({ col: 3, row: 2 });

    resolve({ ...dante, col: 3, row: 2, version: 2 });
    await pending;
    expect(state.token('dante')?.version).toBe(2);
  });

  it('rolls back a refused move and tells the user why', async () => {
    connection.request.mockRejectedValue(
      new TableActionError('TOKEN_FORBIDDEN', 'Você só pode mover os seus próprios tokens'),
    );

    await state.moveToken('dante', 9, 9);

    expect(state.token('dante')).toMatchObject({ col: 0, row: 0 });
    expect(store.notice()?.message).toBe('Você só pode mover os seus próprios tokens');
  });

  it('shows drag previews until the move lands', () => {
    connection.emit(TableServerEvent.TokenDragged, { id: 'dante', by: 'ana', col: 4, row: 4 });
    expect(state.previews().get('dante')).toMatchObject({ col: 4 });

    connection.emit(TableServerEvent.TokenUpdated, { ...dante, col: 4, row: 4, version: 2 });
    expect(state.previews().has('dante')).toBe(false);
  });

  it('drops previews from people who went offline', () => {
    connection.emit(TableServerEvent.TokenDragged, { id: 'dante', by: 'ana', col: 4, row: 4 });

    connection.emit(TableServerEvent.PresenceChanged, { online: ['mestre'] });

    expect(state.previews().size).toBe(0);
    expect(state.onlineIds().has('ana')).toBe(false);
  });

  it('removes deleted tokens and clears the selection', () => {
    store.selectToken('dante');

    connection.emit(TableServerEvent.TokenDeleted, { id: 'dante' });

    expect(state.tokens()).toHaveLength(0);
    expect(store.selectedTokenId()).toBeNull();
  });

  describe('chat', () => {
    it('keeps a message once when both the ack and the broadcast arrive', async () => {
      const sent = message('m1', 'ana');
      connection.request.mockImplementation(async () => {
        connection.emit(TableServerEvent.MessageCreated, sent);
        return sent;
      });

      expect(await state.sendMessage('oi', { visibility: 'public', recipientId: null })).toBe(true);
      expect(state.messages().map((m) => m.id)).toEqual(['m1']);
    });

    it('counts unread messages from others only while the chat is closed', () => {
      connection.emit(TableServerEvent.MessageCreated, message('m1', 'mestre'));
      connection.emit(TableServerEvent.MessageCreated, message('m2', 'ana'));
      expect(state.unread()).toBe(1);

      store.openPanel('chat');
      connection.emit(TableServerEvent.MessageCreated, message('m3', 'mestre'));
      expect(state.unread()).toBe(1);

      state.markChatRead();
      expect(state.unread()).toBe(0);
    });

    it('previews every roll and throws the dice only for my own', async () => {
      const feed = TestBed.inject(RollFeed);
      const theirs: ChatMessage = { ...message('r1', 'mestre'), kind: 'roll', text: null };
      const mine: ChatMessage = { ...message('r2', 'ana'), kind: 'roll', text: null };
      connection.request.mockResolvedValue(mine);

      connection.emit(TableServerEvent.MessageCreated, theirs);
      await state.rollDice('1d20', null, { visibility: 'public', recipientId: null });

      expect(feed.previews().map((preview) => preview.id)).toEqual(['r1', 'r2']);
      expect(feed.takeThrow()?.id).toBe('r2');
      expect(feed.takeThrow()).toBeUndefined();
    });

    it('reports a refused roll and returns null', async () => {
      connection.request.mockRejectedValue(
        new TableActionError('INVALID_DICE', 'Os dados precisam ter entre 2 e 100 faces'),
      );

      const result = await state.rollDice('1d1000', null, {
        visibility: 'public',
        recipientId: null,
      });

      expect(result).toBeNull();
      expect(store.notice()?.message).toBe('Os dados precisam ter entre 2 e 100 faces');
    });

    it('hides everything up to now only for me, and remembers it', () => {
      connection.emit(TableServerEvent.MessageCreated, message('m1', 'mestre'));
      connection.emit(TableServerEvent.MessageCreated, {
        ...message('m2', 'mestre'),
        createdAt: '2026-11-10T20:01:00.000Z',
      });

      state.clearChatForMe();
      expect(state.messages()).toEqual([]);
      expect(state.unread()).toBe(0);

      connection.emit(TableServerEvent.MessageCreated, {
        ...message('m3', 'mestre'),
        createdAt: '2026-11-10T20:02:00.000Z',
      });
      expect(state.messages().map((m) => m.id)).toEqual(['m3']);

      connection.emit(TableServerEvent.Snapshot, {
        ...snapshot('player'),
        messages: [message('m1', 'mestre')],
      });
      expect(state.messages()).toEqual([]);
    });

    it('empties the chat when the master clears it for everyone', () => {
      connection.emit(TableServerEvent.MessageCreated, message('m1', 'mestre'));
      connection.emit(TableServerEvent.ChatCleared, { by: 'mestre' });

      expect(state.messages()).toEqual([]);
      expect(store.notice()?.message).toBe('O mestre limpou o chat da mesa.');
    });

    it('treats rolls as seen while the dice panel is open, but not text', () => {
      store.openPanel('dice');
      connection.emit(TableServerEvent.MessageCreated, {
        ...message('r1', 'mestre'),
        kind: 'roll',
        text: null,
      });
      connection.emit(TableServerEvent.MessageCreated, message('m1', 'mestre'));

      expect(state.unread()).toBe(1);
    });
  });
});
