import { describe, expect, it } from 'vitest';
import { family, groupByColor, lightToDark, oklab, sortByColor } from './color';

describe('family', () => {
  it('sorts typical pen colors into chart families', () => {
    expect(family('#e3262f')).toBe('red');
    expect(family('#f28a1d')).toBe('orange');
    expect(family('#fde047')).toBe('yellow');
    expect(family('#22c55e')).toBe('green');
    expect(family('#14b8a6')).toBe('teal');
    expect(family('#1e40af')).toBe('blue');
    expect(family('#7c3aed')).toBe('violet');
    expect(family('#ec4899')).toBe('pink');
    expect(family('#7c4a2d')).toBe('brown');
    expect(family('#9ca3af')).toBe('gray');
    expect(family('#ffffff')).toBe('gray');
  });
});

describe('lightToDark', () => {
  it('runs from the lightest to the darkest color', () => {
    const blues = ['#1e3a8a', '#bfdbfe', '#3b82f6', '#60a5fa', '#172554', '#93c5fd'].map((hex) => ({ hex }));
    const order = lightToDark(blues).map((b) => b.hex);
    expect(order[0]).toBe('#bfdbfe');
    expect(order.at(-1)).toBe('#172554');
  });

  it('takes smaller steps than sorting by lightness when vivid and muted shades mix', () => {
    const greens = ['#4ade80', '#9ca38f', '#22c55e', '#7d8a70', '#86efac', '#b9c2ad', '#16a34a', '#5f6b52'].map(
      (hex) => ({ hex })
    );
    const length = (list: { hex: string }[]) =>
      list.slice(1).reduce((sum, p, i) => {
        const a = oklab(list[i].hex);
        const b = oklab(p.hex);
        return sum + Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      }, 0);
    const byLightness = [...greens].sort((a, b) => oklab(b.hex)[0] - oklab(a.hex)[0]);
    expect(length(lightToDark(greens))).toBeLessThan(length(byLightness));
  });
});

describe('groupByColor', () => {
  it('keeps families in chart order and neutrals last', () => {
    const groups = groupByColor(
      ['#111111', '#1e3a8a', '#fde047', '#ef4444', '#ffffff', '#22c55e'].map((hex) => ({ hex }))
    );
    expect(groups.map((g) => g.family)).toEqual(['red', 'yellow', 'green', 'blue', 'gray']);
    expect(sortByColor(groups.flatMap((g) => g.items)).at(-1)?.hex).toBe('#111111');
  });
});
