import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { io, type Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import {
  type AckResult,
  HANDSHAKE_UNAUTHORIZED,
  TABLE_NAMESPACE,
  TableActionError,
  TableServerEvent,
} from './table.protocol';

export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

export type ServerEventHandlers = Partial<Record<string, (payload: never) => void>>;

const ACK_TIMEOUT_MS = 8_000;
const KEEP_ALIVE_MS = 10 * 60_000;

@Injectable()
export class TableConnection {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private socket: Socket | null = null;
  private keepAlive: ReturnType<typeof setInterval> | undefined;
  private readonly state = signal<ConnectionStatus>('connecting');

  readonly status = this.state.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.disconnect());
  }

  connect(handlers: ServerEventHandlers): void {
    if (this.socket) {
      return;
    }

    const socket = io(`${environment.socketUrl}/${TABLE_NAMESPACE}`, {
      transports: ['websocket', 'polling'],
      auth: (provide) => provide({ token: this.auth.accessToken() }),
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 8_000,
    });
    this.socket = socket;

    socket.on('connect', () => this.state.set('online'));
    socket.on('disconnect', (reason) =>
      this.state.set(reason === 'io client disconnect' ? 'offline' : 'reconnecting'),
    );
    socket.on('connect_error', (error) => {
      if (error.message === HANDSHAKE_UNAUTHORIZED) {
        this.auth.logout('expired');
        return;
      }
      this.state.set('reconnecting');
    });
    socket.on(TableServerEvent.SessionExpired, () => this.auth.logout('expired'));

    for (const [event, handler] of Object.entries(handlers)) {
      if (handler) {
        socket.on(event, handler as (...args: unknown[]) => void);
      }
    }

    // Render's free tier sleeps after 15 minutes without inbound HTTP traffic,
    // and an open WebSocket is not guaranteed to count. A light request keeps
    // the server awake for as long as someone has the table open.
    this.keepAlive = setInterval(() => {
      this.http.get(`${environment.apiUrl}/health`).subscribe({ error: () => undefined });
    }, KEEP_ALIVE_MS);
  }

  async request<T>(event: string, payload: unknown): Promise<T> {
    if (!this.socket?.connected) {
      throw new TableActionError('OFFLINE', 'Sem conexão com a mesa. Tentando reconectar.');
    }

    let result: AckResult<T>;
    try {
      result = (await this.socket
        .timeout(ACK_TIMEOUT_MS)
        .emitWithAck(event, payload)) as AckResult<T>;
    } catch {
      throw new TableActionError('TIMEOUT', 'O servidor não respondeu a tempo.');
    }

    if (!result.ok) {
      throw new TableActionError(
        result.error.code,
        result.error.message,
        result.error.retryAfterMs,
      );
    }
    return result.data;
  }

  notify(event: string, payload: unknown): void {
    this.socket?.volatile.emit(event, payload);
  }

  disconnect(): void {
    clearInterval(this.keepAlive);
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.state.set('offline');
  }
}
