import type { TableCombat, TableToken } from '../realtime/table.protocol';
import { upcomingTurns } from './turn-hud';

const token = (id: string): TableToken => ({
  id,
  label: id,
  kind: 'npc',
  icon: null,
  sex: null,
  hidden: false,
  nameHidden: false,
  emitsLight: true,
  ownerId: null,
  sheetId: null,
  col: 0,
  row: 0,
  size: 1,
  version: 1,
});

const tokens = new Map(['Kael', 'Lich', 'Mira'].map((id) => [id, token(id)]));
const combat = (turnId: string | null, ids = ['Kael', 'Lich', 'Mira']): TableCombat => ({
  round: 2,
  turnId,
  combatants: ids.map((tokenId) => ({ tokenId, initiative: null, hidden: false })),
});
const lookup = (id: string) => tokens.get(id);
const summary = (turns: ReturnType<typeof upcomingTurns>) =>
  turns.map(({ token: { id }, current, nextRound }) => [id, current, nextRound]);

describe('upcomingTurns', () => {
  it('starts at the current turn and wraps into the next round', () => {
    expect(summary(upcomingTurns(combat('Lich'), lookup, 5))).toEqual([
      ['Lich', true, false],
      ['Mira', false, false],
      ['Kael', false, true],
    ]);
  });

  it('stops at the limit and skips tokens that are gone', () => {
    expect(
      summary(upcomingTurns(combat('Mira', ['Kael', 'Ghost', 'Lich', 'Mira']), lookup, 2)),
    ).toEqual([
      ['Mira', true, false],
      ['Kael', false, true],
    ]);
  });

  it('lists the order without a current turn when the turn is hidden', () => {
    expect(summary(upcomingTurns(combat(null), lookup, 5))).toEqual([
      ['Kael', false, false],
      ['Lich', false, false],
      ['Mira', false, false],
    ]);
  });
});
