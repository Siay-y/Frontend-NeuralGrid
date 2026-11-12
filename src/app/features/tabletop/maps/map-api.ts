import { HttpClient, HttpErrorResponse, type HttpEvent } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { TableMap } from '../realtime/table.protocol';
import type { PreparedMap } from './map-image';

const UPLOAD_MESSAGES: Readonly<Record<number, string>> = {
  0: 'Sem conexão com o servidor. Tente de novo.',
  403: 'Só o mestre envia mapas.',
  413: 'O mapa ficou grande demais para enviar.',
  429: 'Muitos envios seguidos. Espere um minuto.',
};

export function describeUploadError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const known = UPLOAD_MESSAGES[error.status];
    if (known) {
      return known;
    }
    const message = (error.error as { message?: unknown } | null)?.message;
    if (typeof message === 'string' && error.status < 500) {
      return message.endsWith('.') ? message : `${message}.`;
    }
  }
  return 'Não foi possível enviar o mapa.';
}

export interface UploadTarget {
  mapId?: string;
  center?: { col: number; row: number };
}

@Injectable()
export class MapApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/maps`;
  private readonly thumbnails = new Map<string, Promise<string>>();

  upload(map: PreparedMap, target: UploadTarget = {}): Observable<HttpEvent<TableMap>> {
    const form = new FormData();
    form.append('name', map.name);
    if (target.center) {
      form.append('centerCol', String(target.center.col));
      form.append('centerRow', String(target.center.row));
    }
    form.append('image', map.image, 'map');
    form.append('thumbnail', map.thumbnail, 'thumbnail');
    const url = target.mapId ? `${this.base}/${target.mapId}/areas` : this.base;
    return this.http.post<TableMap>(url, form, { reportProgress: true, observe: 'events' });
  }

  image(areaId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.base}/areas/${areaId}/image`, { responseType: 'blob' }),
    );
  }

  thumbnail(id: string): Promise<string> {
    let url = this.thumbnails.get(id);
    if (!url) {
      url = firstValueFrom(
        this.http.get(`${this.base}/areas/${id}/thumbnail`, { responseType: 'blob' }),
      ).then(toDataUrl);
      url.catch(() => this.thumbnails.delete(id));
      this.thumbnails.set(id, url);
    }
    return url;
  }

  forget(id: string): void {
    this.thumbnails.delete(id);
  }
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
