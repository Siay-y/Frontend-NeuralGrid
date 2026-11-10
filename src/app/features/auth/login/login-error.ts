import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';

const FALLBACK_MESSAGE = 'Algo deu errado do nosso lado. Tente novamente em instantes.';

function describeWait(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} segundos`;
  }
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
}

export function describeLoginError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return FALLBACK_MESSAGE;
  }

  switch (error.status) {
    case 0:
      return 'Não foi possível falar com o servidor. Verifique sua conexão.';
    case HttpStatusCode.BadRequest:
    case HttpStatusCode.Unauthorized:
      return 'Usuário ou senha inválidos.';
    case HttpStatusCode.TooManyRequests: {
      const retryAfter = Number(error.headers.get('Retry-After'));
      return Number.isFinite(retryAfter) && retryAfter > 0
        ? `Muitas tentativas. Tente de novo em ${describeWait(retryAfter)}.`
        : 'Muitas tentativas. Aguarde alguns minutos antes de tentar de novo.';
    }
    default:
      return FALLBACK_MESSAGE;
  }
}
