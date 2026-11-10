import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideChevronDown } from '@lucide/angular';

let nextId = 0;

@Component({
  selector: 'app-collapsible',
  imports: [LucideChevronDown],
  templateUrl: './collapsible.html',
  styleUrl: './collapsible.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-open]': 'open()' },
})
export class Collapsible {
  readonly title = input.required<string>();
  readonly open = input(true);
  readonly toggled = output<void>();

  protected readonly bodyId = `collapsible-${++nextId}`;
}
