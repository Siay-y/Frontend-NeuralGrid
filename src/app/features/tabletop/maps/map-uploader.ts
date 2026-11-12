import { HttpEventType } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import type { TableMap } from '../realtime/table.protocol';
import { TableState } from '../realtime/table-state';
import { describeUploadError, MapApi, type UploadTarget } from './map-api';
import { MAP_UPLOAD, MapImageError, prepareMapUpload, type PreparedMap } from './map-image';

export interface UploadState {
  phase: 'preparing' | 'sending';
  progress: number;
  area: boolean;
}

@Injectable()
export class MapUploader {
  private readonly api = inject(MapApi);
  private readonly table = inject(TableState);

  readonly state = signal<UploadState | null>(null);
  readonly error = signal<string | null>(null);
  readonly usage = computed(() => {
    const maps = this.table.maps();
    return {
      count: maps.length,
      bytes: maps.reduce(
        (total, map) => total + map.areas.reduce((sum, area) => sum + area.bytes, 0),
        0,
      ),
    };
  });
  readonly full = computed(
    () =>
      this.usage().count >= MAP_UPLOAD.maxMaps || this.usage().bytes >= MAP_UPLOAD.maxTotalBytes,
  );

  async upload(file: File, target: UploadTarget = {}): Promise<TableMap | null> {
    if (this.state()) {
      return null;
    }
    this.error.set(null);
    const area = target.mapId !== undefined;
    const map = area ? this.table.maps().find((entry) => entry.id === target.mapId) : null;
    const problem = this.limitProblem(map ?? null);
    if (problem) {
      this.error.set(problem);
      return null;
    }
    this.state.set({ phase: 'preparing', progress: 0, area });
    let prepared: PreparedMap;
    try {
      prepared = await prepareMapUpload(file);
    } catch (error) {
      this.state.set(null);
      this.error.set(
        error instanceof MapImageError ? error.message : 'Não foi possível ler essa imagem.',
      );
      return null;
    }
    this.state.set({ phase: 'sending', progress: 0, area });
    return new Promise((resolve) => {
      this.api.upload(prepared, target).subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.state.set({ phase: 'sending', progress: event.loaded / event.total, area });
          } else if (event.type === HttpEventType.Response && event.body) {
            this.table.addMap(event.body);
            this.state.set(null);
            resolve(event.body);
          }
        },
        error: (error: unknown) => {
          this.state.set(null);
          this.error.set(describeUploadError(error));
          resolve(null);
        },
      });
    });
  }

  private limitProblem(map: TableMap | null): string | null {
    if (this.usage().bytes >= MAP_UPLOAD.maxTotalBytes) {
      return 'O espaço dos mapas acabou. Apague um mapa antigo para enviar outro.';
    }
    if (map) {
      return map.areas.length >= MAP_UPLOAD.maxAreas
        ? `Um mapa tem no máximo ${MAP_UPLOAD.maxAreas} áreas.`
        : null;
    }
    return this.usage().count >= MAP_UPLOAD.maxMaps
      ? 'A biblioteca está cheia. Apague um mapa para enviar outro.'
      : null;
  }
}
