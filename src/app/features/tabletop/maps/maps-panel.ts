import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  type ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  LucideEye,
  LucideEyeOff,
  LucideFocus,
  LucideImagePlus,
  LucideLoaderCircle,
  LucideMap,
  LucidePlus,
  LucideSquarePen,
  LucideTrash,
} from '@lucide/angular';
import { ActionMenu } from '../panel/action-menu';
import { Collapsible } from '../panel/collapsible';
import type { MapArea, TableMap } from '../realtime/table.protocol';
import { TableState } from '../realtime/table-state';
import { TabletopStore } from '../tabletop.store';
import { MapApi } from './map-api';
import { formatBytes, MAP_UPLOAD } from './map-image';
import { MapScene } from './map-scene';
import { MapUploader, type UploadState } from './map-uploader';

const CELL_COMMIT_MS = 400;
const DELETE_CONFIRM_MS = 3_000;
const LIBRARY_SECTION = 'maps-library';
const PANEL_COVERS_BOARD = '(max-width: 860px)';

export const CELL_SLIDER = { min: 20, max: 300 } as const;

type Sized = Pick<MapArea, 'width' | 'height' | 'cell'>;

export function cellsAcross(area: Sized): string {
  const across = (pixels: number) =>
    (pixels / area.cell).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${across(area.width)} × ${across(area.height)} quadrados`;
}

export function rescaleAroundCenter(
  area: Pick<MapArea, 'width' | 'height' | 'col' | 'row' | 'cell'>,
  cell: number,
): { col: number; row: number; cell: number } {
  const round = (value: number) => Math.round(value * 100) / 100;
  const centerCol = area.col + area.width / area.cell / 2;
  const centerRow = area.row + area.height / area.cell / 2;
  return {
    col: round(centerCol - area.width / cell / 2),
    row: round(centerRow - area.height / cell / 2),
    cell,
  };
}

export function clampCell(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.min(MAP_UPLOAD.cellMax, Math.max(MAP_UPLOAD.cellMin, Math.round(value)));
}

export function mapBytes(map: TableMap): number {
  return map.areas.reduce((total, area) => total + area.bytes, 0);
}

function areaCount(map: TableMap): string {
  return map.areas.length === 1 ? '1 área' : `${map.areas.length} áreas`;
}

@Component({
  selector: 'app-maps-panel',
  imports: [
    ActionMenu,
    Collapsible,
    NgTemplateOutlet,
    LucideEye,
    LucideEyeOff,
    LucideFocus,
    LucideImagePlus,
    LucideLoaderCircle,
    LucideMap,
    LucidePlus,
    LucideSquarePen,
    LucideTrash,
  ],
  templateUrl: './maps-panel.html',
  styleUrl: './maps-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapsPanel {
  protected readonly table = inject(TableState);
  protected readonly store = inject(TabletopStore);
  protected readonly uploader = inject(MapUploader);
  private readonly api = inject(MapApi);
  private readonly document = inject(DOCUMENT);
  private readonly scene = inject(MapScene);
  private readonly injector = inject(Injector);
  private readonly areaInput = viewChild.required<ElementRef<HTMLInputElement>>('areaInput');
  private cellTimer: ReturnType<typeof setTimeout> | undefined;
  private confirmTimer: ReturnType<typeof setTimeout> | undefined;
  private areaTarget: string | null = null;

  protected readonly limits = MAP_UPLOAD;
  protected readonly slider = CELL_SLIDER;
  protected readonly librarySection = LIBRARY_SECTION;
  protected readonly formatBytes = formatBytes;
  protected readonly cellsAcross = cellsAcross;
  protected readonly mapBytes = mapBytes;
  protected readonly areaCount = areaCount;
  protected readonly dragOver = signal(false);
  protected readonly renamingId = signal<string | null>(null);
  protected readonly confirmingDeleteId = signal<string | null>(null);
  protected readonly thumbnails = signal<ReadonlyMap<string, string>>(new Map());

  protected readonly maps = this.table.maps;
  protected readonly active = computed(() => {
    const map = this.maps().find((candidate) => candidate.active);
    if (!map) {
      return null;
    }
    const placed = new Map(this.scene.areas().map((area) => [area.id, area]));
    return {
      ...map,
      areas: map.areas.map((area) => {
        const live = placed.get(area.id);
        return live ? { ...area, col: live.col, row: live.row, cell: live.cell } : area;
      }),
    };
  });
  protected readonly selected = computed<MapArea | null>(() => {
    const areas = this.active()?.areas ?? [];
    return areas.find((area) => area.id === this.store.mapAreaId()) ?? areas[0] ?? null;
  });

  constructor() {
    effect(() => {
      const known = untracked(this.thumbnails);
      const missing = this.maps()
        .flatMap((map) => map.areas)
        .filter((area) => !known.has(area.id));
      for (const area of missing) {
        this.api
          .thumbnail(area.id)
          .then((url) => this.thumbnails.update((all) => new Map(all).set(area.id, url)))
          .catch(() => undefined);
      }
    });
    effect(() => {
      const selected = this.selected();
      untracked(() => {
        if (selected && selected.id !== this.store.mapAreaId()) {
          this.store.selectMapArea(selected.id);
        }
      });
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.confirmTimer);
      this.flushCell();
    });
  }

  protected percent(state: UploadState): string {
    return `${Math.round(state.progress * 100)}%`;
  }

  protected pick(event: Event): void {
    const file = this.takeFile(event);
    if (file) {
      void this.uploader.upload(file);
    }
  }

  protected pickArea(event: Event): void {
    const file = this.takeFile(event);
    const mapId = this.areaTarget;
    this.areaTarget = null;
    if (file && mapId) {
      void this.addArea(file, mapId);
    }
  }

  protected chooseArea(map: TableMap): void {
    this.areaTarget = map.id;
    this.areaInput().nativeElement.click();
  }

  protected dragEnter(event: DragEvent): void {
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
      this.dragOver.set(true);
    }
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) {
      void this.uploader.upload(file);
    }
  }

  protected async use(map: TableMap): Promise<void> {
    if (await this.table.activateMap(map.id)) {
      const first = map.areas[0];
      this.store.selectMapArea(first?.id ?? null);
      if (first) {
        this.focusOn(first);
      }
    }
  }

  protected takeOff(): void {
    this.store.setMapAdjusting(false);
    void this.table.activateMap(null);
  }

  protected selectArea(area: MapArea): void {
    this.store.selectMapArea(area.id);
  }

  protected toggleHidden(area: MapArea): void {
    void this.table.updateArea(area.id, { hidden: !area.hidden });
  }

  protected toggleAdjust(): void {
    const adjusting = !this.store.mapAdjusting();
    this.store.setMapAdjusting(adjusting);
    if (adjusting && this.document.defaultView?.matchMedia?.(PANEL_COVERS_BOARD).matches) {
      this.store.closePanel();
    }
  }

  protected setCell(event: Event): void {
    const area = this.selected();
    const cell = clampCell(Number((event.target as HTMLInputElement).value));
    if (!area || cell === null || cell === area.cell) {
      return;
    }
    this.store.setMapDraft({ id: area.id, ...rescaleAroundCenter(area, cell) });
    clearTimeout(this.cellTimer);
    this.cellTimer = setTimeout(() => this.flushCell(), CELL_COMMIT_MS);
  }

  protected centerOnView(): void {
    const area = this.selected();
    if (!area) {
      return;
    }
    const center = this.store.viewCenter();
    const round = (value: number) => Math.round(value * 100) / 100;
    void this.table.updateArea(area.id, {
      col: round(center.col + 0.5 - area.width / area.cell / 2),
      row: round(center.row + 0.5 - area.height / area.cell / 2),
    });
  }

  protected startRename(id: string): void {
    this.renamingId.set(id);
    afterNextRender(
      () => {
        const input = document.querySelector<HTMLInputElement>(`[data-rename="${id}"]`);
        input?.focus();
        input?.select();
      },
      { injector: this.injector },
    );
  }

  protected finishRename(target: TableMap | MapArea, event: Event): void {
    if (this.renamingId() !== target.id) {
      return;
    }
    this.renamingId.set(null);
    const name = (event.target as HTMLInputElement).value
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAP_UPLOAD.nameLength);
    if (!name || name === target.name) {
      return;
    }
    if ('areas' in target) {
      void this.table.renameMap(target.id, name);
    } else {
      void this.table.updateArea(target.id, { name });
    }
  }

  protected cancelRename(): void {
    this.renamingId.set(null);
  }

  protected requestDelete(id: string, remove: () => void): void {
    clearTimeout(this.confirmTimer);
    if (this.confirmingDeleteId() !== id) {
      this.confirmingDeleteId.set(id);
      this.confirmTimer = setTimeout(() => this.confirmingDeleteId.set(null), DELETE_CONFIRM_MS);
      return;
    }
    this.confirmingDeleteId.set(null);
    remove();
  }

  protected deleteMap(map: TableMap): void {
    this.requestDelete(map.id, () => {
      if (map.active) {
        this.store.setMapAdjusting(false);
      }
      void this.table.deleteMap(map.id).then((removed) => {
        if (removed) {
          map.areas.forEach((area) => this.api.forget(area.id));
        }
      });
    });
  }

  protected deleteArea(area: MapArea): void {
    this.requestDelete(area.id, () => {
      void this.table.deleteArea(area.id).then((map) => map && this.api.forget(area.id));
    });
  }

  private async addArea(file: File, mapId: string): Promise<void> {
    const map = await this.uploader.upload(file, { mapId });
    const area = map?.areas.at(-1);
    if (map?.active && area) {
      this.store.selectMapArea(area.id);
      this.focusOn(area);
    }
  }

  private focusOn(area: MapArea): void {
    this.store.focusOn(
      area.col + area.width / area.cell / 2,
      area.row + area.height / area.cell / 2,
      0,
    );
  }

  private takeFile(event: Event): File | undefined {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    return file;
  }

  private flushCell(): void {
    if (this.cellTimer === undefined) {
      return;
    }
    clearTimeout(this.cellTimer);
    this.cellTimer = undefined;
    const draft = this.store.mapDraft();
    if (!draft) {
      return;
    }
    const { col, row, cell } = draft;
    void this.table.updateArea(draft.id, { col, row, cell }).then(() => {
      if (this.store.mapDraft() === draft) {
        this.store.setMapDraft(null);
      }
    });
  }
}
