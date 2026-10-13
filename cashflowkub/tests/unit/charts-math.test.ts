import { describe, expect, it } from 'vitest';
import { donutArcs, trendPoints } from '@/components/cfk/charts-math';

describe('donutArcs', () => {
  it('splits the circumference proportionally with running offsets', () => {
    const circ = 2 * Math.PI * 10;
    const arcs = donutArcs([1, 3], 10);
    expect(arcs[0].length).toBeCloseTo(circ * 0.25);
    expect(arcs[1].length).toBeCloseTo(circ * 0.75);
    expect(arcs[1].offset).toBeCloseTo(circ * 0.25);
  });
  it('treats values as fractions when they sum below 1 (progress rings)', () => {
    const circ = 2 * Math.PI * 10;
    expect(donutArcs([0.25], 10)[0].length).toBeCloseTo(circ * 0.25);
  });
});

describe('trendPoints', () => {
  it('maps min to the bottom and max to the top', () => {
    expect(trendPoints([0, 10], 100, 50, 0)).toEqual({ line: '0,50 100,0', area: '0,50 0,50 100,0 100,50' });
  });
  it('survives flat and empty series', () => {
    expect(trendPoints([5, 5], 100, 50, 0).line).toBe('0,50 100,50');
    expect(trendPoints([], 100, 50, 0)).toEqual({ line: '', area: '' });
  });
});
