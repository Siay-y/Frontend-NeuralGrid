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
  parada, nenhum quadro é desenhado.
- Visual por tipo, sem cor: Agente em círculo cheio, NPC com contorno sólido,
  Ameaça com contorno tracejado. Iniciais em Geist Mono e nome numa etiqueta
  abaixo, a partir de 70% de zoom.
- O alvo do clique é o círculo do token, não a célula, e o token desenhado por
  cima ganha a disputa.

---

## Painel de tokens

- **Mestre:** formulário tipado (`FormGroup<TokenForm>`) com nome, tipo, dono e
  tamanho. Um token novo nasce na célula livre mais próxima do centro da tela,
  considerando o tamanho dele. Editar reaproveita o mesmo formulário; remover
  pede um segundo clique em até 3 segundos.
- **Jogadores:** só a lista, com o selo "seu" nos próprios tokens.
- **Todos:** clicar numa linha seleciona o token e centraliza a câmera nele. O
  ponto ao lado do dono indica se ele está na mesa.

---

## Chat e dados

O cliente nunca sorteia nada. `TableState.rollDice` envia a expressão, como
`3d20kh1+5`, e o servidor devolve a rolagem pronta, com cada dado. Mensagens e
rolagens são o mesmo tipo (`ChatMessage`) e dividem um único histórico.

### Painel de dados

O painel tem só a quantidade (1 a 10) e os dados em ordem: d4, d6, d8, d10,
d12, d20 e d100. Um clique envia `NdF`, como `2d6`. Rolagens com modificador ou
com `kh`/`kl` continuam disponíveis pelo chat: `/r 2d20kh1+5 Luta`.

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

O d100 vira dois d10, dezena e unidade, lado a lado nas duas cenas. three.js
fica num chunk próprio de ~114 kB, baixado só na primeira rolagem. Com
`prefers-reduced-motion`, sem WebGL, com dados que a cena não sabe desenhar
(como d7) ou com mais de 12 dados, o cartão mostra os números direto, sem 3D.

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

### Falha crítica

Um 1 mantido num d6 ou maior é falha crítica (`isCriticalFailure`). O dado fica
vermelho (`--color-critical`) no momento em que para, nas duas cenas 3D. Antes
disso ele gira branco como os outros, para não entregar o resultado. No
histórico e no cartão, o dado e o selo "Falha crítica" ficam vermelhos. O d4
fica de fora, e o vermelho é a única cor fora da escala de cinza do projeto.
