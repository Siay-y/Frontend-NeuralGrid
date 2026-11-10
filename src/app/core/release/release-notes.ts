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
