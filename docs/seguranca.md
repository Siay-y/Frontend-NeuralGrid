# Segurança

Onde o token fica, quem pode recebê-lo e o que o navegador está autorizado a
fazer. Para a apresentação do projeto, volte ao [README](../README.md).

---

## Onde o token fica

A sessão vai para o `sessionStorage`, na chave `neuralgrid.session`, com o
token, o horário de expiração e os dados públicos do usuário.

| Opção | Por que não |
| --- | --- |
| Cookie `HttpOnly` | Frontend no Firebase e API no Render são sites diferentes. O cookie precisaria de `SameSite=None`, que Safari e Firefox bloqueiam como cookie de terceiros, e traria CSRF para o problema |
| `localStorage` | Mesma exposição a XSS, mas o token sobrevive ao fechamento do navegador e é compartilhado entre abas |
| Só memória | Seguro, mas um F5 no meio da sessão derrubaria o jogador |

O `sessionStorage` morre com a aba, não é enviado automaticamente pelo navegador
(o que elimina CSRF) e sobrevive a um recarregamento. A exposição que sobra é
XSS, contida pela CSP abaixo e pelo fato de o Angular escapar toda interpolação
de template.

Na leitura, `SessionPersistence` valida o formato completo da sessão e descarta
o que estiver vencido, corrompido ou com um papel desconhecido.

---

## Quem recebe o token

O `authInterceptor` anexa `Authorization: Bearer <token>` apenas quando a URL é
exatamente `environment.apiUrl` ou começa com `environment.apiUrl/`. A barra
final importa: `https://api.exemplo.com.evil.example` não passa. Há um teste
para esse caso.

Quando a API responde `401` a uma requisição autenticada, a sessão local é
apagada e o jogador volta ao login com o aviso de sessão expirada. Um `401` no
próprio login não derruba nada, porque ainda não havia sessão.

---

## Expiração

A sessão local expira 30 segundos antes do `exp` do JWT. Um `setTimeout` faz o
logout no horário certo, mesmo que o jogador não clique em nada. Não há refresh
token nesta etapa: quando a sessão acaba, entra de novo.

---

## Cabeçalhos do Firebase Hosting

Definidos em [`firebase.json`](../firebase.json) para toda resposta:

| Cabeçalho | Valor | Efeito |
| --- | --- | --- |
| `Content-Security-Policy` | ver abaixo | limita origem de script, estilo, fonte e conexão |
| `Strict-Transport-Security` | 2 anos, com subdomínios | só HTTPS |
| `X-Frame-Options` | `DENY` | impede o site dentro de iframe |
| `X-Content-Type-Options` | `nosniff` | impede adivinhar tipo de arquivo |
| `Referrer-Policy` | `no-referrer` | nenhuma URL vaza para terceiros |
| `Cross-Origin-Opener-Policy` | `same-origin` | isola a janela de popups |
| `Permissions-Policy` | câmera, microfone, localização e pagamento desligados | |
| `X-Robots-Tag` | `noindex, nofollow` | a mesa não aparece em buscadores |

### Content Security Policy

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self' https://neuralgrid-api.onrender.com wss://neuralgrid-api.onrender.com;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests
```

- **`script-src 'self'`** sem `'unsafe-inline'`: nenhum script injetado roda. Por
  isso o boot do tema é um arquivo e o `inlineCritical` do build está desligado,
  já que ele gera um `onload` inline.
- **`style-src 'unsafe-inline'`** é necessário porque o Angular injeta os estilos
  dos componentes em tags `<style>`. Estilo não executa código, e o risco
  residual é aceito.
- **`connect-src`** lista só a API, em HTTPS e WSS (para a Etapa 2). Mesmo com
  um XSS, o token não pode ser enviado para outro domínio por `fetch`.
- **`font-src 'self'`**: as fontes são servidas pelo próprio site, sem Google
  Fonts.

Ao mudar a URL da API, atualize o `connect-src` junto com
`src/environments/environment.ts`.

---

## Superfície que sobra

- Uma extensão de navegador com acesso à página consegue ler o
  `sessionStorage`. Nenhuma política de site resolve isso.
- A CSP depende do Firebase servir os cabeçalhos. Ao trocar de hospedagem, eles
  precisam ser reproduzidos.
