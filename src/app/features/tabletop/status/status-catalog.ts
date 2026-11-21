import {
  BUFF_KINDS,
  DEBUFF_KINDS,
  type StatusKind,
  type TableStatus,
} from '../realtime/table.protocol';

export type StatusGroup = 'debuff' | 'buff';
export type StatusAmount = 'damage' | 'heal' | 'value';

export interface StatusInfo {
  kind: StatusKind;
  label: string;
  group: StatusGroup;
  amount: StatusAmount | null;
  paths: readonly string[];
}

const SHIELD =
  'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z';

export const STATUS_INFO: Record<StatusKind, StatusInfo> = {
  bleeding: {
    kind: 'bleeding',
    label: 'Sangramento',
    group: 'debuff',
    amount: 'damage',
    paths: [
      'M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z',
      'M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97',
    ],
  },
  poison: {
    kind: 'poison',
    label: 'Veneno',
    group: 'debuff',
    amount: 'damage',
    paths: [
      'M10 11.9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
      'M6.7 3.4c-.9 2.5 0 5.2 2.2 6.7C6.5 9 3.7 9.6 2 11.6',
      'm8.9 10.1 1.4.8',
      'M17.3 3.4c.9 2.5 0 5.2-2.2 6.7 2.4-1.2 5.2-.6 6.9 1.5',
      'm15.1 10.1-1.4.8',
      'M16.7 20.8c-2.6-.4-4.6-2.6-4.7-5.3-.2 2.6-2.1 4.8-4.7 5.2',
      'M12 13.9v1.6',
      'M13.5 5.4c-1-.2-2-.2-3 0',
      'M17 16.4c.7-.7 1.2-1.6 1.5-2.5',
      'M5.5 13.9c.3.9.8 1.8 1.5 2.5',
    ],
  },
  slow: {
    kind: 'slow',
    label: 'Lentidão',
    group: 'debuff',
    amount: null,
    paths: [
      'M2 13a6 6 0 1 0 12 0 4 4 0 1 0-8 0 2 2 0 0 0 4 0',
      'M2 13a8 8 0 1 0 16 0a8 8 0 1 0 -16 0',
      'M2 21h12c4.4 0 8-3.6 8-8V7a2 2 0 1 0-4 0v6',
      'M18 3 19.1 5.2',
      'M22 3 20.9 5.2',
    ],
  },
  'mind-control': {
    kind: 'mind-control',
    label: 'Controle mental',
    group: 'debuff',
    amount: null,
    paths: [
      'M12 18V5',
      'M15 13a4.17 4.17 0 01-3-4 4.17 4.17 0 01-3 4',
      'M17.707 6.294A3 3 0 1012 5a3 3 0 10-5.707 1.294',
      'M17.996 5.125a4 4 0 012.526 5.77',
      'M18 18a4 4 0 002-7.465',
      'M19.967 17.482a4 4 0 11-7.967.517 4 4 0 11-7.967-.517',
      'M6 18a4 4 0 01-2-7.465',
      'M6.004 5.125a4 4 0 00-2.526 5.77',
    ],
  },
  blind: {
    kind: 'blind',
    label: 'Cego',
    group: 'debuff',
    amount: null,
    paths: [
      'M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49',
      'M14.084 14.158a3 3 0 0 1-4.242-4.242',
      'M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143',
      'm2 2 20 20',
    ],
  },
  burning: {
    kind: 'burning',
    label: 'Queimação',
    group: 'debuff',
    amount: 'damage',
    paths: [
      'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4',
    ],
  },
  confused: {
    kind: 'confused',
    label: 'Confuso',
    group: 'debuff',
    amount: null,
    paths: [
      'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0',
      'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3',
      'M12 17h.01',
    ],
  },
  death: {
    kind: 'death',
    label: 'Morte',
    group: 'debuff',
    amount: null,
    paths: [
      'm12.5 17-.5-1-.5 1h1z',
      'M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z',
      'M14 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
      'M8 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
    ],
  },
  giant: {
    kind: 'giant',
    label: 'Gigantificação',
    group: 'buff',
    amount: null,
    paths: [
      'm15 15 6 6',
      'm15 9 6-6',
      'M21 16v5h-5',
      'M21 8V3h-5',
      'M3 16v5h5',
      'm3 21 6-6',
      'M3 8V3h5',
      'M9 9 3 3',
    ],
  },
  invisible: {
    kind: 'invisible',
    label: 'Invisibilidade',
    group: 'buff',
    amount: null,
    paths: [
      'M15 10v1',
      'M7.528 20.472a1.6 1.6 0 012.277 0l1.057 1.056a1.6 1.6 0 002.276 0l1.057-1.056a1.6 1.6 0 012.277 0l1.114 1.114a1.4 1.4 0 002.414-1V10a8 8 0 00-16 0v10.586a1.4 1.4 0 002.414 1z',
      'M9 10v1',
    ],
  },
  immune: {
    kind: 'immune',
    label: 'Imunidade',
    group: 'buff',
    amount: null,
    paths: [SHIELD, 'm9 12 2 2 4-4'],
  },
  haste: {
    kind: 'haste',
    label: 'Haste',
    group: 'buff',
    amount: null,
    paths: [
      'M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z',
    ],
  },
  'damage-reduction': {
    kind: 'damage-reduction',
    label: 'Redução de dano',
    group: 'buff',
    amount: 'value',
    paths: [SHIELD, 'M9 12h6'],
  },
  'iron-skin': {
    kind: 'iron-skin',
    label: 'Pele de ferro',
    group: 'buff',
    amount: 'value',
    paths: [
      'M7 10H6a4 4 0 0 1-4-4 1 1 0 0 1 1-1h4',
      'M7 5a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1 7 7 0 0 1-7 7H8a1 1 0 0 1-1-1z',
      'M9 12v5',
      'M15 12v5',
      'M5 20a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3 1 1 0 0 1-1 1H6a1 1 0 0 1-1-1',
    ],
  },
  regeneration: {
    kind: 'regeneration',
    label: 'Regeneração',
    group: 'buff',
    amount: 'heal',
    paths: [
      'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5',
      'M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27',
    ],
  },
};

export const DEBUFFS = DEBUFF_KINDS.map((kind) => STATUS_INFO[kind]);
export const BUFFS = BUFF_KINDS.map((kind) => STATUS_INFO[kind]);

export interface StatusGroupInfo {
  id: StatusGroup;
  label: string;
  title: string;
  items: readonly StatusInfo[];
  paths: readonly string[];
}

export const STATUS_GROUPS: readonly StatusGroupInfo[] = [
  {
    id: 'debuff',
    label: 'Debuff',
    title: 'Debuffs',
    items: DEBUFFS,
    paths: ['M16 17h6v-6', 'm22 17-8.5-8.5-5 5L2 7'],
  },
  {
    id: 'buff',
    label: 'Buff',
    title: 'Buffs',
    items: BUFFS,
    paths: ['M16 7h6v6', 'm22 7-8.5 8.5-5-5L2 17'],
  },
];

export const AMOUNT_LABEL: Record<StatusAmount, string> = {
  damage: 'Dano por turno',
  heal: 'Cura por turno',
  value: 'Valor',
};

export function turnsLabel(turns: number | null): string {
  if (turns === null) {
    return 'Sem limite';
  }
  return turns === 1 ? '1 turno' : `${turns} turnos`;
}

export function statusDetail(status: TableStatus): string {
  const parts = [turnsLabel(status.turns)];
  if (status.amount) {
    parts.push(status.amount);
  }
  if (status.immuneTo.length > 0) {
    parts.push(status.immuneTo.map((kind) => STATUS_INFO[kind].label).join(', '));
  }
  return parts.join(' · ');
}
