import { computed, DOCUMENT, inject, Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'neuralgrid.theme';
const THEME_COLOR: Record<Theme, string> = { dark: '#000000', light: '#f4f5f7' };

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly current = signal<Theme>(this.readApplied());
  private readonly appliedListeners = new Set<() => void>();

  readonly theme = this.current.asReadonly();
  readonly isDark = computed(() => this.current() === 'dark');

  toggle(): void {
    this.set(this.isDark() ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    this.persist(theme);
    const apply = () => this.apply(theme);
    const reduceMotion = this.document.defaultView?.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (typeof this.document.startViewTransition === 'function' && !reduceMotion) {
      this.document.startViewTransition(apply);
    } else {
      apply();
    }
  }

  onApplied(listener: () => void): () => void {
    this.appliedListeners.add(listener);
    return () => this.appliedListeners.delete(listener);
  }

  private apply(theme: Theme): void {
    const root = this.document.documentElement;
    root.dataset['theme'] = theme;
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLOR[theme]);
    this.current.set(theme);
    this.appliedListeners.forEach((listener) => listener());
  }

  private readApplied(): Theme {
    return this.document.documentElement.dataset['theme'] === 'light' ? 'light' : 'dark';
  }

  private persist(theme: Theme): void {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      return;
    }
  }
}
