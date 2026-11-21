import { BUFF_KINDS, DEBUFF_KINDS } from '../realtime/table.protocol';
import { BUFFS, DEBUFFS, STATUS_INFO, statusDetail, turnsLabel } from './status-catalog';
import { parseTurns } from './status-form';

describe('status catalog', () => {
  it('gives every status its own icon and keeps debuffs apart from buffs', () => {
    const icons = [...DEBUFFS, ...BUFFS].map(({ paths }) => paths.join(''));

    expect(new Set(icons).size).toBe(DEBUFF_KINDS.length + BUFF_KINDS.length);
    expect(DEBUFFS.every(({ group }) => group === 'debuff')).toBe(true);
    expect(BUFFS.every(({ group }) => group === 'buff')).toBe(true);
    expect(STATUS_INFO.poison.amount).toBe('damage');
    expect(STATUS_INFO.regeneration.amount).toBe('heal');
    expect(STATUS_INFO.blind.amount).toBeNull();
  });

  it('describes the duration, the value and the immunities', () => {
    expect(turnsLabel(null)).toBe('Sem limite');
    expect(turnsLabel(1)).toBe('1 turno');
    expect(statusDetail({ kind: 'poison', turns: 3, amount: '1d6', immuneTo: [] })).toBe(
      '3 turnos · 1d6',
    );
    expect(
      statusDetail({ kind: 'immune', turns: null, amount: null, immuneTo: ['poison', 'blind'] }),
    ).toBe('Sem limite · Veneno, Cego');
  });

  it('reads the turns typed by the master', () => {
    expect(parseTurns('')).toBeNull();
    expect(parseTurns(' 4 ')).toBe(4);
    expect(parseTurns('0')).toBeUndefined();
    expect(parseTurns('100')).toBeUndefined();
    expect(parseTurns('1.5')).toBeUndefined();
  });
});
