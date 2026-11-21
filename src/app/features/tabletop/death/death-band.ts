import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { DeathScene } from './death-scene';

const DARK = new Set(['fell', 'final']);
const LIGHT = new Set(['woke', 'revived']);

@Component({
  selector: 'app-death-band',
  templateUrl: './death-band.html',
  styleUrl: './death-band.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-variant]': 'scene().variant',
    '[class.is-dark]': 'dark()',
    '[class.is-light]': 'light()',
  },
})
export class DeathBand {
  readonly scene = input.required<DeathScene>();

  protected readonly dark = computed(() => DARK.has(this.scene().variant));
  protected readonly light = computed(() => LIGHT.has(this.scene().variant));
}
