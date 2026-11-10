import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LucideArrowUpRight, LucideChevronDown } from '@lucide/angular';
import { AUTHOR } from '../../../core/release/credits';
import { CHANGE_KIND_LABEL, RELEASES } from '../../../core/release/release-notes';
import { ReleaseService } from '../../../core/release/release.service';
import { formatReleaseDate } from './release-date';

@Component({
  selector: 'app-updates-panel',
  imports: [LucideArrowUpRight, LucideChevronDown],
  templateUrl: './updates-panel.html',
  styleUrl: './updates-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdatesPanel {
  protected readonly releases = RELEASES;
  protected readonly kindLabel = CHANGE_KIND_LABEL;
  protected readonly formatDate = formatReleaseDate;
  protected readonly author = AUTHOR;

  private readonly openVersions = signal<ReadonlySet<string>>(
    new Set(RELEASES.slice(0, 1).map((release) => release.version)),
  );

  constructor() {
    inject(ReleaseService).markSeen();
  }

  protected isOpen(version: string): boolean {
    return this.openVersions().has(version);
  }

  protected toggle(version: string): void {
    this.openVersions.update((open) => {
      const next = new Set(open);
      if (!next.delete(version)) {
        next.add(version);
      }
      return next;
    });
  }
}
