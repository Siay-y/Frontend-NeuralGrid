import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideMoon, LucideSun } from '@lucide/angular';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'app-theme-toggle',
  imports: [LucideMoon, LucideSun],
  templateUrl: './theme-toggle.html',
  styleUrl: './theme-toggle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  protected readonly label = computed(() =>
    this.theme.isDark() ? 'Ativar tema claro' : 'Ativar tema escuro',
  );
}
