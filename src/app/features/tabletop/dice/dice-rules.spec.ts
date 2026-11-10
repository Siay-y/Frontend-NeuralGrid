import type { RollResult } from '../realtime/table.protocol';
import {
  animatedDice,
  diceNotation,
  hasCriticalFailure,
  naturalResult,
  parseChatInput,
  previewColumns,
} from './dice-rules';

function roll(sides: number, values: number[], keptIndexes = values.map((_, i) => i)): RollResult {
  return {
    label: null,
    notation: `${values.length}d${sides}`,
    total: values.reduce((sum, value) => sum + value, 0),
    terms: [
      {
        kind: 'dice',
        sign: 1,
        count: values.length,
        sides,
        keep: null,
        rolls: values.map((value, index) => ({ value, kept: keptIndexes.includes(index) })),
        subtotal: 0,
      },
    ],
  };
}

describe('diceNotation', () => {
  it('writes quantity and faces', () => {
    expect(diceNotation(1, 20)).toBe('1d20');
    expect(diceNotation(3, 6)).toBe('3d6');
  });
});

describe('animatedDice', () => {
  it('turns each rolled die into a shape with its face to show', () => {
    expect(animatedDice(roll(20, [17]))).toEqual([
      expect.objectContaining({ shape: 'd20', resultIndex: 16, dropped: false }),
    ]);
  });

  it('splits a d100 into a tens die and a units die', () => {
    const [tens, units] = animatedDice(roll(100, [47]))!;

    expect(tens.labels[tens.resultIndex]).toBe('40');
    expect(units.labels[units.resultIndex]).toBe('7');
  });

  it('shows 00 and 0 for a d100 that rolled 100', () => {
    const [tens, units] = animatedDice(roll(100, [100]))!;

    expect(tens.labels[tens.resultIndex]).toBe('00');
    expect(units.labels[units.resultIndex]).toBe('0');
  });

  it('marks the d100 halves as a pair', () => {
    expect(animatedDice(roll(100, [47]))!.every((die) => die.paired)).toBe(true);
    expect(animatedDice(roll(20, [3]))![0].paired).toBe(false);
  });

  it('paints a 1 red from the d6 up, but not on a d4 or a dropped die', () => {
    expect(animatedDice(roll(6, [1]))![0].critical).toBe(true);
    expect(animatedDice(roll(20, [1, 9], [0]))!.map((die) => die.critical)).toEqual([true, false]);
    expect(animatedDice(roll(100, [1]))!.every((die) => die.critical)).toBe(true);
    expect(animatedDice(roll(4, [1]))![0].critical).toBe(false);
    expect(animatedDice(roll(20, [1, 9], [1]))![0].critical).toBe(false);
  });

  it('marks dropped dice', () => {
    const dice = animatedDice(roll(20, [4, 15], [1]))!;
    expect(dice.map((die) => die.dropped)).toEqual([true, false]);
  });

  it('animates a full ten d100 roll as twenty dice', () => {
    const values = Array.from({ length: 10 }, (_, index) => index * 10 + 5);
    expect(animatedDice(roll(100, values))).toHaveLength(20);
  });

  it('skips the animation for dice it cannot draw or for too many dice', () => {
    expect(animatedDice(roll(7, [3]))).toBeNull();
    expect(
      animatedDice(
        roll(
          6,
          Array.from({ length: 31 }, () => 1),
        ),
      ),
    ).toBeNull();
  });
});

describe('previewColumns', () => {
  it('widens the grid as the roll grows, keeping d100 pairs on one row', () => {
    expect([1, 3, 4, 6, 8, 10, 18, 20, 30].map(previewColumns)).toEqual([
      1, 3, 4, 4, 4, 6, 6, 8, 8,
    ]);
  });
});

describe('naturalResult', () => {
  it('flags a kept natural 20 and a kept natural 1', () => {
    expect(naturalResult(roll(20, [3, 20], [1]))).toBe('max');
    expect(naturalResult(roll(20, [1]))).toBe('min');
  });

  it('ignores a 20 that was not kept', () => {
    expect(naturalResult(roll(20, [20, 12], [1]))).toBeNull();
  });
});

describe('parseChatInput', () => {
  it('treats plain text as a message', () => {
    expect(parseChatInput('  boa noite  ')).toEqual({ kind: 'text', text: 'boa noite' });
    expect(parseChatInput('   ')).toBeNull();
  });

  it('reads a roll command with an optional label', () => {
    expect(parseChatInput('/r 1d20+5')).toEqual({
      kind: 'roll',
      expression: '1d20+5',
      label: null,
    });
    expect(parseChatInput('/r 2d6 + 3 Espada curta')).toEqual({
      kind: 'roll',
      expression: '2d6+3',
      label: 'Espada curta',
    });
  });

  it('returns an empty expression when the command has no dice', () => {
    expect(parseChatInput('/r')).toEqual({ kind: 'roll', expression: '', label: null });
  });

  it('does not mistake a word that starts with r for a command', () => {
    expect(parseChatInput('/rindo')).toEqual({ kind: 'text', text: '/rindo' });
  });
});

describe('hasCriticalFailure', () => {
  it('spots a kept 1 on a d6 or bigger', () => {
    expect(hasCriticalFailure(roll(6, [4, 1]))).toBe(true);
    expect(hasCriticalFailure(roll(4, [1]))).toBe(false);
    expect(hasCriticalFailure(roll(20, [1, 15], [1]))).toBe(false);
  });
});
