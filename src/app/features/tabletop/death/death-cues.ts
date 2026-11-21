import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CinematicQueue } from '../cinematic-queue';
import { prefersReducedMotion } from '../dice/dice-env';
import { RollFeed } from '../dice/roll-feed';
import { TableState } from '../realtime/table-state';
import type { TableDeathEvent } from '../realtime/table.protocol';
import { StatusIcon } from '../status/status-icon';
import { DeathBand } from './death-band';
import {
  type DeathNotice,
  deathNotice,
  type DeathScene,
  deathScene,
  ALLY_REVEAL_MS,
  rollingScene,
  SCENE_MS,
} from './death-scene';

const NOTICE_MS = 5_000;
const NOTICE_LIMIT = 3;

@Component({
  selector: 'app-death-cues',
  imports: [DeathBand, StatusIcon],
  templateUrl: './death-cues.html',
  styleUrl: './death-cues.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closeScene()' },
})
export class DeathCues {
  protected readonly table = inject(TableState);
  private readonly queue = inject(CinematicQueue);
  private readonly feed = inject(RollFeed);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private seq = 0;

  protected readonly scene = signal<DeathScene | null>(null);
  protected readonly notices = signal<readonly DeathNotice[]>([]);
  protected readonly veil = computed(() => {
    const fall = this.table.myFall();
    if (!fall) {
      return null;
    }
    if (fall.turns === null) {
      return { dying: false, label: 'Morto' };
    }
    return {
      dying: true,
      label: `Inconsciente · ${fall.turns === 1 ? '1 chance' : `${fall.turns} chances`}`,
    };
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timers.forEach((timer) => clearTimeout(timer)));
    effect(() => {
      const news = this.table.deaths();
      if (news) {
        untracked(() => this.handle(news.event));
      }
    });
  }

  protected closeScene(): void {
    if (this.scene()) {
      this.queue.skip();
    }
  }

  protected dismiss(id: number): void {
    this.notices.update((list) => list.filter((notice) => notice.id !== id));
  }

  private handle(event: TableDeathEvent): void {
    const me = this.table.me();
    const mine = !!me && me.role !== 'master' && event.ownerId === me.id;
    const rolling = event.kind === 'save' && !prefersReducedMotion();
    const seq = ++this.seq;
    if (!mine) {
      this.later(() => this.notify(deathNotice(seq, event)), rolling ? ALLY_REVEAL_MS : 0);
      return;
    }
    const message = event.kind === 'save' ? event.message : null;
    const throwDice = () => {
      if (message) {
        this.feed.throwDice(message);
      }
    };
    if (rolling) {
      this.show(rollingScene(seq, event), throwDice);
      this.show(deathScene(++this.seq, event));
    } else {
      this.show(deathScene(seq, event), throwDice);
    }
  }

  private show(scene: DeathScene, start?: () => void): void {
    this.queue.play({
      duration: SCENE_MS[scene.variant],
      show: () => {
        start?.();
        this.scene.set(scene);
      },
      hide: () => this.scene.set(null),
    });
  }

  private notify(notice: DeathNotice): void {
    this.notices.update((list) => [...list, notice].slice(-NOTICE_LIMIT));
    this.later(() => this.dismiss(notice.id), NOTICE_MS);
  }

  private later(task: () => void, ms: number): void {
    if (ms <= 0) {
      task();
      return;
    }
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      task();
    }, ms);
    this.timers.add(timer);
  }
}
