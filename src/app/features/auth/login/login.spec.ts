import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import type { SessionUser } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginPage } from './login';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let element: HTMLElement;
  let pending: Subject<SessionUser>;
  let login: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    pending = new Subject<SessionUser>();
    login = vi.fn(() => pending.asObservable());

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { login, signOutReason: signal(null) } },
      ],
    }).compileComponents();

    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPage);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  const type = (selector: string, value: string) => {
    const input = element.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  const submit = async () => {
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };

  it('requires both fields before calling the API', async () => {
    await submit();

    expect(login).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Informe seu usuário.');
    expect(element.textContent).toContain('Informe sua senha.');
  });

  it('shows the loading state and redirects to the tabletop on success', async () => {
    type('#username', 'mestre');
    type('#password', 'segredo');
    await submit();

    expect(login).toHaveBeenCalledWith({ username: 'mestre', password: 'segredo' });
    expect(element.querySelector<HTMLButtonElement>('.submit')!.disabled).toBe(true);
    expect(element.textContent).toContain('Entrando');

    pending.next({ id: 'u1', username: 'mestre', displayName: 'Mestre', role: 'master' });
    pending.complete();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/tabletop');
  });

  it('shows a generic error and clears the password when credentials are rejected', async () => {
    type('#username', 'mestre');
    type('#password', 'errada');
    await submit();

    pending.error(new HttpErrorResponse({ status: 401 }));
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Usuário ou senha inválidos.',
    );
    expect(element.querySelector<HTMLInputElement>('#password')!.value).toBe('');
    expect(element.querySelector<HTMLButtonElement>('.submit')!.disabled).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
