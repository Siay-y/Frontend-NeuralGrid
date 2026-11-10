import { HttpClient } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  AuthSession,
  LoginCredentials,
  LoginResponse,
  SessionUser,
  SignOutReason,
} from './auth.models';
import { SessionPersistence } from './session-persistence';

const EXPIRY_MARGIN_MS = 30_000;
const MAX_TIMER_MS = 2_147_483_647;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly persistence = inject(SessionPersistence);
  private readonly session = signal<AuthSession | null>(this.persistence.read());
  private readonly lastSignOut = signal<SignOutReason | null>(null);
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  readonly user = computed<SessionUser | null>(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly signOutReason = this.lastSignOut.asReadonly();

  constructor() {
    const restored = this.session();
    if (restored) {
      this.scheduleExpiry(restored);
    }
    inject(DestroyRef).onDestroy(() => clearTimeout(this.expiryTimer));
  }

  accessToken(): string | null {
    return this.session()?.accessToken ?? null;
  }

  login(credentials: LoginCredentials): Observable<SessionUser> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, credentials).pipe(
      map((response) => {
        this.start(response);
        return response.user;
      }),
    );
  }

  logout(reason: SignOutReason = 'manual'): void {
    clearTimeout(this.expiryTimer);
    this.persistence.clear();
    this.session.set(null);
    this.lastSignOut.set(reason);
    void this.router.navigateByUrl('/login');
  }

  private start(response: LoginResponse): void {
    const session: AuthSession = {
      accessToken: response.accessToken,
      user: response.user,
      expiresAt: Date.now() + response.expiresIn * 1000 - EXPIRY_MARGIN_MS,
    };
    this.persistence.write(session);
    this.session.set(session);
    this.lastSignOut.set(null);
    this.scheduleExpiry(session);
  }

  private scheduleExpiry(session: AuthSession): void {
    clearTimeout(this.expiryTimer);
    const remaining = session.expiresAt - Date.now();
    this.expiryTimer = setTimeout(
      () => {
        if (this.session() !== session) {
          return;
        }
        if (Date.now() >= session.expiresAt) {
          this.logout('expired');
        } else {
          this.scheduleExpiry(session);
        }
      },
      Math.max(0, Math.min(remaining, MAX_TIMER_MS)),
    );
  }
}
