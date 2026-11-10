import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { describeLoginError } from './login-error';

const httpError = (status: number, headers?: Record<string, string>) =>
  new HttpErrorResponse({ status, headers: new HttpHeaders(headers) });

describe('describeLoginError', () => {
  it('uses one message for wrong credentials and invalid input', () => {
    expect(describeLoginError(httpError(401))).toBe('Usuário ou senha inválidos.');
    expect(describeLoginError(httpError(400))).toBe('Usuário ou senha inválidos.');
  });

  it('reports the wait time sent by the throttler', () => {
    expect(describeLoginError(httpError(429, { 'Retry-After': '900' }))).toBe(
      'Muitas tentativas. Tente de novo em 15 minutos.',
    );
    expect(describeLoginError(httpError(429, { 'Retry-After': '45' }))).toBe(
      'Muitas tentativas. Tente de novo em 45 segundos.',
    );
  });

  it('falls back when the throttler omits the wait time', () => {
    expect(describeLoginError(httpError(429))).toContain('Aguarde alguns minutos');
  });

  it('explains network failures', () => {
    expect(describeLoginError(httpError(0))).toContain('Não foi possível falar com o servidor');
  });

  it('hides server internals behind a generic message', () => {
    expect(describeLoginError(httpError(500))).toContain('Algo deu errado');
    expect(describeLoginError(new Error('boom'))).toContain('Algo deu errado');
  });
});
