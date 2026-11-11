import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import {
  LucideHeart,
  LucideHeartCrack,
  LucideHeartMinus,
  LucideHeartPlus,
  LucideHeartPulse,
} from '@lucide/angular';
import { clampInteger, type Gauge, gaugeRatio, SHEET_LIMITS } from './sheet-model';

type HeartState = 'full' | 'low' | 'down';

const LOW_HP_RATIO = 0.25;
const BIG_STEP = 5;

@Component({
  selector: 'app-sheet-hp',
  imports: [LucideHeart, LucideHeartCrack, LucideHeartMinus, LucideHeartPlus, LucideHeartPulse],
  templateUrl: './sheet-hp.html',
  styleUrl: './sheet-hp.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetHpBar {
  readonly value = input.required<Gauge>();
  readonly changed = output<Gauge>();

  protected readonly limit = SHEET_LIMITS.gauge;
  protected readonly dragging = signal<number | null>(null);
  protected readonly shown = computed(() => this.dragging() ?? this.value().current);
  protected readonly ratio = computed(() =>
    gaugeRatio({ current: this.shown(), max: this.value().max }),
  );
  protected readonly heart = computed<HeartState>(() => {
    if (this.shown() <= 0) {
      return 'down';
    }
    return this.ratio() <= LOW_HP_RATIO ? 'low' : 'full';
  });

  protected step(delta: number): void {
    this.setCurrent(this.value().current + delta);
  }

  protected typeHp(field: 'current' | 'max', event: Event): void {
    const element = event.target as HTMLInputElement;
    const hp = this.value();
    const min = field === 'max' ? 0 : -this.limit;
    const next = clampInteger(element.value, min, this.limit, hp[field]);
    element.value = String(next);
    this.changed.emit({ ...hp, [field]: next });
  }

  protected grab(event: PointerEvent): void {
    if (event.button !== 0 || this.value().max <= 0) {
      return;
    }
    const bar = event.currentTarget as HTMLElement;
    bar.setPointerCapture(event.pointerId);
    bar.focus();
    this.dragging.set(this.valueAt(bar, event.clientX));
  }

  protected drag(event: PointerEvent): void {
    if (this.dragging() !== null) {
      this.dragging.set(this.valueAt(event.currentTarget as HTMLElement, event.clientX));
    }
  }

  protected release(): void {
    const next = this.dragging();
    if (next !== null) {
      this.dragging.set(null);
      this.setCurrent(next);
    }
  }

  protected cancel(): void {
    this.dragging.set(null);
  }

  protected key(event: KeyboardEvent): void {
    const { current, max } = this.value();
    const targets: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowUp: current + 1,
      ArrowLeft: current - 1,
      ArrowDown: current - 1,
      PageUp: current + BIG_STEP,
      PageDown: current - BIG_STEP,
      Home: 0,
      End: max,
    };
    if (event.key in targets) {
      event.preventDefault();
      this.setCurrent(targets[event.key]);
    }
  }

  private valueAt(bar: HTMLElement, clientX: number): number {
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(ratio * this.value().max);
  }

  private setCurrent(value: number): void {
    const hp = this.value();
    const current = clampInteger(value, -this.limit, this.limit, hp.current);
    if (current !== hp.current) {
      this.changed.emit({ ...hp, current });
    }
  }
}
