import { formatReleaseDate } from './release-date';

describe('formatReleaseDate', () => {
  it('formats an ISO date in short Portuguese', () => {
    expect(formatReleaseDate('2026-11-10')).toBe('10 nov 2026');
    expect(formatReleaseDate('2027-01-03')).toBe('3 jan 2027');
  });

  it('returns the input untouched when it is not a date', () => {
    expect(formatReleaseDate('amanhã')).toBe('amanhã');
    expect(formatReleaseDate('2026-13-01')).toBe('2026-13-01');
  });
});
