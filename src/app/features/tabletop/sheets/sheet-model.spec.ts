import {
  carriedWeight,
  clampInteger,
  clampWeight,
  d20Roll,
  defense,
  gaugeRatio,
  isValidDamage,
  modifier,
  newSheetData,
  rollLabel,
  sheetSummary,
  sheetTokenLabel,
  signed,
  skillBonus,
  SKILLS,
} from './sheet-model';

describe('sheet model', () => {
  it('turns a value into its modifier, rounding down', () => {
    expect(modifier(14)).toBe(2);
    expect(modifier(8)).toBe(-1);
    expect(modifier(10)).toBe(0);
    expect(modifier(18)).toBe(4);
    expect(modifier(9)).toBe(-1);
    expect(modifier(0)).toBe(-5);
  });

  it('writes the d20 roll with the bonus and the sign it needs', () => {
    expect(d20Roll(0)).toBe('1d20');
    expect(d20Roll(3)).toBe('1d20+3');
    expect(d20Roll(-2)).toBe('1d20-2');
    expect(signed(2)).toBe('+2');
    expect(signed(-1)).toBe('−1');
    expect(signed(0)).toBe('0');
  });

  it('starts a sheet at 10 in every attribute, with no bonuses', () => {
    const data = newSheetData('Kian');

    expect(Object.values(data.attributes).every((value) => value === 10)).toBe(true);
    expect(Object.keys(data.skills)).toHaveLength(SKILLS.length);
    expect(sheetSummary(data)).toBe('Sem classe · Defesa 10');
  });

  it('adds the attribute modifier and the free bonus to a skill', () => {
    const data = newSheetData('Kian');
    const arcana = SKILLS.find((skill) => skill.id === 'arcana')!;
    const tuned = {
      ...data,
      attributes: { ...data.attributes, intelligence: 15 },
      skills: { ...data.skills, arcana: 3 },
    };

    expect(skillBonus(tuned, arcana)).toBe(5);
  });

  it('counts the defense from the armor and the resistance modifier', () => {
    const data = newSheetData('Kian');

    expect(
      defense({
        ...data,
        status: { ...data.status, armor: 14 },
        attributes: { ...data.attributes, resistance: 13 },
      }),
    ).toBe(15);
  });

  it('weighs everything carried, items by quantity', () => {
    expect(
      carriedWeight({
        weapons: [
          { id: 'a', name: 'Espada', attribute: 'strength', bonus: 0, damage: '1d8', weight: 1.5 },
        ],
        armors: [{ id: 'b', name: 'Couro', defense: 2, bonus: 0, weight: 5 }],
        items: [{ id: 'c', name: 'Tocha', quantity: 3, weight: 0.5 }],
      }),
    ).toBe(8);
    expect(clampWeight('2,25', 0)).toBe(2.3);
    expect(clampWeight('-1', 4)).toBe(0);
  });

  it('keeps typed numbers inside the limits', () => {
    expect(clampInteger('7', 0, 5, 1)).toBe(5);
    expect(clampInteger('-3', 0, 5, 1)).toBe(0);
    expect(clampInteger('abc', 0, 5, 1)).toBe(1);
    expect(clampInteger(2.9, 0, 5, 1)).toBe(2);
  });

  it('names a roll after the character and falls back when too long', () => {
    expect(rollLabel('Kian', 'Luta')).toBe('Kian · Luta');
    expect(rollLabel('K'.repeat(48), 'Luta')).toBe('Luta');
  });

  it('measures how full a gauge is', () => {
    expect(gaugeRatio({ current: 5, max: 20 })).toBe(0.25);
    expect(gaugeRatio({ current: -2, max: 20 })).toBe(0);
    expect(gaugeRatio({ current: 30, max: 20 })).toBe(1);
    expect(gaugeRatio({ current: 3, max: 0 })).toBe(0);
  });

  it('names the token after the codename, then the name', () => {
    const data = newSheetData('Kian Ferreira');

    expect(sheetTokenLabel(data)).toBe('Kian Ferreira');
    expect(sheetTokenLabel({ ...data, identity: { ...data.identity, codename: ' Corvo ' } })).toBe(
      'Corvo',
    );
    expect(
      sheetTokenLabel({ ...data, identity: { ...data.identity, name: 'x'.repeat(48) } }),
    ).toHaveLength(32);
  });

  it('accepts damage written as dice', () => {
    expect(isValidDamage('1d8')).toBe(true);
    expect(isValidDamage('2d6+3')).toBe(true);
    expect(isValidDamage('d4 + 1d6')).toBe(true);
    expect(isValidDamage('')).toBe(false);
    expect(isValidDamage('muito')).toBe(false);
  });
});
