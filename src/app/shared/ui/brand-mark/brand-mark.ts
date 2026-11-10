import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-brand-mark',
  templateUrl: './brand-mark.html',
  styleUrl: './brand-mark.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--brand-size.px]': 'size()' },
})
export class BrandMark {
  readonly size = input(24);
}
