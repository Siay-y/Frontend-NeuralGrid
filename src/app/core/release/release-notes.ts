export type ChangeKind = 'new' | 'improved' | 'fixed';

export interface ReleaseChange {
  kind: ChangeKind;
  text: string;
}

export interface Release {
  version: string;
  date: string;
  title: string;
  changes: readonly ReleaseChange[];
}

export const CHANGE_KIND_LABEL: Readonly<Record<ChangeKind, string>> = {
  new: 'Novo',
  improved: 'Melhoria',
  fixed: 'Correção',
};

export const RELEASES: readonly Release[] = [
  {
    version: '0.4.2',
    date: '2026-11-11',
    title: 'Mesa mais rápida e mais segura',
    changes: [
      {
        kind: 'improved',
        text: 'A tela de entrada já acorda o servidor enquanto você digita a senha, então a primeira pessoa do dia espera bem menos.',
      },
      {
        kind: 'improved',
        text: 'A mesa começa a baixar durante o login e abre na hora depois de entrar.',
      },
      {
        kind: 'improved',
        text: 'Os dados 3D são preparados em segundo plano, e a primeira rolagem sai sem espera. Quem usa reduzir movimento ou economia de dados não baixa nada a mais.',
      },
      {
        kind: 'improved',
        text: 'Os ícones dos tokens ficaram 28% mais leves, sem nenhuma mudança visível.',
      },
      {
        kind: 'improved',
        text: 'A conexão em tempo real comprime as mensagens grandes, e entrar numa mesa cheia de desenhos baixa até quatro vezes menos dados.',
      },
      {
        kind: 'fixed',
        text: 'Entrar várias vezes seguidas, como ao abrir abas novas, não bloqueia mais o login por 15 minutos. Só senha errada conta, e quem errar a senha de outra pessoa não tranca mais o dono da conta para fora.',
      },
      {
        kind: 'improved',
        text: 'Cada pessoa pode ter a mesa aberta em até 5 abas ao mesmo tempo. Na sexta, o selo do topo avisa "Muitas abas abertas".',
      },
    ],
  },
  {
    version: '0.4.1',
    date: '2026-11-11',
    title: 'Cartão da ficha e revelação aos poucos',
    changes: [
      {
        kind: 'new',
        text: 'Cartão da ficha: com o seu personagem na mesa, um botão no canto inferior direito abre um cartão com codinome, HP, Defesa, Movimento, XP, Dinheiro, carga e atributos, sem abrir a ficha inteira. Clique num atributo para rolar d20 + Mod.',
      },
      {
        kind: 'new',
        text: 'Com mais de um personagem na mesa, o cartão mostra o token que você selecionar e lembra o último que você viu. As abas no topo trocam de personagem e ficam sempre na ordem em que as fichas foram criadas.',
      },
      {
        kind: 'improved',
        text: 'A lista da aba Tokens agora se divide em Agentes, NPCs e Ameaças, cada um numa seção que abre e fecha com um clique. Cada grupo só aparece quando tem algum token na mesa. Para os jogadores, tokens com identidade oculta ficam em Desconhecidos, para não entregar o tipo.',
      },
      {
        kind: 'improved',
        text: 'Apagar ficha ficou mais fácil: cada ficha da lista tem uma lixeira. Clique uma vez e confirme com o segundo clique, sem precisar abrir a ficha.',
      },
      {
        kind: 'new',
        text: 'Destreza entra nos atributos, e as armas também podem atacar com ela.',
      },
      {
        kind: 'new',
        text: 'Na ficha, o mestre pode esconder o personagem dos jogadores e esconder o nome dele, igual no token. O token ligado obedece na hora, e o olho da aba Tokens muda a ficha também.',
      },
      {
        kind: 'new',
        text: 'Esconder vida e armadura: revele o chefe aos poucos. Os jogadores veem nome, sexo e tamanho, mas HP e Defesa ficam ??? até o mestre liberar. Depois disso, a vida aparece ao passar o mouse no token e acompanha cada golpe.',
      },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-11-10',
    title: 'Fichas de personagem',
    changes: [
      {
        kind: 'new',
        text: 'Fichas de personagem: nome, codinome, classe, idade e gênero, HP, XP, Movimento, Dinheiro, Armadura e Defesa, sete atributos, onze habilidades e equipamentos com carga.',
      },
      {
        kind: 'new',
        text: 'Cada jogador cria e edita as próprias fichas, até cinco. O mestre vê e edita todas, cria NPCs e ameaças e escolhe de quem é cada ficha.',
      },
      {
        kind: 'new',
        text: 'Digite o valor do atributo e o Mod sai sozinho: (valor − 10) ÷ 2, para baixo. Clique num atributo ou numa habilidade para rolar d20 + Mod, e nas habilidades soma também o bônus que você escrever.',
      },
      {
        kind: 'new',
        text: 'Tudo salva sozinho enquanto você digita e aparece na hora para o mestre e para o dono da ficha.',
      },
      {
        kind: 'new',
        text: 'Armas com botão de Ataque (d20 + Mod do atributo + bônus) e de Dano. Armaduras e itens com peso, e a carga mostra quanto você leva perto do limite.',
      },
      {
        kind: 'new',
        text: 'A Defesa sai sozinha da Armadura + Mod de Resistência e aparece pronta no Status, com o escudo.',
      },
      {
        kind: 'new',
        text: 'Barra de HP de verdade: clique ou arraste para mudar a vida, use as setas do teclado, e o coração pulsa quando a vida fica baixa. Cada atributo ganhou um ícone que vira dado ao passar o mouse.',
      },
      {
        kind: 'new',
        text: 'Colocar na mesa: o mestre gera o token direto da ficha. Ao passar o mouse no token aparecem HP e Defesa, e um clique duplo abre a ficha.',
      },
      {
        kind: 'new',
        text: 'O token ligado a uma ficha segue a ficha: mudou o nome, o codinome, o tipo ou o jogador, o token muda junto para todo mundo.',
      },
      {
        kind: 'improved',
        text: 'A aba Tokens virou a lista do que está na mesa. Tokens com ficha ganham um atalho para abri-la, e a ficha mostra Localizar na mesa quando já tem token.',
      },
      {
        kind: 'improved',
        text: 'Token rápido para figurantes, portas e marcadores: só nome, tipo, tamanho e se entra escondido. O resto fica na edição do token, que agora também liga o token a uma ficha.',
      },
      {
        kind: 'improved',
        text: 'A grade do tabuleiro some aos poucos nas bordas, como na tela de login, e deixa o centro em destaque. Tokens e desenhos continuam nítidos em qualquer lugar.',
      },
    ],
  },
  {
    version: '0.3.6',
    date: '2026-11-10',
    title: 'Desenho, régua e chat sem spam',
    changes: [
      {
        kind: 'new',
        text: 'Desenhar no mapa: traço livre, seta, retângulo e círculo, em sete cores pastel e três espessuras. Todos na mesa veem na hora, e os desenhos ficam salvos.',
      },
      {
        kind: 'new',
        text: 'Borracha: arraste sobre um desenho para apagar. Jogadores apagam os seus; o mestre apaga qualquer um e pode limpar o mapa inteiro.',
      },
      {
        kind: 'new',
        text: 'Régua: arraste para medir em metros, com 1,5 m por quadrado e a segunda diagonal contando dobrado. A mesa toda vê a sua régua com o seu nome.',
      },
      {
        kind: 'new',
        text: 'Desfazer o último desenho com o botão da barra ou Ctrl+Z. A cor, a forma e a espessura escolhidas ficam guardadas no seu navegador.',
      },
      {
        kind: 'fixed',
        text: 'Token com nome oculto agora esconde tudo dos jogadores: aparece com uma interrogação, sem ícone, tipo, sexo, tamanho ou dono até o mestre revelar.',
      },
      {
        kind: 'improved',
        text: 'Mensagens e rolagens em sequência agora têm um respiro: dá para mandar três seguidas e depois uma a cada 2 segundos. O botão mostra a contagem e uma barrinha indica quanto falta.',
      },
      {
        kind: 'improved',
        text: 'O chat e os dados contam separado, então esperar para falar não impede de rolar, e vice-versa.',
      },
      {
        kind: 'improved',
        text: 'O servidor guarda as 500 mensagens mais recentes da mesa, para o histórico não crescer sem fim.',
      },
      {
        kind: 'fixed',
        text: 'Ao abrir o menu lateral, o indicador de célula no canto do tabuleiro anda junto e não fica mais escondido atrás do menu.',
      },
    ],
  },
  {
    version: '0.3.5',
    date: '2026-11-10',
    title: 'Painéis em telas estreitas',
    changes: [
      {
        kind: 'fixed',
        text: 'Em celulares estreitos, o painel de Tokens não corta mais os campos nem os botões da lista: tudo se ajusta à largura do painel.',
      },
    ],
  },
  {
    version: '0.3.4',
    date: '2026-11-10',
    title: 'Sexo, nome oculto e ficha rápida',
    changes: [
      {
        kind: 'new',
        text: 'Sexo do token na criação: Feminino, Masculino ou Outro. Clique de novo para desmarcar.',
      },
      {
        kind: 'new',
        text: 'Esconder o nome: os jogadores veem ??? no lugar do nome até o mestre desligar.',
      },
      {
        kind: 'new',
        text: 'Passe o mouse sobre um token para ver nome, tipo, ícone, sexo, tamanho e dono.',
      },
      {
        kind: 'improved',
        text: 'Atualizações em sanfona: a versão atual vem aberta e as anteriores fechadas, um clique abre cada uma.',
      },
      {
        kind: 'improved',
        text: 'Dá para recolher o formulário de Novo token e os campos de Rolar dados, deixando mais espaço para a lista e o histórico.',
      },
    ],
  },
  {
    version: '0.3.3',
    date: '2026-11-10',
    title: 'Crítico, bônus e d100 de verdade',
    changes: [
      {
        kind: 'new',
        text: 'Crítico em azul: tirar o maior número do dado, como 12 no d12 ou 6 no d6, pinta o dado de azul.',
      },
      {
        kind: 'new',
        text: 'Campo de Bônus no painel de Dados, somado ao fim da rolagem.',
      },
      {
        kind: 'improved',
        text: 'O d100 agora é um dado só, com 100 faces, em vez de dois d10.',
      },
      {
        kind: 'improved',
        text: 'Falha crítica também no d4: tirar 1 em qualquer dado deixa ele vermelho.',
      },
      {
        kind: 'improved',
        text: 'Os campos de Quantidade e Bônus do painel de Dados agora têm o mesmo tamanho.',
      },
    ],
  },
  {
    version: '0.3.2',
    date: '2026-11-10',
    title: 'Ícones e tokens ocultos',
    changes: [
      {
        kind: 'new',
        text: 'Ícones nos tokens: dragão, lobisomem, cavaleiro, bárbaro, lobo, cultista e mais 60, com busca por nome.',
      },
      {
        kind: 'new',
        text: 'O mestre pode esconder um token dos jogadores e revelar quando ele entrar em cena, com um clique no olho da lista.',
      },
      {
        kind: 'improved',
        text: 'Dados bem mais leves: 10 d20 ou 10 d100 de uma vez rolam sem travar a mesa.',
      },
      {
        kind: 'fixed',
        text: 'Rolagens grandes, como 10 d100, agora aparecem rolando em vez de só mostrar o resultado.',
      },
    ],
  },
  {
    version: '0.3.1',
    date: '2026-11-10',
    title: 'Barra lateral em telas baixas',
    changes: [
      {
        kind: 'fixed',
        text: 'Os ícones da barra lateral não se sobrepõem mais em telas baixas: ela fica mais compacta e rola quando não cabe.',
      },
      {
        kind: 'fixed',
        text: 'No celular, a dica com o nome do botão não fica mais presa por cima do painel depois do toque.',
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-11-10',
    title: 'Dados e chat',
    changes: [
      {
        kind: 'new',
        text: 'Painel de Dados: escolha a quantidade e clique no dado, do d4 ao d100.',
      },
      {
        kind: 'new',
        text: 'Os dados caem na mesa em 3D, quicam e param mostrando o resultado sorteado pelo servidor.',
      },
      {
        kind: 'new',
        text: 'Toda rolagem aparece para a mesa inteira numa caixinha no canto inferior direito, com os dados girando até parar.',
      },
      {
        kind: 'new',
        text: 'Falha crítica: um 1 no d6 ou maior deixa o dado vermelho.',
      },
      {
        kind: 'new',
        text: 'Chat em balões, com avatar, mensagens agrupadas e separador por dia.',
      },
      {
        kind: 'new',
        text: 'Digite /r 1d20+5 Luta para rolar direto da conversa.',
      },
      {
        kind: 'new',
        text: 'Rolagem oculta do mestre, rolagem só para o mestre e sussurros entre jogadores.',
      },
      {
        kind: 'new',
        text: 'Limpar o chat só na sua tela, ou para toda a mesa se você for o mestre.',
      },
      {
        kind: 'new',
        text: 'O ícone do Chat mostra quantas mensagens chegaram, e um botão leva às novas quando você está lendo o histórico.',
      },
      {
        kind: 'improved',
        text: 'A barra lateral agora flutua sobre a mesa, como os outros painéis.',
      },
      {
        kind: 'improved',
        text: 'No tema claro, tudo o que flutua sobre a mesa (barra lateral, painéis, zoom, participantes e rolagens) fica em grafite para destacar do tabuleiro.',
      },
      {
        kind: 'improved',
        text: 'O chat e o histórico só mostram o resultado quando os dados param de girar.',
      },
      {
        kind: 'improved',
        text: 'O canto superior direito mostra só quem está na mesa; o estado da conexão aparece apenas se ela cair.',
      },
      {
        kind: 'improved',
        text: 'Os dados são sorteados no servidor com gerador criptográfico: ninguém consegue forjar um resultado.',
      },
    ],
  },
  {
    version: '0.2.1',
    date: '2026-11-10',
    title: 'Notas de atualização',
    changes: [
      { kind: 'new', text: 'Aba Atualizações na mesa, com tudo o que mudou em cada versão.' },
      {
        kind: 'new',
        text: 'Um ponto no ícone de Atualizações avisa quando há uma versão que você ainda não viu.',
      },
      { kind: 'new', text: 'Versão atual e créditos no rodapé da tela de login.' },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-11-10',
    title: 'Mesa ao vivo',
    changes: [
      {
        kind: 'new',
        text: 'Tokens de Agente, NPC e Ameaça sincronizados em tempo real entre todos da mesa.',
      },
      {
        kind: 'new',
        text: 'Enquanto alguém arrasta um token, os outros veem o movimento célula a célula.',
      },
      {
        kind: 'new',
        text: 'Painel de tokens: o mestre cria, edita e remove; cada jogador move só os próprios.',
      },
      {
        kind: 'new',
        text: 'Quem está na mesa e o estado da conexão aparecem no canto do tabuleiro.',
      },
      {
        kind: 'new',
        text: 'Atalhos Del para remover o token selecionado e Esc para tirar a seleção.',
      },
      { kind: 'improved', text: 'Reconexão automática quando a rede cai.' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-10',
    title: 'Primeira mesa',
    changes: [
      { kind: 'new', text: 'Login com contas privadas criadas pelo mestre.' },
      { kind: 'new', text: 'Tabuleiro em grade com zoom em torno do cursor e arraste do mapa.' },
      { kind: 'new', text: 'Tema escuro e claro, lembrado entre as visitas.' },
      {
        kind: 'fixed',
        text: 'O site sempre carrega a versão mais recente depois de uma publicação.',
      },
    ],
  },
];

export const CURRENT_RELEASE: Release = RELEASES[0];

export const APP_VERSION = CURRENT_RELEASE.version;
