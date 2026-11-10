import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import type { LoginResponse } from './auth.models';
import { AuthService } from './auth.service';
import { SESSION_STORAGE_KEY } from './session-persistence';

const TOKEN = 'aaa.bbb.ccc';

const response: LoginResponse = {
  accessToken: TOKEN,
  tokenType: 'Bearer',
  expiresIn: 3600,
  user: { id: 'u1', username: 'mestre', displayName: 'Mestre', role: 'master' },
};

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  return {
    auth: TestBed.inject(AuthService),
    http: TestBed.inject(HttpTestingController),
    router: TestBed.inject(Router),
  };
}

describe('AuthService', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('starts signed out without a stored session', () => {
    const { auth } = setup();

    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.user()).toBeNull();
  });

  it('stores the session and exposes the user after login', () => {
    const { auth, http } = setup();
    let loggedUser: unknown;

    auth
      .login({ username: 'mestre', password: 'segredo' })
      .subscribe((user) => (loggedUser = user));
    const request = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ username: 'mestre', password: 'segredo' });
    request.flush(response);

    expect(loggedUser).toEqual(response.user);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.accessToken()).toBe(TOKEN);
    expect(JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) ?? '{}').accessToken).toBe(TOKEN);
  });

  it('restores a valid session from storage', () => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ accessToken: TOKEN, expiresAt: Date.now() + 60_000, user: response.user }),
    );

    const { auth } = setup();

    expect(auth.user()?.username).toBe('mestre');
  });

  it('discards expired or tampered stored sessions', () => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ accessToken: TOKEN, expiresAt: Date.now() - 1, user: response.user }),
    );
    expect(setup().auth.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();

    TestBed.resetTestingModule();
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        accessToken: TOKEN,
        expiresAt: Date.now() + 60_000,
        user: { role: 'admin' },
      }),
    );
    expect(setup().auth.isAuthenticated()).toBe(false);
  });

  it('clears the session and returns to login on logout', () => {
    const { auth, http, router } = setup();
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    auth.login({ username: 'mestre', password: 'segredo' }).subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(response);

    auth.logout();

    expect(auth.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
    expect(auth.signOutReason()).toBe('manual');
  });

  it('signs out by itself when the token expires', () => {
    vi.useFakeTimers();
    const { auth, http, router } = setup();
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    auth.login({ username: 'mestre', password: 'segredo' }).subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush({ ...response, expiresIn: 120 });

    vi.advanceTimersByTime(120_000);

    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.signOutReason()).toBe('expired');
  });
});
