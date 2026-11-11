import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { TableState } from '../realtime/table-state';
import { loadDiceFont, prefersReducedMotion, prefersSavingData, readDiceColors } from './dice-env';
import { animatedDice } from './dice-rules';
import type { DiceScene } from './dice-scene';
import { RollFeed } from './roll-feed';

const PREFETCH_TIMEOUT_MS = 5_000;
const PREFETCH_FALLBACK_MS = 2_000;

@Component({
  selector: 'app-dice-tray',
  templateUrl: './dice-tray.html',
  styleUrl: './dice-tray.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiceTray {
  private readonly feed = inject(RollFeed);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly table = inject(TableState);
  private scene: Promise<DiceScene | null> | null = null;
  private destroyed = false;
  private prefetchScheduled = false;
  private cancelPrefetch: (() => void) | undefined;

  constructor() {
    effect(() => {
      if (this.feed.throws().length > 0) {
        untracked(() => void this.drain());
      }
    });
    effect(() => {
      if (this.table.ready()) {
        untracked(() => this.schedulePrefetch());
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.cancelPrefetch?.();
      void this.scene?.then((scene) => scene?.dispose());
    });
  }

  private schedulePrefetch(): void {
    if (this.prefetchScheduled || prefersReducedMotion() || prefersSavingData()) {
      return;
    }
    this.prefetchScheduled = true;
    const prefetch = () => {
      this.cancelPrefetch = undefined;
      void Promise.all([import('./dice-scene'), import('./dice-spinner'), loadDiceFont()]).catch(
        () => undefined,
      );
    };
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(prefetch, { timeout: PREFETCH_TIMEOUT_MS });
      this.cancelPrefetch = () => cancelIdleCallback(id);
    } else {
      const timer = setTimeout(prefetch, PREFETCH_FALLBACK_MS);
      this.cancelPrefetch = () => clearTimeout(timer);
    }
  }

  private async drain(): Promise<void> {
    for (let message = this.feed.takeThrow(); message; message = this.feed.takeThrow()) {
      const dice = message.roll ? animatedDice(message.roll) : null;
      if (!dice || prefersReducedMotion()) {
        continue;
      }
      const scene = await this.loadScene();
      if (scene && !this.destroyed) {
        void scene.play(dice, readDiceColors(), this.blockedLeft());
      }
    }
  }

  private blockedLeft(): number {
    const canvas = this.canvas().nativeElement.getBoundingClientRect();
    const stage = this.host.nativeElement.parentElement;
    const covers = [
      stage?.querySelector(':scope > app-table-panel'),
      stage?.parentElement?.querySelector(':scope > app-sidebar'),
    ];
    return Math.max(
      0,
      ...covers.map((element) =>
        element ? element.getBoundingClientRect().right - canvas.left : 0,
      ),
    );
  }

  private loadScene(): Promise<DiceScene | null> {
    this.scene ??= import('./dice-scene')
      .then(async ({ DiceScene }) => {
        await loadDiceFont();
        return new DiceScene(this.canvas().nativeElement);
      })
      .catch(() => null);
    return this.scene;
  }
}
