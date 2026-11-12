import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CombatIntro } from './combat-cues';

@Component({
  selector: 'app-combat-intro-band',
  templateUrl: './combat-intro-band.html',
  styleUrl: './combat-intro-band.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CombatIntroBand {
  readonly intro = input.required<CombatIntro>();
}
