# Tempo real

Como a mesa fica igual na tela de todos. O protocolo do servidor está no
[backend](https://github.com/Siay-y/Backend-NeuralGrid/blob/main/docs/tempo-real.md).
Voltar ao [README](../README.md).

**Em resumo:** o servidor decide tudo; o cliente aplica o resultado na hora
(otimista), desfaz se o servidor recusar e só encena dados e animações que o
servidor já resolveu.

---

## Peças

| Peça | Papel |
| --- | --- |
| `TableConnection` | abre o socket, guarda o status, envia com ack e timeout de 8 s |
| `TableState` | estado da mesa: aplica eventos do servidor e envia comandos |
| `TabletopStore` | interface: ferramenta, painel, seleção, foco da câmera e avisos |
| `Board` | desenha e anima no canvas; transforma ponteiro em comando |
| `CinematicQueue` | toca as faixas de tela cheia uma de cada vez |

Todas vivem na página `/tabletop`: entrar abre o socket, sair fecha.

## Conexão

| Situação | O que acontece |
| --- | --- |
| Handshake | o token vai no `auth`, lido de novo a cada reconexão |
| `UNAUTHORIZED` ou `session:expired` | encerra a sessão e volta ao login |
| Queda de rede | status `reconnecting`, nova tentativa entre 1 e 8 s; ao voltar, um snapshot substitui todo o estado |
| Plano gratuito do Render | `GET /api/health` a cada 10 min mantém o servidor acordado |
| Erro de comando | vira `TableActionError` e a mensagem do servidor aparece no aviso do tabuleiro |

---

## Tokens

### Mover

1. O jogador arrasta o próprio token; uma moldura tracejada mostra onde ele vai cair.
2. A cada troca de célula sai `token:drag`, `volatile` e sem ack: se a rede
   engasga, a prévia é descartada.
3. Ao soltar, o token muda na hora e sai `token:move`.
4. Aceito: chega a `version` nova. Recusado: o token volta (se ninguém mexeu
   nele no meio tempo) e o motivo aparece.

| Regra | Como |
| --- | --- |
| Versão | atualização com `version` menor que a conhecida é ignorada |
| Prévia dos outros | o token aparece translúcido na célula da prévia até chegar a posição final ou quem arrasta sair |
| Animação | `TokenMotion` aproxima a posição desenhada do alvo com decaimento de 70 ms |
| Visual | Agente em círculo cheio, NPC com contorno sólido, Ameaça tracejada; nome a partir de 70% de zoom |
| Clique | acerta o círculo do token, não a célula |

### Painel de tokens

| Quem | O que faz |
| --- | --- |
| Mestre | cria, edita e remove (segundo clique em 3 s); nome, tipo, dono, tamanho, ícone, sexo, nome oculto, oculto e luz. Token novo nasce na célula livre mais próxima do centro da tela |
| Jogador | vê a lista, com o selo "seu" nos próprios tokens |
| Todos | clicar numa linha seleciona o token e centraliza a câmera |

O card de hover (`TokenHoverCard`) mostra nome, tipo, sexo, tamanho, dono, HP,
defesa e status. Com nome oculto, o jogador vê `???`, porque é o que o servidor
manda.

---

## Névoa de guerra

O mestre liga a névoa, o alcance (2 a 20 quadrados) e a memória em
Configurações.

| Regra | Como |
| --- | --- |
| Luz | todo token com dono e `emitsLight` acende um círculo suave |
| Jogador | vê escuridão opaca sobre o resto; os próprios tokens ficam sempre visíveis |
| Mestre | vê tudo, com a escuridão a 50% |
| Token no escuro | some do tabuleiro, da lista e do card do jogador (`TableState.inDarkness`) |
| Memória | o caminho das luzes fica à meia luz (`fog:memory`) |
| Desenho | `LightFog` desenha em 1/4 da resolução, com neblina de ruído fractal a cerca de 30 quadros por segundo |

A névoa esconde o desenho, não os dados: para um segredo real, o mestre usa
token oculto ou área oculta.

---

## Combate

| Peça | O que faz |
| --- | --- |
| `InitiativePanel` | mestre adiciona tokens, digita ou rola a iniciativa (d20 + Agilidade), esconde, começa, passa, volta e encerra; jogador vê a ordem |
| Token da vez | halo, anel e seta; a câmera dos jogadores desliza até ele e três ondas saem por 2,4 s |
| `TurnHud` | canto superior direito: rodada e próximos 5 turnos ("vez", "seu", "R2", "caído", "morto"); reabre a cada rodada |
| Finalizar turno | botão no rodapé do `TurnHud`, ativo só na vez do jogador; envia `combat:pass` |
| `CombatIntroBand` | faixa de início com espadas e a posição do jogador, 3,6 s, só para quem luta |
| Sua vez | luz fraca pulsando nas bordas da tela |
| `CinematicQueue` | faixas de combate e morte uma de cada vez, 700 ms entre elas; Esc pula |

### Status

| Peça | O que faz |
| --- | --- |
| `StatusMenu` | só do mestre: botão direito no token, ou "Status" no menu da aba Tokens e da Iniciativa. Passos: Buff ou Debuff, o status, o formulário |
| `StatusForm` | turnos (vazio é sem limite), dano ou cura em dados, e os debuffs que a imunidade bloqueia |
| Card e Iniciativa | mostram os ícones e os turnos restantes |

### Morte

`TableState.deathOf(tokenId)` diz se o token está caído (status `death` com
tentativas) ou morto (sem tentativas).

| Quem | O que vê |
| --- | --- |
| Dono | `DeathBand` com caveira e ossos animados: "Você morreu" com 3 chances (Agente e NPC) ou de vez (Ameaça); no teste, o d20 3D cai e vem "Não foi dessa vez", "Você está consciente" ou "Você morreu"; "Você voltou" ao ser revivido. Caído, a tela fica em preto e branco com vinheta pulsando |
| Outros | aviso no alto ("Kael caiu") e o card da rolagem |
| Mestre | Reviver ou Matar no menu de status, e Reviver na ficha |

Caído, o jogador não move o token nem edita a ficha.

---

## Dados

O cliente nunca sorteia: envia a expressão (`3d20kh1+5`) e recebe cada dado.
Mensagens e rolagens são o mesmo tipo (`ChatMessage`) e dividem o histórico.

| Peça | Quem vê | Onde |
| --- | --- | --- |
| Painel de dados | quem rola | quantidade 1 a 10, bônus -99 a +99, d4 a d100 |
| `DiceScene` | quem rolou | dados caindo com gravidade sobre o tabuleiro |
| `DiceSpinner` | todos | cartão no canto inferior direito, girando até a face sorteada |

| Regra | Como |
| --- | --- |
| Segredo | enquanto gira, o resultado não aparece no chat nem no histórico; revela ao parar, ou em 6 s |
| d100 | um dado só de 100 faces, montado por espiral de Fibonacci e `ConvexHull` |
| Peso | three.js em chunk próprio de cerca de 114 kB, baixado na primeira rolagem; geometria e textura compartilhadas por formato |
| Sem 3D | movimento reduzido, sem WebGL ou mais de 30 dados: o cartão mostra os números |
| Crítico | maior face em azul (`--color-success`), 1 em vermelho (`--color-critical`), só depois de o dado parar; dados descartados por `kh`/`kl` não contam |

---

## Chat

| Opção | `visibility` | Quem vê |
| --- | --- | --- |
| Toda a mesa | `public` | todos |
| Só o mestre / Só eu (oculta) | `gm` | o autor e o mestre |
| Sussurro | `whisper` | o autor e o destinatário |

O filtro real é do servidor; o cliente só mostra o rótulo.

| Regra | Como |
| --- | --- |
| Histórico | snapshot com as últimas 100; o cliente guarda até 200 |
| Repetidas | a mensagem enviada chega pelo ack e pelo broadcast; o `id` descarta a cópia |
| Não lidas | selo no ícone do Chat; com Dados aberto, rolagens contam como vistas |
| Rolagem | fica no fim, a menos que a pessoa tenha subido; aí aparece "mensagens novas" |
| Balões | `buildLogEntries` agrupa mensagens seguidas da mesma pessoa em até 3 min, com separador por dia |
| Limpar | só para si (lembra no `localStorage`) ou, pelo mestre, para todos (`chat:clear`) |

### Fala no tabuleiro

Texto enviado para toda a mesa aparece num balão em cima do token do autor.

| Regra | Como |
| --- | --- |
| Qual token | o primeiro token do autor na ordem de criação (`speakerToken`) |
| Duração | 60 ms por caractere, entre 4 e 10 s; uma fala nova troca a anterior |
| Tamanho | até 220 px e 4 linhas |
| Posição | segue a posição animada do token no mesmo frame do canvas |
| Não aparece | rolagens, mensagens privadas, token na escuridão ou sob o card de hover |
| Fim | o tempo acaba, o chat é limpo ou a mesa fecha |
