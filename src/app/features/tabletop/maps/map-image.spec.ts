import { fitWithin, formatBytes, MAP_UPLOAD, mapNameFromFile, uploadProblem } from './map-image';

describe('map image helpers', () => {
  it('shrinks the longest side to the limit and keeps the proportion', () => {
    expect(fitWithin({ width: 8000, height: 6000 }, 4096)).toEqual({ width: 4096, height: 3072 });
    expect(fitWithin({ width: 3000, height: 9000 }, 4096)).toEqual({ width: 1365, height: 4096 });
    expect(fitWithin({ width: 1200, height: 800 }, 4096)).toEqual({ width: 1200, height: 800 });
  });

  it('turns a file name into a readable map name', () => {
    expect(mapNameFromFile('covil_do-dragao_v2.final.webp')).toBe('covil do dragao v2.final');
    expect(mapNameFromFile('.png')).toBe('Mapa');
    expect(mapNameFromFile(`${'a'.repeat(80)}.png`)).toHaveLength(MAP_UPLOAD.nameLength);
  });

  it('accepts only the image types the server stores', () => {
    expect(uploadProblem({ type: 'image/png', size: 1000 })).toBeNull();
    expect(uploadProblem({ type: 'image/svg+xml', size: 1000 })).toContain('PNG, JPEG ou WebP');
    expect(uploadProblem({ type: 'image/gif', size: 1000 })).toContain('PNG, JPEG ou WebP');
    expect(uploadProblem({ type: 'image/jpeg', size: MAP_UPLOAD.maxInputBytes + 1 })).toContain(
      'até 40 MB',
    );
  });

  it('formats sizes the way the panel shows them', () => {
    expect(formatBytes(300)).toBe('1 KB');
    expect(formatBytes(48_000)).toBe('47 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1,5 MB');
    expect(formatBytes(300 * 1024 * 1024)).toBe('300 MB');
  });
});
