import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  AppearanceService,
  GLASS_RANGE,
  glassLabel,
} from '../../../core/appearance/appearance.service';
import { describeReach, FOG_RADIUS } from '../maps/fog-light';
import { Collapsible } from '../panel/collapsible';
import { TableState } from '../realtime/table-state';
import { TabletopStore } from '../tabletop.store';

const RADIUS_COMMIT_MS = 300;
const FORGET_CONFIRM_MS = 3_000;

@Component({
  selector: 'app-settings-panel',
  imports: [Collapsible],
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPanel {
  protected readonly table = inject(TableState);
  protected readonly store = inject(TabletopStore);
  protected readonly appearance = inject(AppearanceService);
  protected readonly fog = this.table.fog;
  protected readonly limits = FOG_RADIUS;
  protected readonly glassRange = GLASS_RANGE;
  protected readonly glassLabel = glassLabel;
  protected readonly describeReach = describeReach;
  protected readonly confirmingForget = signal(false);
  private radiusTimer: ReturnType<typeof setTimeout> | undefined;
  private forgetTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.forgetTimer);
      this.flushRadius();
    });
  }

  protected toggleFog(): void {
    void this.table.updateFog({ enabled: !this.fog().enabled });
  }

  protected toggleMemory(): void {
    void this.table.updateFog({ memory: !this.fog().memory });
  }

  protected forget(): void {
    clearTimeout(this.forgetTimer);
    if (!this.confirmingForget()) {
      this.confirmingForget.set(true);
      this.forgetTimer = setTimeout(() => this.confirmingForget.set(false), FORGET_CONFIRM_MS);
      return;
    }
    this.confirmingForget.set(false);
    void this.table.forgetExplored();
  }

  protected setGlass(event: Event): void {
    this.appearance.setGlass(Number((event.target as HTMLInputElement).value));
  }

  protected setRadius(event: Event): void {
    const radius = Number((event.target as HTMLInputElement).value);
    if (!Number.isInteger(radius) || radius === this.fog().radius) {
      return;
    }
    this.table.previewFog({ radius });
    clearTimeout(this.radiusTimer);
    this.radiusTimer = setTimeout(() => this.flushRadius(), RADIUS_COMMIT_MS);
  }

  private flushRadius(): void {
    if (this.radiusTimer === undefined) {
      return;
    }
    clearTimeout(this.radiusTimer);
    this.radiusTimer = undefined;
    void this.table.updateFog({ radius: this.fog().radius });
  }
}
