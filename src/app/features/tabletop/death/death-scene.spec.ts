import type { TableDeathEvent } from '../realtime/table.protocol';
import { deathNotice, deathScene, rollingScene } from './death-scene';

const event = (changes: Partial<TableDeathEvent>): TableDeathEvent => ({
  kind: 'fell',
  tokenId: 'kael',
  label: 'Kael',
  ownerId: 'luiz',
  hidden: false,
  nameHidden: false,
  attemptsLeft: 3,
  failures: 0,
  roll: null,
  success: null,
  message: null,
  ...changes,
});

describe('death scenes', () => {
  it('tells the fallen player how many chances are left', () => {
    expect(deathScene(1, event({}))).toMatchObject({
      variant: 'fell',
      title: 'Você morreu',
      slots: ['open', 'open', 'open'],
    });
  });

  it('marks the failed attempts and the one being rolled', () => {
    const failed = event({ kind: 'save', roll: 9, success: false, attemptsLeft: 1, failures: 2 });

    expect(rollingScene(1, failed).slots).toEqual(['failed', 'current', 'open']);
    expect(deathScene(2, failed)).toMatchObject({
      variant: 'fail',
      kicker: 'Você tirou 9',
      title: 'Não foi dessa vez',
      detail: 'Resta 1 chance',
      slots: ['failed', 'failed', 'open'],
    });
  });

  it('wakes up on a success and dies for good on the last failure', () => {
    expect(
      deathScene(1, event({ kind: 'save', roll: 17, success: true, attemptsLeft: 0, failures: 1 })),
    ).toMatchObject({ variant: 'woke', title: 'Você está consciente' });
    expect(
      deathScene(1, event({ kind: 'save', roll: 3, success: false, attemptsLeft: 0, failures: 3 })),
    ).toMatchObject({
      variant: 'final',
      detail: 'Só o mestre pode trazer você de volta',
      slots: ['failed', 'failed', 'failed'],
    });
    expect(deathScene(1, event({ kind: 'killed', attemptsLeft: 0 })).variant).toBe('final');
    expect(deathScene(1, event({ kind: 'revived' })).title).toBe('Você voltou');
  });

  it('tells the allies who fell, failed, woke up or died', () => {
    expect(deathNotice(1, event({})).title).toBe('Kael caiu');
    expect(
      deathNotice(
        2,
        event({ kind: 'save', success: false, roll: 4, attemptsLeft: 2, failures: 1 }),
      ),
    ).toMatchObject({ title: 'Kael falhou no teste de morte', detail: 'Restam 2' });
    expect(deathNotice(3, event({ kind: 'save', success: true, roll: 20 })).title).toBe(
      'Kael voltou a si',
    );
    expect(deathNotice(4, event({ kind: 'killed' })).title).toBe('Kael morreu');
  });
});
