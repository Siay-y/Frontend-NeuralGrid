import { parseInitiative } from './initiative-panel';

describe('parseInitiative', () => {
  it('reads whole numbers in range and clears an empty field', () => {
    expect(parseInitiative(' 17 ')).toBe(17);
    expect(parseInitiative('-3')).toBe(-3);
    expect(parseInitiative('')).toBeNull();
  });

  it('refuses fractions, text and values out of range', () => {
    for (const raw of ['2.5', 'abc', '1000', '-100']) {
      expect(parseInitiative(raw)).toBeUndefined();
    }
  });
});
