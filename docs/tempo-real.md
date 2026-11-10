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
| `Presence` | estado da conexão e quem está na mesa |

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
