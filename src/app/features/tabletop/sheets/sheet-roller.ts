import { inject } from '@angular/core';
import { toAudience } from '../chat/audience';
import { TableState } from '../realtime/table-state';
import { TabletopStore } from '../tabletop.store';

export function injectSheetRoll(): (expression: string, label: string) => void {
  const table = inject(TableState);
  const store = inject(TabletopStore);
  return (expression, label) => {
    void table.rollDice(expression, label, toAudience(store.chatAudience()));
  };
}
