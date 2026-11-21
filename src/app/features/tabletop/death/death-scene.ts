import { DEATH_SAVE_TARGET, DEATH_SAVES, type TableDeathEvent } from '../realtime/table.protocol';

export type DeathVariant = 'fell' | 'rolling' | 'fail' | 'final' | 'woke' | 'revived';

export interface DeathScene {
  seq: number;
  variant: DeathVariant;
  kicker: string;
  title: string;
  detail: string;
  slots: readonly ('failed' | 'current' | 'open')[];
}

export interface DeathNotice {
  id: number;
  title: string;
  detail: string;
}

export const REVEAL_MS = 3_400;
export const ALLY_REVEAL_MS = 2_200;

export const SCENE_MS: Record<DeathVariant, number> = {
  fell: 4_800,
  rolling: REVEAL_MS,
  fail: 4_200,
  final: 6_500,
  woke: 3_600,
  revived: 3_600,
};

function slots(failures: number, attemptsLeft: number, rolling: boolean): DeathScene['slots'] {
  const total = Math.max(DEATH_SAVES, failures + attemptsLeft);
  return Array.from({ length: total }, (_, index) =>
    index < failures ? 'failed' : index === failures && rolling ? 'current' : 'open',
  );
}

export function rollingScene(seq: number, event: TableDeathEvent): DeathScene {
  const before = event.success ? event.failures : Math.max(0, event.failures - 1);
  return {
    seq,
    variant: 'rolling',
    kicker: 'Inconsciente',
    title: 'Teste de morte',
    detail: `Tire ${DEATH_SAVE_TARGET} ou mais no d20`,
    slots: slots(before, DEATH_SAVES - before, true),
  };
}

export function deathScene(seq: number, event: TableDeathEvent): DeathScene {
  const rolled = event.roll === null ? '' : `Você tirou ${event.roll}`;
  switch (event.kind) {
    case 'fell':
      return {
        seq,
        variant: 'fell',
        kicker: 'Inconsciente',
        title: 'Você morreu',
        detail: `${event.attemptsLeft} chances para voltar. Tire ${DEATH_SAVE_TARGET} ou mais no d20`,
        slots: slots(0, event.attemptsLeft, false),
      };
    case 'killed':
      return finalScene(seq, event, '');
    case 'revived':
      return {
        seq,
        variant: 'revived',
        kicker: 'De volta',
        title: 'Você voltou',
        detail: 'Seu personagem está vivo outra vez',
        slots: [],
      };
    case 'save':
      if (event.success) {
        return {
          seq,
          variant: 'woke',
          kicker: rolled,
          title: 'Você está consciente',
          detail: 'Voltou com 1 de vida',
          slots: [],
        };
      }
      return event.attemptsLeft > 0
        ? {
            seq,
            variant: 'fail',
            kicker: rolled,
            title: 'Não foi dessa vez',
            detail:
              event.attemptsLeft === 1 ? 'Resta 1 chance' : `Restam ${event.attemptsLeft} chances`,
            slots: slots(event.failures, event.attemptsLeft, false),
          }
        : finalScene(seq, event, rolled);
  }
}

function finalScene(seq: number, event: TableDeathEvent, kicker: string): DeathScene {
  return {
    seq,
    variant: 'final',
    kicker: kicker || 'Fim da linha',
    title: 'Você morreu',
    detail: 'Só o mestre pode trazer você de volta',
    slots: event.kind === 'save' ? slots(event.failures, 0, false) : [],
  };
}

export function deathNotice(id: number, event: TableDeathEvent): DeathNotice {
  const name = event.label;
  switch (event.kind) {
    case 'fell':
      return { id, title: `${name} caiu`, detail: `${event.attemptsLeft} chances para voltar` };
    case 'killed':
      return { id, title: `${name} morreu`, detail: 'Só o mestre traz de volta' };
    case 'revived':
      return { id, title: `${name} voltou`, detail: 'Está vivo outra vez' };
    case 'save':
      if (event.success) {
        return { id, title: `${name} voltou a si`, detail: `Tirou ${event.roll}` };
      }
      return event.attemptsLeft > 0
        ? {
            id,
            title: `${name} falhou no teste de morte`,
            detail: event.attemptsLeft === 1 ? 'Resta 1 chance' : `Restam ${event.attemptsLeft}`,
          }
        : { id, title: `${name} morreu`, detail: 'Falhou nos testes de morte' };
  }
}
