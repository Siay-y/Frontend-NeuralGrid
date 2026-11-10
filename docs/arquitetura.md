# Arquitetura

Pastas, estado, sessão, tabuleiro e as convenções que o código segue. Para a
apresentação do projeto, volte ao [README](../README.md).

---

## Camadas

| Pasta | Responsabilidade | Pode importar de |
| --- | --- | --- |
| `core/` | Serviços singleton da aplicação: sessão, tema | `environments/` |
| `shared/ui/` | Componentes visuais sem regra de negócio | `core/` |
| `features/` | Páginas e componentes de uma funcionalidade | `core/`, `shared/` |

Uma feature nunca importa outra. Quando duas precisarem do mesmo estado, ele sobe
para `core/`.

Os arquivos seguem a convenção de nomes planos do Angular CLI moderno, sem o
infixo `.component`: o componente `Board` vive em `board.ts`, `board.html` e
`board.scss`.

---

## Componentes

- Todos são standalone e declaram as próprias dependências em `imports`.
- Todos usam `ChangeDetectionStrategy.OnPush`. Como a aplicação é zoneless, a
  detecção de mudanças só roda quando um signal lido no template muda ou quando
  um evento do template dispara.
- Entradas usam `input()` e `input.required()`; referências a elementos usam
  `viewChild.required()`.
- Templates usam apenas `@if`, `@for` e `@switch`.
- Animações de entrada e saída usam `animate.enter` e `animate.leave`, nativos
  do Angular 22, com classes e keyframes no SCSS do próprio componente.

---

## Estado com Signals

Não há `BehaviorSubject` compartilhado nem biblioteca de estado.

| Fonte | Escopo | Signals expostos |
| --- | --- | --- |
| `AuthService` | raiz | `user`, `isAuthenticated`, `signOutReason` |
| `ThemeService` | raiz | `theme`, `isDark` |
| `TabletopStore` | provido pela página `/tabletop` | `activeTool`, `activePanel`, `sidebarExpanded` |
| `Board` | local | `camera`, `hoveredCell`, `panning`, `zoomPercent` |
| `LoginPage` | local | `loading`, `submitted`, `error`, `slowServer`, `passwordVisible` |

Os serviços guardam o `signal` gravável como privado e expõem só a versão
`asReadonly()` ou `computed()`. Quem consome lê; só o dono escreve.

O `TabletopStore` é provido no componente da página, não na raiz. Ele nasce ao
entrar na mesa e morre ao sair, sem estado velho sobrevivendo a um logout.

---

## Sessão

```text
LoginPage ──login()──► AuthService ──POST /auth/login──► API
                          │
                          ├─ SessionPersistence.write()   sessionStorage
                          ├─ session.set(...)             signal
                          └─ scheduleExpiry()             setTimeout até expiresAt
```

- **`SessionPersistence`** lê e grava `neuralgrid.session`. Na leitura, valida o
  formato inteiro (token com três partes, papel conhecido, expiração no futuro)
  e descarta qualquer coisa diferente.
- **`AuthService`** restaura a sessão no construtor, então um F5 mantém o
  jogador na mesa. A expiração é agendada com 30 segundos de margem sobre o
  `expiresIn` do servidor, para o token nunca ser enviado já vencido.
- **`authGuard`** e **`guestGuard`** são `CanActivateFn`. Devolvem `true` ou um
  `UrlTree`, nunca navegam por efeito colateral.
- **`authInterceptor`** é um `HttpInterceptorFn`. Anexa o token só à API e trata
  `401` de uma requisição autenticada como sessão encerrada.

---

## Formulário de login

O formulário é um `FormGroup<LoginForm>` criado pelo `NonNullableFormBuilder`:

```ts
interface LoginForm {
  username: FormControl<string>;
  password: FormControl<string>;
}
```

`getRawValue()` devolve `{ username: string; password: string }` sem `null` nem
`undefined`, e o compilador recusa qualquer campo que não exista. As mensagens
de campo aparecem depois do primeiro envio ou quando o campo perde o foco, e
somem enquanto um erro do servidor estiver na tela, para não repetir o aviso.

`describeLoginError` traduz a resposta HTTP para texto:

| Resposta | Mensagem |
| --- | --- |
| `0` | servidor inalcançável |
| `400`, `401` | "Usuário ou senha inválidos." |
| `429` | tempo de espera lido do `Retry-After` |
| outras | mensagem genérica, sem detalhe interno |

---

## Tabuleiro

O `Board` desenha num `<canvas>` e mantém uma câmera própria
(`board-camera.ts`), com funções puras e testadas:

- `cellAt` converte um ponto da tela em coluna e linha, inclusive negativas.
- `zoomAround` aplica o zoom mantendo fixo o ponto sob o cursor.
- `interpolateCamera` interpola posição de forma linear e zoom de forma
  logarítmica, para a velocidade percebida ser constante.

O desenho acontece em pixels físicos (`devicePixelRatio`) com linhas alinhadas
em meio pixel, o que mantém a grade nítida em telas de alta densidade. Um
`ResizeObserver` redimensiona o canvas e um `effect` agenda o redesenho em
`requestAnimationFrame` quando câmera, célula sob o cursor ou ferramenta mudam.

As cores vêm das variáveis CSS (`--grid-line`, `--grid-line-strong`,
`--grid-cell-hover`, `--grid-origin`). Na troca de tema, o `ThemeService`
avisa o tabuleiro dentro do callback da View Transition, e o canvas é redesenhado
antes da captura do novo estado: a grade cruza junto com o resto da tela.

---

## Testes

Vitest com jsdom, via `ng test`. Os arquivos ficam ao lado do código
(`*.spec.ts`) e cobrem:

- `AuthService`: login, restauração, descarte de sessão vencida ou adulterada,
  logout e expiração automática.
- `authInterceptor`: token só para a API, inclusive contra um host que começa
  com o mesmo texto, e `401` encerrando a sessão.
- `authGuard` e `guestGuard`: redirecionamentos.
- `LoginPage`: validação, estado de carregamento, erro e redirecionamento.
- `describeLoginError` e a câmera do tabuleiro.
