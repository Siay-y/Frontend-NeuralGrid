import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideArrowUpRight } from '@lucide/angular';
import { AUTHOR } from '../../../core/release/credits';
import { CHANGE_KIND_LABEL, RELEASES } from '../../../core/release/release-notes';
import { ReleaseService } from '../../../core/release/release.service';
import { formatReleaseDate } from './release-date';

@Component({
  selector: 'app-updates-panel',
  imports: [LucideArrowUpRight],
  templateUrl: './updates-panel.html',
  styleUrl: './updates-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdatesPanel {
  protected readonly releases = RELEASES;
  protected readonly kindLabel = CHANGE_KIND_LABEL;
  protected readonly formatDate = formatReleaseDate;
  protected readonly author = AUTHOR;

  constructor() {
    inject(ReleaseService).markSeen();
  }
}
