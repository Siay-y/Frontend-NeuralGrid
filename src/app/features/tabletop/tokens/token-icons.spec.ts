import { tokenIcon, TOKEN_ICON_GROUPS, TOKEN_ICONS } from './token-icons';

describe('token icons', () => {
  it('has unique ids that fit the server limit', () => {
    const ids = TOKEN_ICONS.map((icon) => icon.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.length <= 48)).toBe(true);
  });

  it('files every icon under a known group with something to draw', () => {
    const groups = new Set(TOKEN_ICON_GROUPS.map((group) => group.id));
    expect(TOKEN_ICONS.every((icon) => groups.has(icon.group) && icon.paths.length > 0)).toBe(true);
  });

  it('finds an icon by id and ignores unknown or empty ids', () => {
    expect(tokenIcon('dragon-head')?.label).toBe('Dragão');
    expect(tokenIcon('unicorn')).toBeNull();
    expect(tokenIcon(null)).toBeNull();
  });
});
