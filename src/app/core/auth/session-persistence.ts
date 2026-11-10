import { Injectable } from '@angular/core';
import type { AuthSession, SessionUser } from './auth.models';

export const SESSION_STORAGE_KEY = 'neuralgrid.session';

const JWT_SHAPE = /^[\w-]+\.[\w-]+\.[\w-]+$/;

function isSessionUser(value: unknown): value is SessionUser {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const user = value as Record<string, unknown>;
  return (
    typeof user['id'] === 'string' &&
    typeof user['username'] === 'string' &&
    typeof user['displayName'] === 'string' &&
    (user['role'] === 'master' || user['role'] === 'player')
  );
}

function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const session = value as Record<string, unknown>;
  return (
    typeof session['accessToken'] === 'string' &&
    JWT_SHAPE.test(session['accessToken']) &&
    typeof session['expiresAt'] === 'number' &&
    isSessionUser(session['user'])
  );
}

// The token lives in sessionStorage: it is scoped to the tab, dies with it and
// is never sent automatically by the browser, which rules out CSRF. XSS is the
// remaining exposure, contained by the strict CSP served by Firebase Hosting.
@Injectable({ providedIn: 'root' })
export class SessionPersistence {
  read(now = Date.now()): AuthSession | null {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed: unknown = JSON.parse(raw);
      if (isAuthSession(parsed) && parsed.expiresAt > now) {
        return parsed;
      }
      this.clear();
      return null;
    } catch {
      this.clear();
      return null;
    }
  }

  write(session: AuthSession): void {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      return;
    }
  }

  clear(): void {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      return;
    }
  }
}
