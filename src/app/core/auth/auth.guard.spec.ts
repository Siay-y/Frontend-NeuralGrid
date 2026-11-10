import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('auth guards', () => {
  const authenticated = signal(false);
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: authenticated } },
      ],
    });
  });

  const run = (guard: typeof authGuard) => TestBed.runInInjectionContext(() => guard(route, state));

  const serialize = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

  it('sends visitors without a session to the login page', () => {
    authenticated.set(false);

    const result = run(authGuard);

    expect(result).toBeInstanceOf(UrlTree);
    expect(serialize(result)).toBe('/login');
  });

  it('lets an authenticated user into the tabletop', () => {
    authenticated.set(true);

    expect(run(authGuard)).toBe(true);
  });

  it('skips the login page for an authenticated user', () => {
    authenticated.set(true);

    expect(serialize(run(guestGuard))).toBe('/tabletop');
  });

  it('shows the login page to visitors', () => {
    authenticated.set(false);

    expect(run(guestGuard)).toBe(true);
  });
});
