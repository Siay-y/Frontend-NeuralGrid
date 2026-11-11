import type { MessageAudience } from '../realtime/table.protocol';
import {
  HIDDEN_NAME,
  sheetRollAudience,
  sheetRoller,
  sheetRollName,
  type SheetRoller,
} from './sheet-roller';
import { type CharacterSheet, newSheetData } from './sheet-model';

const everyone: MessageAudience = { visibility: 'public', recipientId: null };
const whisper: MessageAudience = { visibility: 'whisper', recipientId: 'ana' };
const roller = (changes: Partial<SheetRoller> = {}): SheetRoller => ({
  name: 'Dragão Ancião',
  hidden: false,
  nameHidden: false,
  ...changes,
});

describe('sheet rolls', () => {
  it('keeps the chosen audience and the name of a visible character', () => {
    const visible = roller();
    expect(sheetRollAudience(visible, everyone)).toBe(everyone);
    expect(sheetRollName(visible, everyone)).toBe('Dragão Ancião');
  });

  it('sends the rolls of a hidden character to the masters only', () => {
    const hidden = roller({ hidden: true });
    for (const chosen of [everyone, whisper]) {
      expect(sheetRollAudience(hidden, chosen)).toEqual({ visibility: 'gm', recipientId: null });
    }
  });

  it('hides the name from players while it is hidden', () => {
    const masked = roller({ nameHidden: true });
    expect(sheetRollAudience(masked, everyone)).toBe(everyone);
    expect(sheetRollName(masked, everyone)).toBe(HIDDEN_NAME);
    expect(sheetRollName(masked, whisper)).toBe(HIDDEN_NAME);
    expect(sheetRollName(masked, { visibility: 'gm', recipientId: null })).toBe('Dragão Ancião');
  });

  it('reads the flags and the name from the sheet', () => {
    const sheet = {
      id: 's1',
      ownerId: null,
      kind: 'threat',
      data: newSheetData('  Lich  '),
      hidden: true,
      nameHidden: true,
      statsHidden: true,
      version: 1,
    } as CharacterSheet;
    expect(sheetRoller(sheet)).toEqual({ name: 'Lich', hidden: true, nameHidden: true });
    expect(sheetRoller(sheet, 'Rascunho').name).toBe('Rascunho');
  });
});
