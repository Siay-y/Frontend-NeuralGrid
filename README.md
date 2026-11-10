<p align="center">
  <img src="public/favicon.svg" width="120" alt="Marca do NeuralGrid" />
</p>

<h1 align="center">NeuralGrid | Luiz Santos</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Angular-22.2-DD0031?style=for-the-badge&logo=angular&logoColor=white" alt="Angular 22.2" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 6.0" />
  <img src="https://img.shields.io/badge/SCSS-1.104-CC6699?style=for-the-badge&logo=sass&logoColor=white" alt="SCSS 1.104" />
  <br />
  <img src="https://img.shields.io/badge/Signals-zoneless-DD0031?style=for-the-badge&logo=angular&logoColor=white" alt="Signals sem zone.js" />
  <img src="https://img.shields.io/badge/Lucide-1.71-F56565?style=for-the-badge&logo=lucide&logoColor=white" alt="Lucide 1.71" />
  <img src="https://img.shields.io/badge/Firebase_Hosting-deploy-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Publicado no Firebase Hosting" />
  <br />
  <img src="https://img.shields.io/badge/Vitest-4.1-00FF74?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest 4.1" />
  <img src="https://img.shields.io/badge/Prettier-3.9-F7B93E?style=for-the-badge&logo=prettier&logoColor=white" alt="Prettier 3.9" />
</p>

Cliente web do NeuralGrid, um Virtual Tabletop privado para uma mesa de quatro
pessoas, inspirado no Roll20 mas desenhado para ser rápido, enxuto e silencioso.
Angular 22 sem zone.js, publicado como SPA estática no Firebase Hosting.

Já tem login seguro e a mesa ao vivo: tabuleiro em canvas com grade de
quadrados e tokens de Agentes, NPCs e Ameaças sincronizados por WebSocket entre
o mestre e os jogadores. Fichas, dados e chat chegam nas próximas etapas.

A API vive em [Backend-NeuralGrid](https://github.com/Siay-y/Backend-NeuralGrid).

---

## Visão geral

- **Monocromático de verdade.** Preto, branco e cinza, sem cor de destaque, sem
  gradiente decorativo. Até o autofill do navegador foi domado para não pintar
  os campos de amarelo.
- **Tema escuro e claro por tokens.** Uma troca de `data-theme` no `<html>`
  redefine todas as variáveis CSS. Um script de 260 bytes aplica o tema salvo
  antes da primeira pintura, sem piscar.
- **Movimento com intenção.** Entradas com `cubic-bezier(0.16, 1, 0.3, 1)`,
  troca de tema por View Transition, zoom do tabuleiro com interpolação
  logarítmica. Tudo desliga com `prefers-reduced-motion`.
- **Sessão reativa.** O estado de autenticação é um `signal`; guard,
  interceptor, login e barra lateral leem a mesma fonte. A sessão expira sozinha
  no horário do token e o login avisa o motivo.
- **Mesa ao vivo.** Enquanto um jogador arrasta o próprio token, os outros veem
  o movimento célula a célula. Ao soltar, o token encaixa na grade na hora e o
  servidor confirma; se recusar, ele volta para onde estava e a tela explica o
  motivo.
- **Presença.** Quem está na mesa aparece no canto do tabuleiro, junto com o
  estado da conexão e a reconexão automática.
- **Notas de versão.** A aba Atualizações mostra o que mudou em cada versão, e
  um ponto no ícone avisa quem ainda não viu a mais recente.
- **Token que não vaza.** O interceptor só anexa o `Authorization` a URLs da
  própria API, e a CSP servida pelo Firebase restringe para onde o app pode
  conectar.
- **Leve.** Pacote inicial em torno de 79 kB transferidos; login e mesa são
  carregados sob demanda.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Angular 22 (standalone, zoneless, sem NgModules) |
| Estado | Angular Signals (`signal`, `computed`, `effect`) |
| Formulários | Reactive Forms estritamente tipados |
| Linguagem | TypeScript 6 com `strict` e `strictTemplates` |
| Estilo | SCSS modular sobre variáveis CSS nativas |
| Ícones | `@lucide/angular`, traço de 1.75px |
| Tipografia | Geist e Geist Mono, auto-hospedadas |
| Tabuleiro | Canvas 2D com câmera própria (pan, zoom, DPR) |
| Tempo real | `socket.io-client` com ack, reconexão e estado em signals |
| Testes | Vitest com jsdom |
| Hospedagem | Firebase Hosting |

---

## Arquitetura

```text
src/
├── environments/                   URL da API por ambiente
├── styles/
│   ├── _tokens.scss                cores, tipografia, movimento e medidas
│   └── _primitives.scss            icon-button, kbd, eyebrow, sr-only
├── styles.scss                     reset e base
└── app/
    ├── core/
    │   ├── auth/                   AuthService, guards, interceptor, persistência
    │   ├── release/                notas de versão, versão atual e créditos
    │   └── theme/                  ThemeService
    ├── shared/ui/                  BrandMark, ThemeToggle
    ├── features/
    │   ├── auth/login/             página de login e tradução de erros
    │   └── tabletop/
    │       ├── board/              canvas, câmera, tokens e HUD de zoom
    │       ├── realtime/           protocolo, conexão Socket.io e estado da mesa
    │       ├── tokens/             painel de tokens: criação, edição e lista
    │       ├── presence/           quem está online e estado da conexão
    │       ├── updates/            aba Atualizações com as notas de versão
    │       ├── sidebar/            ferramentas, atalhos e conta
    │       ├── panel/              painel lateral que hospeda cada seção
    │       ├── tabletop.store.ts   estado de interface da mesa em signals
    │       └── tabletop.ts         página que compõe tudo
    ├── app.config.ts               HttpClient, roteador e Lucide
    └── app.routes.ts               /login, /tabletop e redirecionamentos
```

Todos os componentes são standalone e usam `ChangeDetectionStrategy.OnPush`. Os
templates usam apenas o fluxo de controle nativo (`@if`, `@for`) e as animações
de entrada e saída usam `animate.enter` e `animate.leave`, sem
`@angular/animations`.

O detalhe de cada parte está em [docs/arquitetura.md](docs/arquitetura.md).

### Fluxo de acesso

1. `/tabletop` passa pelo `authGuard`. Sem sessão, o guard devolve um
   `UrlTree` para `/login`.
2. O login valida os campos, chama `POST /api/auth/login` e mostra o estado de
   carregamento. Se o servidor demora mais de 4 segundos, explica que ele está
   acordando.
3. A resposta vira uma sessão em `sessionStorage` com o horário de expiração, e
   o roteador segue para `/tabletop`.
4. A partir daí, o `authInterceptor` anexa `Authorization: Bearer <token>` a toda
   chamada da API. Um `401` encerra a sessão e volta ao login.

---

## Variáveis de ambiente

O Angular não lê `process.env` em tempo de execução, então a configuração mora
em arquivos substituídos no build:

| Arquivo | Usado em | `apiUrl` | `socketUrl` |
| --- | --- | --- | --- |
| `src/environments/environment.development.ts` | `npm start` | `http://localhost:3000/api` | `http://localhost:3000` |
| `src/environments/environment.ts` | `npm run build` (produção) | `https://neuralgrid-api.onrender.com/api` | `https://neuralgrid-api.onrender.com` |

Ao publicar a API com outro nome, atualize `apiUrl`, `socketUrl` e o
`connect-src` da CSP em [`firebase.json`](firebase.json), que lista o host em
`https://` e em `wss://`. Os três precisam apontar para o mesmo servidor, senão
o navegador bloqueia o login ou a mesa ao vivo.

---

## Execução local

Requer Node.js 24.18 ou superior e a [API](https://github.com/Siay-y/Backend-NeuralGrid)
rodando em `localhost:3000` com `CORS_ORIGINS=http://localhost:4200`.

```bash
git clone https://github.com/Siay-y/Frontend-NeuralGrid.git
cd Frontend-NeuralGrid
npm ci
npm start
```

A aplicação sobe em `http://localhost:4200/` com recarga automática. Entre com
uma das contas criadas pelo seed da API.

> **No Windows**, encerre o `ng serve` com `Ctrl+C` antes de rodar `npm ci`. Um
> processo ativo mantém trava sobre `node_modules/@esbuild/win32-x64/esbuild.exe`
> e a reinstalação falha com `EPERM`.

### Scripts

| Comando | Descrição |
| --- | --- |
| `npm start` | Servidor de desenvolvimento em `localhost:4200` |
| `npm run build` | Build de produção em `dist/Frontend-NeuralGrid/browser` |
| `npm run watch` | Build de desenvolvimento em modo observador |
| `npm test` | Suíte de testes com Vitest |
| `npm run deploy` | Build de produção e publicação no Firebase Hosting |

### Atalhos da mesa

| Tecla | Ação |
| --- | --- |
| `V` | Selecionar |
| `H` | Mover mapa (arrastar) |
| `R` | Régua |
| `D` | Desenhar |
| `E` | Borracha |
| `Esc` | Tirar a seleção do token, ou fechar o painel |
| `Del` | Remover o token selecionado (só o mestre) |
| Arrastar um token | Mover, com a ferramenta Selecionar |
| Roda do mouse | Zoom em torno do cursor |
| Botão do meio | Mover mapa com qualquer ferramenta |

---

## Deploy no Firebase Hosting

1. Instale a CLI e entre na sua conta:

   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. Crie um projeto no [console do Firebase](https://console.firebase.google.com)
   e associe-o a esta pasta. O comando gera o `.firebaserc`; o
   [`.firebaserc.example`](.firebaserc.example) mostra o formato.

   ```bash
   firebase use --add
   ```

3. Confira o `apiUrl` de produção e o `connect-src` do `firebase.json`.
4. Publique:

   ```bash
   npm run deploy
   ```

5. Adicione as URLs `https://<projeto>.web.app` e
   `https://<projeto>.firebaseapp.com` ao `CORS_ORIGINS` da API no Render.

| Configuração | Valor |
| --- | --- |
| Diretório publicado | `dist/Frontend-NeuralGrid/browser` |
| Rewrite | toda rota cai em `/index.html` |
| Cache | `immutable` por um ano para `js`, `css` e `woff2`; `no-cache` no `index.html` |
| Cabeçalhos | CSP, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` |

O detalhe de cada cabeçalho e o porquê da escolha do `sessionStorage` estão em
[docs/seguranca.md](docs/seguranca.md).

---

## Documentação

- [Arquitetura](docs/arquitetura.md): pastas, signals, sessão, tabuleiro e convenções de código.
- [Tempo real](docs/tempo-real.md): conexão, tokens, movimento otimista, prévias e presença.
- [Design](docs/design.md): tokens, temas, tipografia, movimento e acessibilidade.
- [Segurança](docs/seguranca.md): armazenamento do token, interceptor, CSP e cabeçalhos.

---

## Versionamento

O projeto segue [SemVer](https://semver.org/lang/pt-BR/) enquanto está em `0.x`:

| Parte | Quando sobe | Exemplo |
| --- | --- | --- |
| Menor | uma etapa nova do roadmap | `0.2.0`, mesa ao vivo |
| Patch | melhorias e correções dentro da etapa | `0.2.1`, notas de versão |

A versão mora em dois lugares que andam juntos: o `version` do
[`package.json`](package.json) e a primeira entrada de
[`release-notes.ts`](src/app/core/release/release-notes.ts), que alimenta a aba
Atualizações e o rodapé do login. Um teste falha se os dois divergirem.

Para publicar uma versão:

1. Adicione a entrada nova no topo de `RELEASES`, com data e as mudanças
   classificadas como `new`, `improved` ou `fixed`.
2. Rode `npm version <versão> --no-git-tag-version`.
3. Rode `npm test` e `npm run deploy`.

---

## Licença

Distribuído sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE).

Copyright © 2026 Luiz Henrique Porfírio Santos.

---

## Contato

- GitHub: [@Siay-y](https://github.com/Siay-y)
- LinkedIn: [Luiz Henrique Porfírio Santos](https://www.linkedin.com/in/luiz-henrique-porf%C3%ADrio-santos-a8b77229a/)
- E-mail: luiz.porfiriosantos@gmail.com
