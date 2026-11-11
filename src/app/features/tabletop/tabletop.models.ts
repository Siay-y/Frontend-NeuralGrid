import {
  LucideDices,
  LucideEraser,
  LucideHand,
  LucideHistory,
  LucideMessageSquare,
  LucideMousePointer2,
  LucidePencil,
  LucideRuler,
  LucideScrollText,
  LucideSettings,
  LucideUsers,
  type LucideIconInput,
} from '@lucide/angular';

export type MapToolId = 'select' | 'pan' | 'measure' | 'draw' | 'erase';

export type PanelId = 'tokens' | 'sheets' | 'dice' | 'chat' | 'updates' | 'settings';

export interface MapTool {
  id: MapToolId;
  label: string;
  shortcut: string;
  icon: LucideIconInput;
}

export interface TablePanel {
  id: PanelId;
  label: string;
  description: string;
  icon: LucideIconInput;
}

export const MAP_TOOLS: readonly MapTool[] = [
  { id: 'select', label: 'Selecionar', shortcut: 'V', icon: LucideMousePointer2 },
  { id: 'pan', label: 'Mover mapa', shortcut: 'H', icon: LucideHand },
  { id: 'measure', label: 'Régua', shortcut: 'R', icon: LucideRuler },
  { id: 'draw', label: 'Desenhar', shortcut: 'D', icon: LucidePencil },
  { id: 'erase', label: 'Borracha', shortcut: 'E', icon: LucideEraser },
];

export const TABLE_PANELS: Readonly<Record<PanelId, TablePanel>> = {
  tokens: {
    id: 'tokens',
    label: 'Tokens',
    description: 'Agentes, NPCs e ameaças posicionados no tabuleiro.',
    icon: LucideUsers,
  },
  sheets: {
    id: 'sheets',
    label: 'Fichas',
    description: 'Fichas dos agentes, NPCs e ameaças, sincronizadas em tempo real.',
    icon: LucideScrollText,
  },
  dice: {
    id: 'dice',
    label: 'Dados',
    description: 'Testes de atributo, dano e rolagens livres, sorteados pelo servidor.',
    icon: LucideDices,
  },
  chat: {
    id: 'chat',
    label: 'Chat',
    description: 'Conversa da mesa, com sussurros e rolagens no mesmo histórico.',
    icon: LucideMessageSquare,
  },
  updates: {
    id: 'updates',
    label: 'Atualizações',
    description: 'O que mudou em cada versão do NeuralGrid.',
    icon: LucideHistory,
  },
  settings: {
    id: 'settings',
    label: 'Configurações',
    description: 'Preferências da mesa, do tabuleiro e da sua conta.',
    icon: LucideSettings,
  },
};

export const SHORTCUT_PANELS: readonly TablePanel[] = [
  TABLE_PANELS.tokens,
  TABLE_PANELS.sheets,
  TABLE_PANELS.dice,
  TABLE_PANELS.chat,
];
