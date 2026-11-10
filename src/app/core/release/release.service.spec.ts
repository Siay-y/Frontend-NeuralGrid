import { TestBed } from '@angular/core/testing';
import { APP_VERSION } from './release-notes';
import { ReleaseService } from './release.service';

const STORAGE_KEY = 'neuralgrid.seen-version';

describe('ReleaseService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  function create(): ReleaseService {
    TestBed.resetTestingModule();
    return TestBed.inject(ReleaseService);
  }

  it('flags the current version as unseen on a first visit', () => {
    expect(create().hasUnseen()).toBe(true);
  });

  it('flags a newer version than the one last seen', () => {
    localStorage.setItem(STORAGE_KEY, '0.0.1');
    expect(create().hasUnseen()).toBe(true);
  });

  it('clears the flag and remembers it across reloads', () => {
    const service = create();
    service.markSeen();

    expect(service.hasUnseen()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(APP_VERSION);
    expect(create().hasUnseen()).toBe(false);
  });
});
