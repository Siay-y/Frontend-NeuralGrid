# Arquitetura

Camadas, estado, sessão, tabuleiro e testes. Voltar ao [README](../README.md).

**Em resumo:** três camadas (`core`, `shared`, `features`), estado só em
signals, componentes standalone com `OnPush` e uma mesa cujo estado nasce e
morre com a página `/tabletop`.

---

## Camadas

| Pasta | Responsabilidade | Importa de |
| --- | --- | --- |
| `core/` | serviços singleton: sessão, tema, aparência, notas de versão | `environments/` |
| `shared/ui/` | componentes visuais sem regra de negócio | `core/` |
| `features/` | páginas e componentes de uma funcionalidade | `core/`, `shared/` |

Uma feature nunca importa outra; estado comum sobe para `core/`. Os nomes são
planos, sem `.component`: `Board` vive em `board.ts`, `board.html` e `board.scss`.

## Convenções

| Regra | Como |
| --- | --- |
| Componentes | standalone, `OnPush`, `input()` e `viewChild.required()` |
| Templates | só `@if`, `@for` e `@switch` |
| Animações | `animate.enter` e `animate.leave`, sem `@angular/animations` |
| Estado | `signal` privado, exposto como `asReadonly()` ou `computed()`; sem `BehaviorSubject` |

---

## Estado com signals

| Fonte | Escopo | Principais signals |
| --- | --- | --- |
| `AuthService` | raiz | `user`, `isAuthenticated`, `signOutReason` |
| `ThemeService` | raiz | `theme`, `isDark` |
| `ReleaseService` | raiz | `hasUnseen` |
| `TabletopStore` | página `/tabletop` | ferramenta, painel, seleção, avisos e quem vê no chat |
| `TableConnection` | página `/tabletop` | `status` da conexão |
| `TableState` | página `/tabletop` | tokens, membros, presença, chat, fichas, mapas, névoa, combate, status, mortes e falas |
| `RollFeed` | página `/tabletop` | cartões de rolagem e dados a jogar |
| `Board` | local | `camera`, `hoveredCell`, `panning`, `draggingToken` |

Os serviços da mesa são providos pela página, não pela raiz: entrar abre o
socket, sair fecha, e nada sobrevive a um logout. `ReleaseService` guarda a
última versão vista em `localStorage` (`neuralgrid.seen-version`).

---

## Sessão

```text
LoginPage ──login()──► AuthService ──POST /auth/login──► API
                          ├─ SessionPersistence.write()   sessionStorage
                          ├─ session.set(...)             signal
                          └─ scheduleExpiry()             logout no horário do token
```

| Peça | Papel |
| --- | --- |
| `SessionPersistence` | lê e grava `neuralgrid.session`; descarta formato inválido, papel desconhecido ou sessão vencida |
| `AuthService` | restaura a sessão no F5 e agenda o logout 30 s antes do `exp` |
| `authGuard` / `guestGuard` | `CanActivateFn` que devolvem `true` ou um `UrlTree` |
| `authInterceptor` | anexa o token só à API; `401` de requisição autenticada encerra a sessão |

O login usa `FormGroup<LoginForm>` do `NonNullableFormBuilder` e
`describeLoginError` traduz a resposta:

| Resposta | Mensagem |
| --- | --- |
| `0` | servidor inalcançável |
| `400`, `401` | "Usuário ou senha inválidos." |
| `429` | tempo de espera do `Retry-After` |
| outras | mensagem genérica |

Se o servidor demora mais de 4 s, o login avisa que ele está acordando.

---

## Tabuleiro

| Peça | Papel |
| --- | --- |
| `board-camera.ts` | funções puras: `cellAt`, `zoomAround` (zoom fixo no cursor) e `interpolateCamera` (zoom logarítmico) |
| Canvas | desenha em pixels físicos, linhas em meio pixel, redimensiona com `ResizeObserver` |
| Laço | `requestAnimationFrame` só enquanto algo muda ou se move |
| Cores | lidas das variáveis CSS; na troca de tema o canvas redesenha dentro da View Transition |

---

## Testes

Vitest com jsdom, arquivos `*.spec.ts` ao lado do código.

| Área | O que cobre |
| --- | --- |
| Sessão | login, restauração, sessão adulterada ou vencida, guards, interceptor (inclusive host parecido) |
| Login | validação, carregamento, erros e redirecionamento |
| Tabuleiro | câmera, geometria de tokens e desenhos, névoa, movimento |
| Dados | notação, `/r`, crítico e falha, faces de cada dado, `RollFeed` |
| `TableState` | movimento otimista, versões, prévias, chat, falas, fichas, combate, status e morte |
| Mesa | iniciativa, HUD de turnos, fila de faixas, mapas, ícones e status |
| Versões | ordem das notas e versão igual à do `package.json` |
