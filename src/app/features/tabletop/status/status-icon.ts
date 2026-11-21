import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { StatusKind } from '../realtime/table.protocol';
import { STATUS_INFO } from './status-catalog';

@Component({
  selector: 'app-status-icon',
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    [attr.width]="size()"
    [attr.height]="size()"
  >
    @for (path of paths(); track $index) {
      <path [attr.d]="path" />
    }
  </svg>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: inline-flex; flex-shrink: 0' },
})
export class StatusIcon {
  readonly kind = input<StatusKind | null>(null);
  readonly custom = input<readonly string[]>([]);
  readonly size = input(16);

  protected readonly paths = computed(() => {
    const kind = this.kind();
    return kind ? STATUS_INFO[kind].paths : this.custom();
  });
}
