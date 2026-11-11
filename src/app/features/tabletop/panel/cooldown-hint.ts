import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Cooldown } from '../realtime/cooldown';

@Component({
  selector: 'app-cooldown-hint',
  templateUrl: './cooldown-hint.html',
  styleUrl: './cooldown-hint.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status' },
})
export class CooldownHint {
  readonly cooldown = input.required<Cooldown>();
  readonly action = input.required<string>();
}
