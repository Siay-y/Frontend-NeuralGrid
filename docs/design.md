# Design

A linguagem visual, os tokens, os temas e o movimento. Para a apresentação do
projeto, volte ao [README](../README.md).

---

## Princípios

- **Monocromático.** Preto, branco e uma escala de cinza. Nenhuma cor de
  destaque, nenhum gradiente decorativo. Estados como erro e foco são
  comunicados por contraste, borda e ícone, nunca por vermelho ou azul. As
  únicas exceções são os dados: vermelho na falha crítica e azul no crítico.
- **Bordas finas, sombras discretas.** Superfícies se separam por uma borda de
  1px. A única sombra (`--shadow-float`) serve para elementos que flutuam sobre o
  tabuleiro.
- **Tipografia técnica.** Geist para texto, Geist Mono para rótulos, atalhos,
  coordenadas e números, sempre com `tabular-nums`.
- **Movimento mecânico.** Curvas que aceleram rápido e assentam devagar, sem
  quique e sem exagero.

---

## Tokens

Definidos em `src/styles/_tokens.scss`. Componentes só usam variáveis, nunca
valores de cor soltos.

| Token | Escuro (padrão) | Claro |
| --- | --- | --- |
| `--color-bg` | `#000000` | `#F4F5F7` |
| `--color-surface` | `#0B0B0C` | `#FFFFFF` |
| `--color-surface-raised` | `#121214` | `#FFFFFF` |
| `--color-border` | `#282833` | `#E4E4E7` |
| `--color-text` | `#FFFFFF` | `#111827` |
| `--color-text-muted` | `#808080` | `#52525B` |
| `--color-inverse` | `#FFFFFF` | `#000000` |
| `--grid-line` | branco a 5,5% | preto a 6% |
| `--grid-line-strong` | branco a 11% | preto a 12% |
| `--color-critical` | `#E5484D` | `#DC2626` |
| `--fog` | `#111113` | `#D4D4D8` |
| `--fog-mist` | `#A1A1AA` | `#52525B` |

O botão principal usa o par `--color-inverse` e `--color-inverse-text`: branco
sobre preto no tema escuro, preto sobre branco no claro.

No tema claro, tudo o que flutua sobre o tabuleiro (barra lateral, painéis,
zoom, célula, participantes, cartões de rolagem e avisos) fica em grafite. Esses
elementos levam a classe `chrome-dark`, que parte do mixin `dark-palette` de
`_tokens.scss` e clareia a escala: superfície `#232327` em vez de `#0B0B0C`,
texto `#F4F4F5` em vez de branco puro. Sobre a grade clara, um controle branco se
perdia, e o preto puro ficava duro demais. O grafite destaca sem gritar.

Os dados da caixinha leem as cores do próprio cartão, então ficam claros sobre o
grafite. Os que caem no tabuleiro seguem o tema da página.

| Movimento | Valor |
| --- | --- |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` |
| `--duration-fast` | `120ms` (hover, cor) |
| `--duration` | `220ms` (estados, saídas) |
| `--duration-slow` | `560ms` (entradas, layout) |

---

## Temas

O tema vive no atributo `data-theme` do `<html>`. O padrão é escuro.

1. `public/theme-boot.js` roda no `<head>`, antes do CSS pintar, lê
   `neuralgrid.theme` do `localStorage` e aplica o atributo. Sem flash de tema
   errado ao recarregar.
2. `ThemeService` assume dali em diante. A troca acontece dentro de
   `document.startViewTransition`, que faz o cross-fade da tela inteira, inclusive
   do canvas.
3. A meta `theme-color` acompanha o tema, para a barra do navegador móvel não
   destoar.

O script de boot é um arquivo externo, e não inline, para a CSP continuar sem
`'unsafe-inline'` em `script-src`.

---

## Movimento

| Elemento | Efeito |
| --- | --- |
| Card de login | sobe 12px, cresce de 98% e perde um desfoque de 6px |
| Conteúdo do card | entra em cascata, 60ms entre blocos |
| Grade do login | aparece com leve redução de escala |
| Erros e avisos | descem 4px enquanto aparecem |
| Botão Entrar | seta anda 3px no hover, botão encolhe 1,5% no clique |
| Barra lateral | largura anima, rótulos aparecem com 80ms de atraso |
| Painel lateral | entra deslizando 12px, sai em 220ms |
| Tabuleiro | zoom pelos botões interpola em 420ms com `easeOutExpo` |
| Tema | cross-fade por View Transition |
| Névoa | entra e sai em 500 ms, neblina andando devagar sobre o escuro |

Com `prefers-reduced-motion: reduce`, transições e animações caem para 0,01ms e
as View Transitions são desligadas.

---

## Componentes visuais

- **Login**: card de 380px centralizado sobre uma grade de 40px, com máscara
  radial que apaga as bordas. Rótulos em mono e caixa alta.
- **Barra lateral**: 56px recolhida, 232px expandida, sobreposta ao tabuleiro
  para ele não ser redimensionado a cada quadro. Recolhida, mostra tooltip com
  300ms de atraso; expandida, mostra rótulo e atalho.
- **Tabuleiro**: células de 48px a 100% de zoom, linha forte a cada 5 células,
  cruz na origem, célula sob o cursor realçada. Zoom de 25% a 300%.
- **HUD**: coordenada da célula à esquerda e controles de zoom à direita, ambos
  flutuando sobre o tabuleiro.
- **Vidro**: barra lateral, painéis, HUD e participantes usam o mixin
  `floating-glass` (`styles/_glass.scss`), que lê `--glass-surface` e
  `--glass-filter`. O `AppearanceService` define essas variáveis a partir do
  controle Transparência, em Configurações > Aparência: de 0 (sólida, sem
  `backdrop-filter`) a 100 (superfície a 40% com `blur(20px)`). A escolha fica
  no `localStorage`. Cada tema tem um piso de opacidade, para o texto não perder
  contraste:

  | Piso | Escuro | Claro |
  | --- | --- | --- |
  | `--glass-floor` (barra, HUD, participantes) | 0% | 82% |
  | `--glass-panel-floor` (painéis) | 62% | 86% |

  No tema claro, os flutuantes são grafite sobre fundo claro, e sem piso o
  grafite viraria cinza. Sem suporte a `backdrop-filter`, o controle fica
  desligado.

---

## Acessibilidade

- Foco visível em todo elemento interativo, com `outline` de 2px.
- Botões só com ícone têm `aria-label`; ferramentas e painéis informam o estado
  com `aria-pressed`, e o menu com `aria-expanded`.
- Erros de campo ficam ligados ao input por `aria-describedby`, com
  `aria-invalid`; o erro do servidor usa `role="alert"`.
- Os atalhos de teclado são ignorados enquanto o foco está num campo de texto.
- O login foi conferido a partir de 375px de largura, sem rolagem horizontal.
