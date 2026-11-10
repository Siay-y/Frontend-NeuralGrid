import type { DiceTermResult, RollResult } from '../realtime/table.protocol';

export const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;

export const DICE_QUANTITY_MAX = 10;

export const ANIMATED_DICE_LIMIT = 30;

export function previewColumns(count: number): number {
  if (count <= 4) {
    return Math.max(1, count);
  }
  if (count <= 8) {
    return 4;
  }
  return count <= 18 ? 6 : 8;
}

export type DieShape = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20';

export interface AnimatedDie {
  shape: DieShape;
  labels: string[];
  resultIndex: number;
  dropped: boolean;
  paired: boolean;
  critical: boolean;
}

export const CRITICAL_FAILURE_MIN_SIDES = 6;

export function isCriticalFailure(sides: number, value: number): boolean {
  return sides >= CRITICAL_FAILURE_MIN_SIDES && value === 1;
}

export function hasCriticalFailure(roll: RollResult): boolean {
  return roll.terms.some(
    (term) =>
      term.kind === 'dice' &&
      term.rolls.some((die) => die.kept && isCriticalFailure(term.sides, die.value)),
  );
}

export function diceNotation(quantity: number, sides: number): string {
  return `${quantity}d${sides}`;
}

function numbered(count: number): string[] {
  return Array.from({ length: count }, (_, index) => String(index + 1));
}

const TENS = Array.from({ length: 10 }, (_, index) => (index === 0 ? '00' : `${index}0`));
const UNITS = Array.from({ length: 10 }, (_, index) => String(index));

function dieFor(sides: number, value: number, dropped: boolean): AnimatedDie[] | null {
  const critical = !dropped && isCriticalFailure(sides, value);
  switch (sides) {
    case 4:
    case 6:
    case 8:
    case 10:
    case 12:
    case 20:
      return [
        {
          shape: `d${sides}`,
          labels: numbered(sides),
          resultIndex: value - 1,
          dropped,
          paired: false,
          critical,
        },
      ];
    case 100: {
      const rest = value % 100;
      return [
        {
          shape: 'd10',
          labels: TENS,
          resultIndex: Math.floor(rest / 10),
          dropped,
          paired: true,
          critical,
        },
        { shape: 'd10', labels: UNITS, resultIndex: rest % 10, dropped, paired: true, critical },
      ];
    }
    default:
      return null;
  }
}

export function animatedDice(roll: RollResult): AnimatedDie[] | null {
  const dice: AnimatedDie[] = [];
  const terms = roll.terms.filter((term): term is DiceTermResult => term.kind === 'dice');
  for (const term of terms) {
    for (const die of term.rolls) {
      const shapes = dieFor(term.sides, die.value, !die.kept);
      if (!shapes) {
        return null;
      }
      dice.push(...shapes);
    }
  }
  return dice.length > 0 && dice.length <= ANIMATED_DICE_LIMIT ? dice : null;
}

export type NaturalResult = 'max' | 'min' | null;

export function naturalResult(roll: RollResult): NaturalResult {
  const d20 = roll.terms.filter(
    (term): term is DiceTermResult => term.kind === 'dice' && term.sides === 20,
  );
  if (d20.length !== 1) {
    return null;
  }
  const kept = d20[0].rolls.filter((die) => die.kept);
  if (kept.length !== 1) {
    return null;
  }
  if (kept[0].value === 20) {
    return 'max';
  }
  return kept[0].value === 1 ? 'min' : null;
}

export type ChatCommand =
  { kind: 'text'; text: string } | { kind: 'roll'; expression: string; label: string | null };

const ROLL_COMMAND = /^\/(?:r|roll)\s+([\dkhld+\-\s]+?)(?:\s+([^\d+\-\s].*))?$/i;

export function parseChatInput(raw: string): ChatCommand | null {
  const text = raw.trim();
  if (text.length === 0) {
    return null;
  }
  if (!/^\/(?:r|roll)(?:\s|$)/i.test(text)) {
    return { kind: 'text', text };
  }
  const match = ROLL_COMMAND.exec(text);
  if (!match) {
    return { kind: 'roll', expression: '', label: null };
  }
  return {
    kind: 'roll',
    expression: match[1].replace(/\s+/g, ''),
    label: match[2]?.trim() || null,
  };
}
