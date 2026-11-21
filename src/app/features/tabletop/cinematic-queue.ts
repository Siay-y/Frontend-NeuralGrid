import { Injectable, type OnDestroy } from '@angular/core';

export interface Cinematic {
  duration: number;
  show(): void;
  hide(): void;
}

export const CINEMATIC_GAP_MS = 700;

@Injectable()
export class CinematicQueue implements OnDestroy {
  private readonly pending: Cinematic[] = [];
  private active: Cinematic | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  play(cinematic: Cinematic): void {
    this.pending.push(cinematic);
    if (!this.active && this.timer === undefined) {
      this.next();
    }
  }

  skip(): void {
    if (this.active) {
      clearTimeout(this.timer);
      this.finish();
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    this.pending.length = 0;
    this.active = null;
  }

  private next(): void {
    this.timer = undefined;
    const cinematic = this.pending.shift();
    if (!cinematic) {
      return;
    }
    this.active = cinematic;
    cinematic.show();
    this.timer = setTimeout(() => this.finish(), cinematic.duration);
  }

  private finish(): void {
    this.active?.hide();
    this.active = null;
    this.timer = setTimeout(() => this.next(), CINEMATIC_GAP_MS);
  }
}
