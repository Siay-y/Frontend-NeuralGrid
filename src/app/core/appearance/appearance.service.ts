import { DOCUMENT, inject, Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'neuralgrid.glass';

export const GLASS_RANGE = { min: 0, max: 100, step: 5 } as const;

export interface GlassStyle {
  surface: string;
  filter: string;
}

export function glassStyle(level: number): GlassStyle | null {
  if (level <= GLASS_RANGE.min) {
    return null;
  }
  const strength = Math.min(level, GLASS_RANGE.max) / GLASS_RANGE.max;
  return {
    surface: `${Math.round(100 - strength * 60)}%`,
    filter: `blur(${Math.round(8 + strength * 12)}px) saturate(${Math.round(100 + strength * 50)}%)`,
  };
}

export function glassLabel(level: number): string {
  return level <= GLASS_RANGE.min ? 'Sólida' : `${level}%`;
}

@Injectable({ providedIn: 'root' })
export class AppearanceService {
  private readonly document = inject(DOCUMENT);
  private readonly level = signal(this.read());

  readonly glass = this.level.asReadonly();
  readonly glassSupported = this.detectSupport();

  constructor() {
    this.apply(this.level());
  }

  setGlass(level: number): void {
    const next = Math.min(GLASS_RANGE.max, Math.max(GLASS_RANGE.min, Math.round(level)));
    if (next === this.level()) {
      return;
    }
    this.level.set(next);
    this.apply(next);
    this.persist(next);
  }

  private apply(level: number): void {
    const style = this.document.documentElement.style;
    const glass = this.glassSupported ? glassStyle(level) : null;
    if (glass) {
      style.setProperty('--glass-surface', glass.surface);
      style.setProperty('--glass-filter', glass.filter);
    } else {
      style.removeProperty('--glass-surface');
      style.removeProperty('--glass-filter');
    }
  }

  private detectSupport(): boolean {
    const css = this.document.defaultView?.CSS;
    return (
      typeof css?.supports === 'function' &&
      (css.supports('backdrop-filter', 'blur(1px)') ||
        css.supports('-webkit-backdrop-filter', 'blur(1px)'))
    );
  }

  private read(): number {
    try {
      const stored = Number(localStorage.getItem(STORAGE_KEY));
      return Number.isFinite(stored)
        ? Math.min(GLASS_RANGE.max, Math.max(GLASS_RANGE.min, Math.round(stored)))
        : GLASS_RANGE.min;
    } catch {
      return GLASS_RANGE.min;
    }
  }

  private persist(level: number): void {
    try {
      localStorage.setItem(STORAGE_KEY, String(level));
    } catch {
      return;
    }
  }
}
