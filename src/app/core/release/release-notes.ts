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
