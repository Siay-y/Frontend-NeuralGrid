# Tempo real

Como a mesa se mantém igual na tela de todo mundo. O protocolo completo, do lado
do servidor, está no
[backend](https://github.com/Siay-y/Backend-NeuralGrid/blob/main/docs/tempo-real.md).
Para a apresentação do projeto, volte ao [README](../README.md).

---

## Peças

| Peça | Responsabilidade |
| --- | --- |
| `TableConnection` | abre o socket, mantém o status em signal, envia com ack e timeout |
| `TableState` | tokens, membros, presença e prévias; aplica eventos e comandos |
| `TabletopStore` | interface: ferramenta, painel, seleção, foco da câmera e avisos |
| `Board` | desenha e anima os tokens, transforma ponteiro em comando |
| `TokensPanel` | formulário do mestre e lista de tokens para todos |
| `Presence` | quem está na mesa, e o estado da conexão quando ela cai |
| `ChatPanel` | histórico completo e campo de mensagem com o comando `/r` |
| `DicePanel` | teste de atributo, dano, dados rápidos e histórico só de rolagens |

As três primeiras são providas pela página `/tabletop`, e não pela raiz. Entrar
na mesa abre o socket, sair fecha. Um logout nunca deixa uma conexão viva para
trás.

---

## Conexão

- O token vai no `auth` do handshake, por função: a cada reconexão o Socket.io
  pede o token de novo e usa o atual.
- `connect_error` com `UNAUTHORIZED` ou o evento `session:expired` encerram a
  sessão e levam ao login com o aviso de sessão expirada.
- Queda de rede vira `reconnecting`; o Socket.io tenta de novo entre 1 e 8
  segundos e, ao voltar, o servidor manda um snapshot novo que substitui o
  estado inteiro.
- Enquanto a mesa está aberta, um `GET /api/health` a cada 10 minutos mantém o
  servidor do plano gratuito do Render acordado.

---

## Comandos

`TableConnection.request` envia com `emitWithAck` e 8 segundos de timeout. O
servidor sempre responde `{ ok, data }` ou `{ ok, error }`; um erro vira
`TableActionError`, e a mensagem do servidor aparece no aviso flutuante no pé do
tabuleiro.

### Mover um token

1. Com a ferramenta Selecionar, o jogador arrasta um token que pode mover. O
   token segue o ponteiro livremente e uma moldura tracejada mostra a célula
   onde ele vai cair.
2. A cada troca de célula sai um `token:drag`, sem ack e marcado como `volatile`:
   se a rede engasgar, a prévia é descartada em vez de acumular.
3. Ao soltar, o `TableState` aplica a nova posição na hora (movimento
   otimista) e envia `token:move`.
4. Se o servidor aceita, a resposta traz a `version` nova. Se recusa, o token
   volta para a posição anterior, mas só se ninguém tiver mexido nele nesse
   meio tempo, e o motivo aparece na tela.

### Versões

Cada token tem `version`. Uma atualização com versão menor que a conhecida é
ignorada, o que protege contra eventos que chegam fora de ordem e contra a
resposta do próprio ack chegando depois do broadcast.

### Prévias dos outros

Um `token:dragged` coloca o token na célula da prévia, translúcido. A prévia some
quando chega a posição definitiva, quando a prévia coincide com a posição atual
(arraste cancelado) ou quando quem arrastava sai da mesa.

---

## Desenho e animação

- `TokenMotion` guarda a posição desenhada de cada token e a aproxima do alvo
  com decaimento exponencial de 70 ms. Movimentos remotos, prévias e o encaixe
  ao soltar ficam suaves sem tween manual.
- O laço de `requestAnimationFrame` só roda enquanto algo se move. Com a mesa
  parada e a névoa desligada, nenhum quadro é desenhado.
- Visual por tipo, sem cor: Agente em círculo cheio, NPC com contorno sólido,
  Ameaça com contorno tracejado. Iniciais em Geist Mono e nome numa etiqueta
  abaixo, a partir de 70% de zoom.
- O alvo do clique é o círculo do token, não a célula, e o token desenhado por
  cima ganha a disputa.

### Névoa de guerra

O mestre liga a névoa e escolhe o alcance da luz (2 a 20 quadrados) no painel
Configurações. `fog:update` vai ao servidor e `fog:changed` chega a todos.

| Regra | Como funciona |
| --- | --- |
| Luz | cada token com dono e `emitsLight` acende um círculo suave no centro dele |
| Jogador | vê a escuridão opaca por cima do mapa, dos desenhos e dos tokens dos outros; os próprios tokens ficam sempre visíveis |
| Mestre | vê tudo, com a escuridão a 50% |
| Tokens no escuro | somem do tabuleiro, da lista de tokens e da ficha rápida do jogador (`TableState.inDarkness`) |
| Sem luz | "Iluminar na névoa" desligado no editor deixa o token no escuro, para emboscadas |
| Memória | com "Memória da névoa" ligada, o caminho das luzes fica à meia luz (`fog:memory`); tokens dos outros fora da luz não são desenhados para o jogador, nem na meia luz |

`LightFog` (`fog-renderer.ts`) desenha a névoa em 1/4 da resolução e amplia,
porque tudo nela é suave. A neblina vem de duas texturas de ruído fractal com
distorção, de tamanhos e velocidades diferentes, multiplicadas por uma máscara
grande e lenta, para não repetir o desenho. As três texturas são geradas uma por
quadro, na primeira vez que a névoa aparece. A memória vira uma máscara presa ao
mapa, redesenhada só quando chegam pontos novos ou o alcance muda; a cada quadro
ela só é copiada para a névoa.

| Movimento | Detalhe |
| --- | --- |
| Ligar e desligar | a escuridão entra e sai em 500 ms |
| Alcance | o raio da luz se aproxima do novo valor com decaimento de 140 ms |
| Neblina | anda devagar, presa ao mapa, redesenhada a cerca de 30 quadros por segundo só enquanto a névoa está visível |
| Ao entrar na mesa | a névoa já aparece pronta, para o mapa não piscar |
| `prefers-reduced-motion` | sem transições e com a neblina parada |

A névoa esconde o que o navegador desenha, não os dados: os tokens no escuro
continuam chegando ao jogador. Para um segredo de verdade, o mestre usa um token
oculto ou uma área oculta.

---

### Ficha rápida

Com o mouse parado sobre um token, o `TokenHoverCard` mostra nome, tipo, ícone,
sexo, tamanho e dono, com a bolinha de presença. O mestre vê também os selos
"oculto dos jogadores" e "nome oculto"; o jogador vê `???` quando o nome está
escondido, porque é isso que o servidor manda. O card fica acima do token, ou
abaixo quando não há espaço em cima, some ao arrastar ou mover a câmera e não
aparece no toque.

## Painel de tokens

O formulário fica dentro de um `Collapsible` ("Novo token", aberto por padrão),
o mesmo que recolhe os campos de "Rolar dados" no painel de Dados. O
`TabletopStore` lembra o que está fechado enquanto a mesa estiver aberta, e
clicar em editar um token abre o formulário de novo.

- **Mestre:** formulário tipado (`FormGroup<TokenForm>`) com nome, tipo, dono e
  tamanho. Um token novo nasce na célula livre mais próxima do centro da tela,
  considerando o tamanho dele. Editar reaproveita o mesmo formulário; remover
  pede um segundo clique em até 3 segundos.
- **Ícone:** o seletor `TokenIconPicker` (um `ControlValueAccessor`) troca as
  iniciais por um dos ícones de `token-icons.ts`, com busca por nome. No
  tabuleiro o ícone vira `Path2D`, criado uma vez por ícone.
- **Sexo:** Feminino, Masculino ou Outro, opcional. Clicar de novo na opção
  marcada desmarca.
- **Nome oculto:** o switch "Esconder o nome" faz o servidor mandar `???` no
  lugar do nome para os jogadores. O mestre continua vendo o nome, com o selo
  `???` na lista.
- **Oculto:** o switch "Esconder dos jogadores" e o olho de cada linha mudam
  `hidden`. O mestre vê o token translúcido, com o selo "oculto"; os jogadores
  nem recebem o token.
- **Jogadores:** só a lista, com o selo "seu" nos próprios tokens.
- **Todos:** clicar numa linha seleciona o token e centraliza a câmera nele. O
  ponto ao lado do dono indica se ele está na mesa.

## Iniciativa

`InitiativePanel` mostra a ordem que vem em `TableState.combat()`, já ordenada
pelo servidor. Clicar numa linha centraliza a câmera no token.

| Quem | O que faz |
| --- | --- |
| Mestre | adiciona tokens da mesa, digita ou rola a iniciativa (d20 + Agilidade, para tokens com ficha), esconde ou revela cada um, começa, passa ou volta o turno e encerra com dois cliques |
| Jogador | vê a rodada e a ordem, com a vez destacada e o selo "seu" |

No tabuleiro, o token da vez ganha halo, anel sólido e uma seta acima dele.
Quando a vez muda, a câmera dos jogadores desliza até ele (menos durante um arraste; a do mestre fica parada) e três
ondas saem do anel por 2,4 s, com a seta balançando; depois o destaque fica
parado e o canvas para de redesenhar. O jogador só vê isso quando o
participante da vez está visível para ele. As linhas do mestre têm um menu de mais opções (rolar, esconder ou
revelar, tirar do combate), para caber na largura do celular.

`CombatCues` cuida do que só o jogador vê:

| Peça | Comportamento |
| --- | --- |
| Início | quando a rodada sai de 0 por um `combat:changed`, `CombatIntroBand` mostra uma faixa no centro da tela, com duas espadas se cruzando e um flash rápido, mostra a rodada, a posição de cada personagem do jogador e quem começa. Só aparece para quem tem personagem na luta, não bloqueia cliques e some em 3,6 s (ou com Esc), com saída animada: as espadas se afastam, o título se abre e a faixa se fecha. Recarregar no meio da luta não repete |
| Finalizar turno | botão no rodapé do tabuleiro, só para quem tem personagem na luta. Mostra "Aguarde sua vez" desabilitado até a vez dele e então "Finalizar turno", que envia `combat:pass`. No celular, os cartões de rolagem sobem para não cobrir o botão |
| Sua vez | uma luz fraca pulsa nas bordas da tela enquanto a vez é de um token do jogador |

Com movimento reduzido, não há flash nem pulso: a luz fica fixa.

---

## Chat e dados

O cliente nunca sorteia nada. `TableState.rollDice` envia a expressão, como
`3d20kh1+5`, e o servidor devolve a rolagem pronta, com cada dado. Mensagens e
rolagens são o mesmo tipo (`ChatMessage`) e dividem um único histórico.

### Painel de dados

O painel tem a quantidade (1 a 10), o bônus (-99 a +99) e os dados em ordem:
d4, d6, d8, d10, d12, d20 e d100. Um clique envia `NdF` com o bônus no fim, como
`2d6` ou `1d20+5`. O bônus aceita digitação (`+3`, `-2`) e fica marcado no canto
de cada dado enquanto for diferente de zero. Rolagens com `kh`/`kl` continuam
disponíveis pelo chat: `/r 2d20kh1+5 Luta`.

### Animação

Toda rolagem tem duas cenas 3D, e nenhuma decide o resultado: as duas só
encenam o que o servidor já sorteou.

| Cena | Quem vê | Onde |
| --- | --- | --- |
| `DiceScene` | quem rolou | sobre o tabuleiro, dados caindo com gravidade e quicando |
| `DiceSpinner` | toda a mesa, inclusive quem rolou | caixinha no canto inferior direito, dados girando no lugar |

1. O ack de `dice:roll` chega com o resultado. `TableState` põe a mensagem na
   fila da cena grande e no `RollFeed`. Para os outros, a mesma rolagem chega
   por `chat:message` e entra só no `RollFeed`.
2. Cada cartão do `RollFeed` monta o próprio `DiceSpinner`: o dado dá um pulo,
   gira rápido, desacelera e converge por `slerp` para a orientação que deixa a
   face sorteada para cima e o número de pé. Enquanto gira, o cartão diz "está
   rolando"; ao parar, mostra o total.
3. A cena grande cai no centro da área livre do tabuleiro, descontando o painel
   aberto, e some 1,4 segundo depois de parar.

O d100 é um dado só, de 100 faces, como o Zocchihedron. As faces vêm de 100
pontos espalhados por uma espiral de Fibonacci na esfera: cada ponto vira o
plano de uma face, e os cantos saem do `ConvexHull` desses pontos. Os números
seguem uma ordem embaralhada fixa, para os vizinhos não serem consecutivos, e
os que mudam de valor de cabeça para baixo (6, 9, 18, 66...) ganham um traço
embaixo. three.js
fica num chunk próprio de ~114 kB, baixado só na primeira rolagem. Com
`prefers-reduced-motion`, sem WebGL, com dados que a cena não sabe desenhar
(como d7) ou com mais de 30 dados, o cartão mostra
os números direto, sem 3D.

Para pesar pouco, o `DiceKit` monta cada formato de dado uma vez: uma geometria
por formato e uma textura (atlas com todas as faces) por combinação de números e
cores. Dez d20 viram dez objetos que dividem a mesma geometria e o mesmo
material, em vez de 200 texturas. Antes de começar a animar, a cena envia as
texturas e compila os shaders com `compileAsync`, sem travar a página.

Enquanto os dados giram, o resultado não aparece em lugar nenhum: o `RollFeed`
marca a rolagem como escondida, e o chat e o histórico de Dados mostram só o
nome e a notação, com três pontinhos. O cartão avisa ao parar (`reveal`), e o
número aparece em todos os lugares ao mesmo tempo. Se o cartão for fechado,
empurrado por outros ou não conseguir animar, a rolagem é revelada na hora; se
nada responder, ela aparece sozinha em 6 segundos.

Cada cartão some em 7,5 segundos, cabem três na tela, e cada um libera o próprio
contexto WebGL ao sair.

### Quem vê

O seletor acima do campo vale para o chat e para os dados ao mesmo tempo, e fica
guardado no `TabletopStore` enquanto a mesa está aberta:

| Opção | `visibility` | Para o jogador | Para o mestre |
| --- | --- | --- | --- |
| Toda a mesa | `public` | todos veem | todos veem |
| Só o mestre / Só eu (oculta) | `gm` | ele e o mestre | só o mestre |
| Sussurro para alguém | `whisper` | ele e o destinatário | ele e o destinatário |

O filtro de verdade mora no servidor. O cliente só mostra o rótulo: "Oculta",
"Para o mestre" ou "Sussurro para você".

### Histórico e não lidas

- O snapshot traz as últimas 100 mensagens visíveis; o cliente guarda até 200.
- A mensagem enviada chega duas vezes, pelo ack e pelo broadcast, e o
  `TableState` descarta a repetida pelo `id`.
- Com o Chat fechado, cada mensagem de outra pessoa soma no contador, que
  aparece num selo sobre o ícone do Chat. Com o painel de Dados aberto, só as
  rolagens contam como vistas. Abrir o Chat zera a conta.
- O histórico rola sozinho para a mensagem nova. Se a pessoa subiu para ler algo
  antigo, a tela fica parada e um botão "mensagens novas" leva de volta ao fim.
- O campo de mensagem esvazia no instante do envio. Quem digita rápido não perde
  a próxima mensagem, e uma mensagem recusada volta para o campo.

### Balões

`buildLogEntries` transforma a lista em linhas de conversa: mensagens seguidas
da mesma pessoa, com a mesma privacidade e até 3 minutos de distância, viram um
grupo com um só avatar e um só horário. Um separador marca cada dia ("Hoje",
"Ontem" ou a data). As suas mensagens ficam à direita em balão invertido; as
privadas usam contorno tracejado. O avatar mostra as iniciais, e o do mestre é
preenchido.

### Limpar

| Ação | Quem | Efeito |
| --- | --- | --- |
| Limpar | todos | esconde o histórico até agora só na sua tela, e lembra disso ao recarregar |
| Para todos | mestre, com segundo clique | `chat:clear` apaga o histórico no servidor e esvazia a tela de todos |

Limpar só para si guarda, no `localStorage` do navegador, o horário da última
mensagem escondida. Nada vai para o servidor.

### Crítico e falha crítica

`dieOutcome` olha cada dado mantido, do d4 ao d100:

| Resultado | Cor | Selo |
| --- | --- | --- |
| 1 | vermelho (`--color-critical`) | Falha crítica |
| o maior número do dado (4 no d4, 12 no d12, 100 no d100) | azul (`--color-success`) | Crítico |

O dado muda de cor no momento em que para, nas duas cenas 3D. Antes disso ele
gira branco como os outros, para não entregar o resultado. No histórico e no
cartão, o dado e o selo ficam com a mesma cor; uma rolagem com os dois casos
mostra os dois selos. Dados descartados por `kh`/`kl` não contam. Vermelho e azul
são as únicas cores fora da escala de cinza do projeto.
