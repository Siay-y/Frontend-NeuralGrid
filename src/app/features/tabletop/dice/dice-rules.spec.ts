import type { RollResult } from '../realtime/table.protocol';
import {
  animatedDice,
  diceNotation,
  dieOutcome,
  formatBonus,
  parseBonus,
  parseChatInput,
  previewColumns,
  rollHighlights,
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

  it('rolls a d100 as one die with a hundred faces', () => {
    const dice = animatedDice(roll(100, [47, 100, 1]))!;

    expect(dice).toHaveLength(3);
    expect(dice.every((die) => die.shape === 'd100' && die.labels.length === 100)).toBe(true);
    expect(dice.map((die) => die.labels[die.resultIndex])).toEqual(['47', '100', '1']);
    expect(new Set(dice[0].labels).size).toBe(100);
  });

  it('paints a kept 1 red and a kept top face blue, on every die from the d4 up', () => {
    const outcomes = (sides: number, values: number[], kept?: number[]) =>
      animatedDice(roll(sides, values, kept))!.map((die) => die.outcome);

    expect(outcomes(4, [1, 4, 2])).toEqual(['failure', 'success', null]);
    expect(outcomes(12, [12])).toEqual(['success']);
    expect(outcomes(100, [100, 1])).toEqual(['success', 'failure']);
    expect(outcomes(20, [20, 1], [1])).toEqual([null, 'failure']);
  });

  it('marks dropped dice', () => {
    const dice = animatedDice(roll(20, [4, 15], [1]))!;
    expect(dice.map((die) => die.dropped)).toEqual([true, false]);
  });

  it('animates a full ten d100 roll as ten dice', () => {
    const values = Array.from({ length: 10 }, (_, index) => index * 10 + 5);
    expect(animatedDice(roll(100, values))).toHaveLength(10);
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
  it('widens the grid as the roll grows', () => {
    expect([1, 3, 4, 6, 8, 10, 18, 20, 30].map(previewColumns)).toEqual([
      1, 3, 4, 4, 4, 6, 6, 8, 8,
    ]);
  });
});

describe('dieOutcome', () => {
  it('reads the lowest and highest face of each die', () => {
    expect(dieOutcome(6, 6)).toBe('success');
    expect(dieOutcome(4, 1)).toBe('failure');
    expect(dieOutcome(20, 13)).toBeNull();
    expect(dieOutcome(2, 2)).toBeNull();
  });
});

describe('rollHighlights', () => {
  it('summarises the kept dice and ignores dropped ones', () => {
    expect(rollHighlights(roll(6, [6, 1]))).toEqual({ success: true, failure: true });
    expect(rollHighlights(roll(20, [20, 12], [1]))).toEqual({ success: false, failure: false });
  });
});

describe('bonus', () => {
  it('adds the bonus to the notation with its sign', () => {
    expect(diceNotation(2, 20, 5)).toBe('2d20+5');
    expect(diceNotation(1, 6, -2)).toBe('1d6-2');
    expect(diceNotation(1, 6, 0)).toBe('1d6');
  });

  it('reads what the player types and keeps it within the limit', () => {
    expect(parseBonus('+7')).toBe(7);
    expect(parseBonus(' - 3 ')).toBe(-3);
    expect(parseBonus('250')).toBe(99);
    expect(parseBonus('abc')).toBe(0);
    expect(formatBonus(4)).toBe('+4');
    expect(formatBonus(-4)).toBe('-4');
    expect(formatBonus(0)).toBe('0');
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
