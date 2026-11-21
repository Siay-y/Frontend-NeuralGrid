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

Cliente web do NeuralGrid, um Virtual Tabletop privado para o mestre e três
jogadores, inspirado no Roll20. Angular 22 sem zone.js, publicado no Firebase
Hosting. A API fica em [Backend-NeuralGrid](https://github.com/Siay-y/Backend-NeuralGrid).

---

## Em resumo

| Recurso | O que faz |
| --- | --- |
| Mesa ao vivo | tabuleiro em canvas com tokens, mapas, desenhos e régua sincronizados por WebSocket |
| Dados 3D | o servidor sorteia; o navegador só encena a queda com three.js |
| Chat | sussurros, rolagem oculta, `/r 1d20+5` e balão de fala sobre o personagem |
| Fichas | fichas de Ordem Paranormal com testes rolados direto do card |
| Combate | iniciativa, turnos, HUD dos próximos turnos, buffs, debuffs e testes de morte |
| Névoa de guerra | luz por token, memória do caminho e áreas ocultas pelo mestre |
| Visual | monocromático, tema escuro e claro, movimento que respeita `prefers-reduced-motion` |
| Atualizações | aba com as notas de cada versão e aviso de versão nova |
| Peso | cerca de 86 kB transferidos no carregamento inicial; o resto vem sob demanda |

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Angular 22: standalone, zoneless, `OnPush`, sem NgModules |
| Estado | Signals (`signal`, `computed`, `effect`) |
| Formulários | Reactive Forms estritamente tipados |
| Linguagem | TypeScript 6 com `strict` e `strictTemplates` |
| Estilo | SCSS sobre variáveis CSS, fontes Geist auto-hospedadas, ícones Lucide |
| Tabuleiro | Canvas 2D com câmera própria (pan, zoom, DPR) |
| Tempo real | `socket.io-client` com ack, reconexão e estado em signals |
| Dados 3D | three.js, baixado só na primeira rolagem |
| Testes | Vitest com jsdom |
| Hospedagem | Firebase Hosting |

---

## Pastas

```text
src/
├── environments/          URL da API por ambiente
├── styles/                tokens de design, vidro e primitivos
└── app/
    ├── core/              sessão, tema, aparência e notas de versão
    ├── shared/ui/         marca e troca de tema
    └── features/
        ├── auth/login/    página de login
        └── tabletop/      a mesa: board, chat, dice, sheets, maps, tokens,
                           initiative, status, death, realtime, panel e sidebar
```

Uma feature nunca importa outra. Detalhes em [docs/arquitetura.md](docs/arquitetura.md).

---

## Rodar local

Requer Node.js 24.18+ e a [API](https://github.com/Siay-y/Backend-NeuralGrid)
em `localhost:3000` com `CORS_ORIGINS=http://localhost:4200`.

```bash
git clone https://github.com/Siay-y/Frontend-NeuralGrid.git
cd Frontend-NeuralGrid
npm ci
npm start
```

Abra `http://localhost:4200/` e entre com uma conta criada pelo seed da API.

> **Windows:** pare o `ng serve` antes de `npm ci`, senão o `esbuild.exe` fica
> travado e a instalação falha com `EPERM`.

| Comando | O que faz |
| --- | --- |
| `npm start` | servidor de desenvolvimento em `localhost:4200` |
| `npm run build` | build de produção em `dist/Frontend-NeuralGrid/browser` |
| `npm run watch` | build de desenvolvimento em modo observador |
| `npm test` | testes com Vitest |
| `npm run deploy` | build de produção e publicação no Firebase Hosting |

### Configuração

O Angular não lê `process.env`; a URL da API fica nos arquivos de ambiente.

| Arquivo | Usado em | API |
| --- | --- | --- |
| `environment.development.ts` | `npm start` | `http://localhost:3000` |
| `environment.ts` | `npm run build` | `https://neuralgrid-api.onrender.com` |

Ao trocar a API de lugar, mude três coisas juntas: `apiUrl`, `socketUrl` e o
`connect-src` da CSP em [`firebase.json`](firebase.json) (`https://` e `wss://`).

---

## Atalhos da mesa

| Tecla | Ação |
| --- | --- |
| `V` / `H` / `R` / `D` / `E` | Selecionar, mover mapa, régua, desenhar, borracha |
| `Esc` | tirar a seleção ou fechar o painel |
| `Del` | remover o token selecionado (mestre) |
| `Enter` / `Shift` + `Enter` | enviar no chat / quebrar a linha |
| `/r 2d6+3 Nome` | rolar dados pelo chat |
| Roda do mouse | zoom em torno do cursor |
| Botão do meio | mover o mapa com qualquer ferramenta |

---

## Deploy

1. `npm install -g firebase-tools` e `firebase login`.
2. `firebase use --add` para ligar a pasta ao projeto (gera o `.firebaserc`,
   veja o [exemplo](.firebaserc.example)).
3. Confira a URL da API e o `connect-src`, e rode `npm run deploy`.
4. Adicione `https://<projeto>.web.app` e `https://<projeto>.firebaseapp.com`
   ao `CORS_ORIGINS` da API.

O `firebase.json` reescreve toda rota para `/index.html`, deixa `js` e `css` em
cache imutável por um ano e envia CSP, HSTS e os demais cabeçalhos descritos em
[docs/seguranca.md](docs/seguranca.md).

---

## Documentação

| Doc | Conteúdo |
| --- | --- |
| [Arquitetura](docs/arquitetura.md) | camadas, signals, sessão, tabuleiro e testes |
| [Tempo real](docs/tempo-real.md) | socket, tokens, névoa, combate, status, morte, dados e chat |
| [Design](docs/design.md) | tokens, temas, movimento e acessibilidade |
| [Segurança](docs/seguranca.md) | onde o token fica, interceptor, CSP e cabeçalhos |

---

## Versionamento

SemVer em `0.x`: o número do meio sobe a cada etapa do roadmap (`0.8.0`) e o
último a cada correção ou melhoria (`0.8.1`).

A versão vive no `package.json` e na primeira entrada de
[`release-notes.ts`](src/app/core/release/release-notes.ts), que alimenta a aba
Atualizações. Um teste falha se os dois divergirem. Para publicar:

1. Adicione a entrada no topo de `RELEASES` (`new`, `improved` ou `fixed`).
2. Rode `npm version <versão> --no-git-tag-version`.
3. Rode `npm test` e `npm run deploy`.

---

## Licença

MIT. Veja [LICENSE](LICENSE). Ícones dos tokens do
[game-icons.net](https://game-icons.net) (Lorc, Delapouite e colaboradores),
sob [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).

Copyright © 2026 Luiz Henrique Porfírio Santos.

---

## Contato

- GitHub: [@Siay-y](https://github.com/Siay-y)
- LinkedIn: [Luiz Henrique Porfírio Santos](https://www.linkedin.com/in/luiz-henrique-porf%C3%ADrio-santos-a8b77229a/)
- E-mail: luiz.porfiriosantos@gmail.com
