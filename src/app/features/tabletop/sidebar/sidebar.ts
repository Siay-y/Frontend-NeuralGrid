import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
import { ThemeService } from '../../../core/theme/theme.service';
import { BrandMark } from '../../../shared/ui/brand-mark/brand-mark';
import { MAP_TOOLS, SHORTCUT_PANELS, TABLE_PANELS } from '../tabletop.models';
import { TabletopStore } from '../tabletop.store';

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
  protected readonly store = inject(TabletopStore);
  protected readonly theme = inject(ThemeService);

  protected readonly tools = MAP_TOOLS;
  protected readonly shortcuts = SHORTCUT_PANELS;
  protected readonly settings = TABLE_PANELS.settings;

  protected readonly user = this.auth.user;
  protected readonly initial = computed(
    () => this.user()?.displayName.trim().charAt(0).toUpperCase() ?? '?',
  );
  protected readonly roleLabel = computed(() => {
    const user = this.user();
    return user ? ROLE_LABEL[user.role] : '';
  });
  protected readonly themeLabel = computed(() =>
    this.theme.isDark() ? 'Tema claro' : 'Tema escuro',
  );

  protected logout(): void {
    this.auth.logout();
  }
}
