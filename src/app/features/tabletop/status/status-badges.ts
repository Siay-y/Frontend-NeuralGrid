import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { TableStatus } from '../realtime/table.protocol';
import { STATUS_INFO, statusDetail } from './status-catalog';
import { StatusIcon } from './status-icon';

@Component({
  selector: 'app-status-badges',
  imports: [StatusIcon],
  templateUrl: './status-badges.html',
  styleUrl: './status-badges.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadges {
  readonly statuses = input.required<readonly TableStatus[]>();

  protected readonly badges = computed(() =>
    this.statuses().map((status) => {
      const info = STATUS_INFO[status.kind];
      return {
        status,
        title: `${info.label} · ${statusDetail(status)}`,
      };
    }),
  );
  protected readonly summary = computed(() =>
    this.badges()
      .map(({ title }) => title)
      .join(', '),
  );
}
