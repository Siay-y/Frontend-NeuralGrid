import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TabletopStore } from '../tabletop.store';
import { TableConnection, type ServerEventHandlers } from './table-connection';
import { TableState } from './table-state';
import {
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
});

describe('TableState', () => {
  let connection: FakeConnection;
  let state: TableState;
  let store: TabletopStore;

  beforeEach(() => {
    connection = new FakeConnection();
    TestBed.configureTestingModule({
      providers: [TabletopStore, TableState, { provide: TableConnection, useValue: connection }],
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
});
