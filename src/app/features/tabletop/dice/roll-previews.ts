import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RollFeed } from './roll-feed';
import { RollPreviewCard } from './roll-preview';

@Component({
  selector: 'app-roll-previews',
  imports: [RollPreviewCard],
  templateUrl: './roll-previews.html',
  styleUrl: './roll-previews.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RollPreviews {
  protected readonly feed = inject(RollFeed);
}
