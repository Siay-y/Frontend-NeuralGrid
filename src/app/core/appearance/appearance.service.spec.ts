import { TestBed } from '@angular/core/testing';
import { AppearanceService, glassLabel, glassStyle } from './appearance.service';

const STORAGE_KEY = 'neuralgrid.glass';

describe('glass appearance', () => {
  it('stays solid at zero and grows clearer and blurrier with the level', () => {
    expect(glassStyle(0)).toBeNull();
    expect(glassStyle(50)).toEqual({ surface: '70%', filter: 'blur(14px) saturate(125%)' });
    expect(glassStyle(100)).toEqual({ surface: '40%', filter: 'blur(20px) saturate(150%)' });
  });

  it('labels the level for the slider', () => {
    expect(glassLabel(0)).toBe('Sólida');
    expect(glassLabel(35)).toBe('35%');
  });
});

describe('AppearanceService', () => {
  const root = document.documentElement.style;

  function create(): AppearanceService {
    TestBed.resetTestingModule();
    return TestBed.inject(AppearanceService);
  }

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('CSS', { supports: () => true });
  });

  afterEach(() => {
    localStorage.clear();
    root.removeProperty('--glass-surface');
    root.removeProperty('--glass-filter');
    vi.unstubAllGlobals();
  });

  it('starts solid when nothing was chosen', () => {
    const appearance = create();

    expect(appearance.glass()).toBe(0);
    expect(root.getPropertyValue('--glass-filter')).toBe('');
  });

  it('applies the level, remembers it and restores it on the next visit', () => {
    create().setGlass(150);

    expect(localStorage.getItem(STORAGE_KEY)).toBe('100');
    expect(root.getPropertyValue('--glass-surface')).toBe('40%');

    root.removeProperty('--glass-surface');
    const again = create();
    expect(again.glass()).toBe(100);
    expect(root.getPropertyValue('--glass-surface')).toBe('40%');

    again.setGlass(0);
    expect(root.getPropertyValue('--glass-surface')).toBe('');
  });

  it('keeps the bar solid when the browser cannot blur', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    localStorage.setItem(STORAGE_KEY, '80');

    const appearance = create();

    expect(appearance.glassSupported).toBe(false);
    expect(root.getPropertyValue('--glass-filter')).toBe('');
  });
});
