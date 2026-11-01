import { describe, expect, it } from 'vitest';
import { sortByColor } from './index';

describe('sortByColor', () => {
  it('orders by hue, light to dark within a hue, neutrals last', () => {
    const pens = ['#111111', '#1e3a8a', '#fde047', '#ef4444', '#93c5fd', '#ffffff', '#22c55e', '#fca5a5'].map(
      (hex) => ({ hex })
    );
    const order = sortByColor(pens).map((p) => p.hex);
    expect(order.slice(-2)).toEqual(['#ffffff', '#111111']);
    expect(order.indexOf('#fca5a5')).toBeLessThan(order.indexOf('#ef4444'));
    expect(order.indexOf('#ef4444')).toBeLessThan(order.indexOf('#fde047'));
    expect(order.indexOf('#fde047')).toBeLessThan(order.indexOf('#22c55e'));
    expect(order.indexOf('#22c55e')).toBeLessThan(order.indexOf('#93c5fd'));
  });
});
