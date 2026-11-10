import {
  LucideDices,
  LucideEraser,
  LucideHand,
  LucideMessageSquare,
  LucideMousePointer2,
  LucidePencil,
  LucideRuler,
  LucideScrollText,
  LucideSettings,
  type LucideIconInput,
} from '@lucide/angular';

export type MapToolId = 'select' | 'pan' | 'measure' | 'draw' | 'erase';

export type PanelId = 'sheets' | 'dice' | 'chat' | 'settings';

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
  sheets: {
    id: 'sheets',
    label: 'Fichas',
    description:
      'As fichas dos personagens da mesa vão aparecer aqui, sincronizadas em tempo real.',
    icon: LucideScrollText,
  },
  dice: {
    id: 'dice',
    label: 'Dados',
    description: 'Rolagens validadas pelo servidor, com histórico visível para toda a mesa.',
    icon: LucideDices,
  },
  chat: {
    id: 'chat',
    label: 'Chat',
    description: 'Conversa da mesa, com mensagens do mestre e dos jogadores.',
    icon: LucideMessageSquare,
  },
  settings: {
    id: 'settings',
    label: 'Configurações',
    description: 'Preferências da mesa, do tabuleiro e da sua conta.',
    icon: LucideSettings,
  },
};

export const SHORTCUT_PANELS: readonly TablePanel[] = [
  TABLE_PANELS.sheets,
  TABLE_PANELS.dice,
  TABLE_PANELS.chat,
];
