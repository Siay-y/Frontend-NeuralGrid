import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { SceneArea } from '../realtime/table.protocol';
import { TableState } from '../realtime/table-state';
import { TabletopStore } from '../tabletop.store';
import { MapApi } from './map-api';

export interface SceneLayer {
  area: SceneArea;
  image: ImageBitmap | null;
}

export function areaAt(areas: readonly SceneArea[], x: number, y: number): SceneArea | null {
  for (let index = areas.length - 1; index >= 0; index--) {
    const area = areas[index];
    if (
      x >= area.col &&
      y >= area.row &&
      x <= area.col + area.width / area.cell &&
      y <= area.row + area.height / area.cell
    ) {
      return area;
    }
  }
  return null;
}

@Injectable()
export class MapScene {
  private readonly table = inject(TableState);
  private readonly store = inject(TabletopStore);
  private readonly api = inject(MapApi);
  private readonly bitmaps = signal<ReadonlyMap<string, ImageBitmap>>(new Map());
  private readonly loading = new Set<string>();
  private failed = false;

  readonly areas = computed<SceneArea[]>(() => {
    const areas = this.table.scene()?.areas ?? [];
    const draft = this.store.mapDraft();
    return draft
      ? areas.map((area) => (area.id === draft.id ? { ...area, ...draft } : area))
      : areas;
  });

  readonly layers = computed<SceneLayer[]>(() => {
    const bitmaps = this.bitmaps();
    return this.areas().map((area) => ({ area, image: bitmaps.get(area.id) ?? null }));
  });

  constructor() {
    effect(() => {
      const ids = new Set((this.table.scene()?.areas ?? []).map((area) => area.id));
      untracked(() => this.sync(ids));
    });
    inject(DestroyRef).onDestroy(() => {
      this.bitmaps().forEach((bitmap) => bitmap.close());
      this.loading.clear();
    });
  }

  private sync(ids: ReadonlySet<string>): void {
    const current = this.bitmaps();
    const stale = [...current.keys()].filter((id) => !ids.has(id));
    if (stale.length > 0) {
      const next = new Map(current);
      for (const id of stale) {
        next.get(id)?.close();
        next.delete(id);
      }
      this.bitmaps.set(next);
    }
    for (const id of [...this.loading]) {
      if (!ids.has(id)) {
        this.loading.delete(id);
      }
    }
    if (ids.size === 0) {
      this.failed = false;
    }
    for (const id of ids) {
      if (!this.bitmaps().has(id) && !this.loading.has(id)) {
        void this.load(id);
      }
    }
  }

  private async load(id: string): Promise<void> {
    this.loading.add(id);
    try {
      const bitmap = await createImageBitmap(await this.api.image(id));
      if (!this.loading.delete(id)) {
        bitmap.close();
        return;
      }
      this.bitmaps.update((all) => new Map(all).set(id, bitmap));
    } catch {
      if (this.loading.delete(id) && !this.failed) {
        this.failed = true;
        this.store.notify('Não foi possível carregar o mapa da mesa.');
      }
    }
  }
}
