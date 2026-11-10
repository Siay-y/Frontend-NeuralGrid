import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let token: string | null;
  let logout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    token = 'aaa.bbb.ccc';
    logout = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { accessToken: () => token, logout } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('attaches the bearer token to API requests', () => {
    http.get(`${environment.apiUrl}/auth/me`).subscribe();

    const request = backend.expectOne(`${environment.apiUrl}/auth/me`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer aaa.bbb.ccc');
    request.flush({});
  });

  it('never sends the token to other origins', () => {
    http.get('https://example.com/data').subscribe();
    http.get(`${environment.apiUrl}.evil.example/steal`).subscribe();

    for (const request of backend.match(() => true)) {
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    }
  });

  it('leaves requests untouched when signed out', () => {
    token = null;
    http.post(`${environment.apiUrl}/auth/login`, {}).subscribe();

    const request = backend.expectOne(`${environment.apiUrl}/auth/login`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('ends the session when the API rejects the token', () => {
    http.get(`${environment.apiUrl}/auth/me`).subscribe({ error: () => undefined });

    backend
      .expectOne(`${environment.apiUrl}/auth/me`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(logout).toHaveBeenCalledWith('expired');
  });

  it('does not end the session for a failed login attempt', () => {
    token = null;
    http.post(`${environment.apiUrl}/auth/login`, {}).subscribe({ error: () => undefined });

    backend
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(logout).not.toHaveBeenCalled();
  });
});
