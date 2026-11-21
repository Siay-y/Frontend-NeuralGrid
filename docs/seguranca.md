# Segurança

Onde o token fica, quem o recebe e o que o navegador pode fazer. Voltar ao
[README](../README.md).

**Em resumo:** token no `sessionStorage`, enviado só para a API, logout
automático antes de vencer e uma CSP que não deixa script injetado rodar nem
mandar dados para outro domínio.

---

## Onde o token fica

`sessionStorage`, chave `neuralgrid.session`: some com a aba, sobrevive ao F5 e
o navegador não o envia sozinho (sem CSRF).

| Alternativa | Por que não |
| --- | --- |
| Cookie `HttpOnly` | front e API em sites diferentes exigem `SameSite=None`, que Safari e Firefox bloqueiam, e trazem CSRF |
| `localStorage` | mesma exposição a XSS, mas vive após fechar o navegador e é dividido entre abas |
| Só memória | um F5 derrubaria o jogador |

O risco que sobra é XSS, contido pela CSP e pelo escape automático do Angular.
Na leitura, a sessão com formato inválido, vencida ou com papel desconhecido é
descartada.

## Quem recebe o token

| Regra | Como |
| --- | --- |
| Destino | só URLs iguais a `apiUrl` ou que começam com `apiUrl/`; `api.exemplo.com.evil.example` não passa (há teste) |
| `401` autenticado | apaga a sessão e volta ao login com o aviso de sessão expirada |
| Expiração | logout 30 s antes do `exp` do JWT; sem refresh token |
| Socket | o token vai no `auth` do handshake e é lido de novo a cada reconexão |

---

## Cabeçalhos do Firebase Hosting

Em [`firebase.json`](../firebase.json), para toda resposta:

| Cabeçalho | Efeito |
| --- | --- |
| `Content-Security-Policy` | limita script, estilo, imagem, fonte e conexão |
| `Strict-Transport-Security` | só HTTPS por 2 anos, com subdomínios |
| `X-Frame-Options: DENY` | o site não abre em iframe |
| `X-Content-Type-Options: nosniff` | o navegador não adivinha o tipo do arquivo |
| `Referrer-Policy: no-referrer` | nenhuma URL vaza para terceiros |
| `Cross-Origin-Opener-Policy: same-origin` | isola a janela de popups |
| `Permissions-Policy` | câmera, microfone, localização e pagamento desligados |
| `X-Robots-Tag: noindex, nofollow` | a mesa não aparece em buscadores |

### CSP

```text
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; font-src 'self';
connect-src 'self' https://neuralgrid-api.onrender.com wss://neuralgrid-api.onrender.com;
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
upgrade-insecure-requests
```

| Diretiva | Por quê |
| --- | --- |
| `script-src 'self'` | nenhum script inline roda; por isso o boot do tema é um arquivo e o `inlineCritical` do build está desligado |
| `style-src 'unsafe-inline'` | o Angular injeta os estilos dos componentes em `<style>`; estilo não executa código |
| `img-src 'self' data:` | sem `blob:`: recurso novo com imagem local precisa ser testado com este cabeçalho, porque o `ng serve` não tem CSP |
| `connect-src` | só a API em HTTPS e WSS; mesmo com XSS, o token não sai para outro domínio |
| `font-src 'self'` | fontes servidas pelo próprio site |

Ao mudar a URL da API, atualize o `connect-src` junto com `environment.ts`.

---

## O que nenhuma política resolve

- Uma extensão do navegador com acesso à página lê o `sessionStorage`.
- A CSP depende do Firebase enviar os cabeçalhos; outra hospedagem precisa
  reproduzi-los.
