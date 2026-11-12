import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { LucideDynamicIcon, LucideX } from '@lucide/angular';
import type { TablePanel } from '../tabletop.models';
import { TabletopStore } from '../tabletop.store';
import { ChatPanel } from '../chat/chat-panel';
import { DicePanel } from '../dice/dice-panel';
import { MapsPanel } from '../maps/maps-panel';
import { SettingsPanel } from '../settings/settings-panel';
import { SheetsPanel } from '../sheets/sheets-panel';
import { TokensPanel } from '../tokens/tokens-panel';
import { UpdatesPanel } from '../updates/updates-panel';

@Component({
  selector: 'app-table-panel',
  imports: [
    LucideDynamicIcon,
    LucideX,
    ChatPanel,
    DicePanel,
    MapsPanel,
    SettingsPanel,
    SheetsPanel,
    TokensPanel,
    UpdatesPanel,
  ],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablePanelView {
  protected readonly store = inject(TabletopStore);
  readonly panel = input.required<TablePanel>();
}
