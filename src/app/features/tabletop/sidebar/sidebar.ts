import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import {
  LucideDynamicIcon,
  LucideLogOut,
  LucideMenu,
  LucideMoon,
  LucidePanelLeftClose,
  LucideSun,
} from '@lucide/angular';
import { ROLE_LABEL } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { ReleaseService } from '../../../core/release/release.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { BrandMark } from '../../../shared/ui/brand-mark/brand-mark';
import { TableState } from '../realtime/table-state';
import { MAP_TOOLS, SHORTCUT_PANELS, TABLE_PANELS } from '../tabletop.models';
import { TabletopStore } from '../tabletop.store';

interface Tip {
  label: string;
  top: number;
  left: number;
}

const TIP_OFFSET_PX = 12;

@Component({
  selector: 'app-sidebar',
  imports: [
    BrandMark,
    LucideDynamicIcon,
    LucideLogOut,
    LucideMenu,
    LucideMoon,
    LucidePanelLeftClose,
    LucideSun,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  private readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly store = inject(TabletopStore);
  protected readonly theme = inject(ThemeService);
  protected readonly release = inject(ReleaseService);
  protected readonly table = inject(TableState);

  protected readonly tools = MAP_TOOLS;
  protected readonly shortcuts = computed(() =>
    SHORTCUT_PANELS.filter((panel) => panel.id !== 'maps' || this.table.isMaster()),
  );
  protected readonly settings = TABLE_PANELS.settings;
  protected readonly updates = TABLE_PANELS.updates;

  protected readonly user = this.auth.user;
  protected readonly initial = computed(
    () => this.user()?.displayName.trim().charAt(0).toUpperCase() ?? '?',
  );
  protected readonly roleLabel = computed(() => {
    const user = this.user();
    return user ? ROLE_LABEL[user.role] : '';
  });
  protected readonly updatesLabel = computed(() =>
    this.release.hasUnseen() ? `${this.updates.label}, versão nova` : this.updates.label,
  );
  protected readonly themeLabel = computed(() =>
    this.theme.isDark() ? 'Tema claro' : 'Tema escuro',
  );

  protected readonly tip = signal<Tip | null>(null);

  protected showTip(event: Event): void {
    const item = (event.target as Element).closest<HTMLElement>('[data-tooltip]');
    const fromMouse = !(event instanceof PointerEvent) || event.pointerType === 'mouse';
    const fromKeyboard = event.type !== 'focusin' || item?.matches(':focus-visible');
    if (!item || this.store.sidebarExpanded() || !fromMouse || !fromKeyboard) {
      this.hideTip();
      return;
    }
    const box = item.getBoundingClientRect();
    const origin = this.host.nativeElement.getBoundingClientRect();
    this.tip.set({
      label: item.dataset['tooltip'] ?? '',
      top: box.top - origin.top + box.height / 2,
      left: box.right - origin.left + TIP_OFFSET_PX,
    });
  }

  protected hideTip(): void {
    this.tip.set(null);
  }

  protected logout(): void {
    this.auth.logout();
  }
}
