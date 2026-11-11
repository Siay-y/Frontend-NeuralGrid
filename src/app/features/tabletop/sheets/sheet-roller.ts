import { inject } from '@angular/core';
import { toAudience } from '../chat/audience';
import type { MessageAudience } from '../realtime/table.protocol';
import { TableState } from '../realtime/table-state';
import { TabletopStore } from '../tabletop.store';
import { type CharacterSheet, rollLabel } from './sheet-model';

export interface SheetRoller {
  name: string;
  hidden: boolean;
  nameHidden: boolean;
}

export const HIDDEN_NAME = '???';

const MASTERS_ONLY: MessageAudience = { visibility: 'gm', recipientId: null };

export function sheetRoller(sheet: CharacterSheet, name?: string): SheetRoller {
  return {
    name: name ?? (sheet.data.identity.name.trim() || 'Sem nome'),
    hidden: sheet.hidden,
    nameHidden: sheet.nameHidden,
  };
}

export function sheetRollAudience(roller: SheetRoller, chosen: MessageAudience): MessageAudience {
  return roller.hidden ? MASTERS_ONLY : chosen;
}

export function sheetRollName(roller: SheetRoller, audience: MessageAudience): string {
  return roller.nameHidden && audience.visibility !== 'gm' ? HIDDEN_NAME : roller.name;
}

export function injectSheetRoll(): (
  roller: SheetRoller,
  expression: string,
  subject: string,
) => void {
  const table = inject(TableState);
  const store = inject(TabletopStore);
  return (roller, expression, subject) => {
    const audience = sheetRollAudience(roller, toAudience(store.chatAudience()));
    void table.rollDice(expression, rollLabel(sheetRollName(roller, audience), subject), audience);
  };
}
