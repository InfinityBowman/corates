import { describe, it, expect } from 'vitest';
import { fitToWidth } from '@/lib/fitToWidth';

describe('fitToWidth', () => {
  it('cuts text with an ellipsis until the measurer says it fits', () => {
    // Wide characters make the first estimate overshoot, so the loop has to correct it.
    const wide = (text: string) => text.length * 3;
    const fitted = fitToWidth('Effectiveness of a community intervention on outcomes', 30, wide);

    expect(wide(fitted)).toBeLessThanOrEqual(30);
    expect(fitted.endsWith('...')).toBe(true);
    expect(fitToWidth('Trial A', 30, wide)).toBe('Trial A');
  });
});
