import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { LucideChevronDown, LucideEyeOff } from '@lucide/angular';
import { TableState } from '../realtime/table-state';
import { TabletopStore } from '../tabletop.store';
import { audienceOptions, PUBLIC_AUDIENCE } from './audience';

@Component({
  selector: 'app-audience-select',
  imports: [LucideChevronDown, LucideEyeOff],
  templateUrl: './audience-select.html',
  styleUrl: './audience-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudienceSelect {
  private readonly table = inject(TableState);
  protected readonly store = inject(TabletopStore);

  readonly controlId = input<string | null>(null);

  protected readonly options = computed(() =>
    audienceOptions(this.table.me(), this.table.members()),
  );
  protected readonly isPrivate = computed(() => this.store.chatAudience() !== PUBLIC_AUDIENCE);

  constructor() {
    effect(() => {
      const current = this.store.chatAudience();
      if (this.table.ready() && !this.options().some((option) => option.value === current)) {
        this.store.setChatAudience(PUBLIC_AUDIENCE);
      }
    });
  }

  protected choose(event: Event): void {
    this.store.setChatAudience((event.target as HTMLSelectElement).value);
  }
}
