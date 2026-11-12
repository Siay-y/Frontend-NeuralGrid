import type { TableToken } from '../realtime/table.protocol';
import { combatIntro } from './combat-cues';

const token = (id: string, ownerId: string | null): TableToken => ({
  id,
  label: id,
  kind: 'agent',
  icon: null,
  sex: null,
  hidden: false,
  nameHidden: false,
  emitsLight: true,
  ownerId,
  sheetId: null,
  col: 0,
  row: 0,
  size: 1,
  version: 1,
});

const tokens = new Map([
  ['Lich', token('Lich', null)],
  ['Kael', token('Kael', 'luiz')],
]);

describe('combatIntro', () => {
  it('tells the player where each of their characters stands and who starts', () => {
    const intro = combatIntro(
      1,
      {
        round: 1,
        turnId: 'Lich',
        combatants: [
          { tokenId: 'Lich', initiative: 18, hidden: false },
          { tokenId: 'Kael', initiative: 12, hidden: false },
        ],
      },
      (id) => tokens.get(id),
      'luiz',
    );

    expect(intro).toEqual({
      seq: 1,
      round: 1,
      places: [{ label: 'Kael', position: 2, initiative: 12 }],
      first: 'Lich',
      firstIsMine: false,
    });
  });

  it('has no place to show for a player without a character in the fight', () => {
    const intro = combatIntro(
      3,
      { round: 1, turnId: 'Lich', combatants: [{ tokenId: 'Lich', initiative: 9, hidden: false }] },
      (id) => tokens.get(id),
      'gabriel',
    );

    expect(intro.places).toEqual([]);
  });

  it('notices when the player opens the fight', () => {
    const intro = combatIntro(
      2,
      {
        round: 1,
        turnId: 'Kael',
        combatants: [{ tokenId: 'Kael', initiative: 20, hidden: false }],
      },
      (id) => tokens.get(id),
      'luiz',
    );

    expect(intro.firstIsMine).toBe(true);
  });
});
