# Design

Tokens, temas, movimento e acessibilidade. Voltar ao [README](../README.md).

**Em resumo:** preto, branco e cinza; borda fina em vez de sombra; Geist para
texto e Geist Mono para números; movimento rápido que assenta devagar.

---

## Princípios

| Princípio | Regra |
| --- | --- |
| Monocromático | sem cor de destaque nem gradiente decorativo; erro e foco usam contraste, borda e ícone |
| Exceções de cor | vermelho na falha crítica, azul no crítico e tons pastel nos desenhos do mapa |
| Superfícies | separadas por borda de 1 px; só o que flutua sobre o tabuleiro tem sombra (`--shadow-float`) |
| Tipografia | Geist no texto, Geist Mono em rótulos, atalhos e números, sempre com `tabular-nums` |
| Movimento | acelera rápido e assenta devagar, sem quique |

---

## Tokens

Em `src/styles/_tokens.scss`. Componentes só usam variáveis.

| Token | Escuro (padrão) | Claro |
| --- | --- | --- |
| `--color-bg` | `#000000` | `#F4F5F7` |
| `--color-surface` | `#0B0B0C` | `#FFFFFF` |
| `--color-border` | `#282833` | `#E4E4E7` |
| `--color-text` | `#FFFFFF` | `#111827` |
| `--color-text-muted` | `#808080` | `#52525B` |
| `--color-inverse` | `#FFFFFF` | `#000000` |
| `--grid-line` | branco a 5,5% | preto a 6% |
| `--color-critical` | `#E5484D` | `#DC2626` |
| `--fog` | `#111113` | `#D4D4D8` |

| Movimento | Valor | Uso |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | entradas |
| `--duration-fast` | `120ms` | hover e cor |
| `--duration` | `220ms` | estados e saídas |
| `--duration-slow` | `560ms` | entradas e layout |

**`chrome-dark`.** No tema claro, o que flutua sobre o tabuleiro (barra
lateral, painéis, HUDs, cartões, balões) fica grafite (`#232327`), porque branco
some sobre a grade clara e preto puro fica duro.

---

## Temas

| Passo | O que acontece |
| --- | --- |
| 1 | `public/theme-boot.js` aplica `data-theme` no `<head>` antes da primeira pintura, sem piscar |
| 2 | `ThemeService` troca o tema dentro de `document.startViewTransition`, com cross-fade da tela inteira |
| 3 | a meta `theme-color` acompanha, para a barra do navegador móvel |

O boot é um arquivo externo para a CSP seguir sem `'unsafe-inline'` em scripts.

---

## Vidro

Barra lateral, painéis e HUDs usam o mixin `floating-glass` (`_glass.scss`). O
controle Transparência, em Configurações > Aparência, vai de 0 (sólido) a 100
(40% com `blur(20px)`) e fica no `localStorage`. Cada tema tem um piso de
opacidade para o texto não perder contraste:

| Piso | Escuro | Claro |
| --- | --- | --- |
| barra, HUD, participantes | 0% | 82% |
| painéis | 62% | 86% |

---

## Medidas

| Elemento | Medida |
| --- | --- |
| Célula do tabuleiro | 48 px a 100%, linha forte a cada 5 células |
| Zoom | 25% a 300% |
| Barra lateral | 56 px recolhida, 232 px aberta, sobreposta ao tabuleiro |
| Card de login | 380 px sobre grade de 40 px |

Com `prefers-reduced-motion: reduce`, animações caem para 0,01 ms e as View
Transitions desligam.

---

## Acessibilidade

- Foco visível com `outline` de 2 px em todo elemento interativo.
- Botões só com ícone têm `aria-label`; estados usam `aria-pressed` e
  `aria-expanded`.
- Erros de campo usam `aria-describedby` e `aria-invalid`; o erro do servidor
  usa `role="alert"`.
- Atalhos de teclado são ignorados com o foco num campo de texto.
- Login conferido a partir de 375 px de largura, sem rolagem horizontal.
