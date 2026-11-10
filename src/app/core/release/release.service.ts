import { Injectable, computed, signal } from '@angular/core';
import { APP_VERSION } from './release-notes';

const STORAGE_KEY = 'neuralgrid.seen-version';

@Injectable({ providedIn: 'root' })
export class ReleaseService {
  private readonly seenVersion = signal(readSeenVersion());

  readonly version = APP_VERSION;
  readonly hasUnseen = computed(() => this.seenVersion() !== APP_VERSION);

  markSeen(): void {
    if (!this.hasUnseen()) {
      return;
    }
    this.seenVersion.set(APP_VERSION);
    try {
      localStorage.setItem(STORAGE_KEY, APP_VERSION);
    } catch {
      return;
    }
  }
}

function readSeenVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
