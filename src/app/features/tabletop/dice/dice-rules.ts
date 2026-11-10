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

export type DieShape = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export type DieOutcome = 'failure' | 'success' | null;

export interface AnimatedDie {
  shape: DieShape;
  labels: readonly string[];
  resultIndex: number;
  dropped: boolean;
  outcome: DieOutcome;
}

export const CRITICAL_MIN_SIDES = 4;

export const BONUS_LIMIT = 99;

export function dieOutcome(sides: number, value: number): DieOutcome {
  if (sides < CRITICAL_MIN_SIDES) {
    return null;
  }
  if (value === 1) {
    return 'failure';
  }
  return value === sides ? 'success' : null;
}

export interface RollHighlights {
  failure: boolean;
  success: boolean;
}

export function rollHighlights(roll: RollResult): RollHighlights {
  const outcomes = roll.terms.flatMap((term) =>
    term.kind === 'dice'
      ? term.rolls.filter((die) => die.kept).map((die) => dieOutcome(term.sides, die.value))
      : [],
  );
  return { failure: outcomes.includes('failure'), success: outcomes.includes('success') };
}

export function clampBonus(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(BONUS_LIMIT, Math.max(-BONUS_LIMIT, Math.trunc(value)));
}

export function formatBonus(bonus: number): string {
  return bonus > 0 ? `+${bonus}` : String(bonus);
}

export function parseBonus(raw: string): number {
  const match = /^\s*([+-]?)\s*(\d+)\s*$/.exec(raw);
  if (!match) {
    return 0;
  }
  const value = Number(match[2]);
  return clampBonus(match[1] === '-' ? -value : value);
}

export function diceNotation(quantity: number, sides: number, bonus = 0): string {
  const base = `${quantity}d${sides}`;
  return bonus === 0 ? base : `${base}${formatBonus(bonus)}`;
}

function numbered(count: number): string[] {
  return Array.from({ length: count }, (_, index) => String(index + 1));
}

const D100_STEP = 37;
const D100_LABELS = Array.from({ length: 100 }, (_, index) =>
  String(((index * D100_STEP) % 100) + 1),
);
const SHAPE_LABELS: Readonly<Record<number, readonly string[]>> = {
  4: numbered(4),
  6: numbered(6),
  8: numbered(8),
  10: numbered(10),
  12: numbered(12),
  20: numbered(20),
  100: D100_LABELS,
};

function dieFor(sides: number, value: number, dropped: boolean): AnimatedDie | null {
  const labels = SHAPE_LABELS[sides];
  const resultIndex = labels?.indexOf(String(value)) ?? -1;
  if (!labels || resultIndex < 0) {
    return null;
  }
  return {
    shape: `d${sides}` as DieShape,
    labels,
    resultIndex,
    dropped,
    outcome: dropped ? null : dieOutcome(sides, value),
  };
}

export function animatedDice(roll: RollResult): AnimatedDie[] | null {
  const dice: AnimatedDie[] = [];
  const terms = roll.terms.filter((term): term is DiceTermResult => term.kind === 'dice');
  for (const term of terms) {
    for (const die of term.rolls) {
      const shape = dieFor(term.sides, die.value, !die.kept);
      if (!shape) {
        return null;
      }
      dice.push(shape);
    }
  }
  return dice.length > 0 && dice.length <= ANIMATED_DICE_LIMIT ? dice : null;
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
