import { DEFAULT_DRAWING_STYLE, parseDrawingStyle } from './tabletop.store';

describe('parseDrawingStyle', () => {
  it('restores a saved brush', () => {
    expect(parseDrawingStyle('{"shape":"arrow","color":"mint","width":8}')).toEqual({
      shape: 'arrow',
      color: 'mint',
      width: 8,
    });
  });

  it('falls back to the default for anything unknown or broken', () => {
    expect(parseDrawingStyle('{"shape":"star","color":"#000","width":5}')).toEqual(
      DEFAULT_DRAWING_STYLE,
    );
    expect(parseDrawingStyle('not json')).toEqual(DEFAULT_DRAWING_STYLE);
    expect(parseDrawingStyle(null)).toEqual(DEFAULT_DRAWING_STYLE);
  });
});
