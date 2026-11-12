import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { describeReach, FOG_RADIUS } from '../maps/fog-light';
import { TableState } from '../realtime/table-state';

const RADIUS_COMMIT_MS = 300;

@Component({
  selector: 'app-settings-panel',
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPanel {
  protected readonly table = inject(TableState);
  protected readonly fog = this.table.fog;
  protected readonly limits = FOG_RADIUS;
  protected readonly describeReach = describeReach;
  private radiusTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.flushRadius());
  }

  protected toggleFog(): void {
    void this.table.updateFog({ enabled: !this.fog().enabled });
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
