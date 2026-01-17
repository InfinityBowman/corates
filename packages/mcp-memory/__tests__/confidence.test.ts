/**
 * Tests for confidence scoring
 */

import { describe, it, expect } from 'vitest';
import { computeConfidence } from '../src/confidence.js';

describe('computeConfidence', () => {
  it('should return base confidence for minimal entry', () => {
    const confidence = computeConfidence({
      type: 'fact',
      content: 'Short content.',
    });

    // Base fact confidence is 0.6
    expect(confidence).toBeGreaterThanOrEqual(0.6);
    expect(confidence).toBeLessThan(0.75);
  });

  it('should increase confidence with source', () => {
    const withoutSource = computeConfidence({
      type: 'decision',
      content: 'A decision was made.',
    });

    const withSource = computeConfidence({
      type: 'decision',
      content: 'A decision was made.',
      source: { type: 'discussion' },
    });

    expect(withSource).toBeGreaterThan(withoutSource);
  });

  it('should increase confidence with source reference', () => {
    const withoutRef = computeConfidence({
      type: 'pattern',
      content: 'A pattern is used.',
      source: { type: 'code' },
    });

    const withRef = computeConfidence({
      type: 'pattern',
      content: 'A pattern is used.',
      source: { type: 'code', reference: 'src/index.ts' },
    });

    expect(withRef).toBeGreaterThan(withoutRef);
  });

  it('should increase confidence with longer content', () => {
    const shortContent = computeConfidence({
      type: 'procedure',
      content: 'Do this.',
    });

    const longContent = computeConfidence({
      type: 'procedure',
      content:
        'Step 1: Do this thing first. Step 2: Then do this other thing. Step 3: Finally, complete the process by doing this last thing. This ensures everything is done correctly.',
    });

    expect(longContent).toBeGreaterThan(shortContent);
  });

  it('should factor in agent confidence hint', () => {
    const noHint = computeConfidence({
      type: 'fact',
      content: 'A fact about something.',
    });

    const highHint = computeConfidence({
      type: 'fact',
      content: 'A fact about something.',
      confidenceHint: 0.95,
    });

    const lowHint = computeConfidence({
      type: 'fact',
      content: 'A fact about something.',
      confidenceHint: 0.2,
    });

    expect(highHint).toBeGreaterThan(noHint);
    expect(lowHint).toBeLessThan(noHint);
  });

  it('should clamp confidence to [0, 1]', () => {
    const maxConfidence = computeConfidence({
      type: 'fact',
      content: 'A'.repeat(1000),
      source: { type: 'code', reference: 'src/test.ts' },
      confidenceHint: 1.0,
    });

    expect(maxConfidence).toBeLessThanOrEqual(1);

    const minConfidence = computeConfidence({
      type: 'pattern',
      content: 'Short.',
      confidenceHint: 0,
    });

    expect(minConfidence).toBeGreaterThanOrEqual(0);
  });

  it('should vary by knowledge type', () => {
    const content = 'Same content for all types here.';

    const factConf = computeConfidence({ type: 'fact', content });
    const decisionConf = computeConfidence({ type: 'decision', content });
    const _procedureConf = computeConfidence({ type: 'procedure', content });
    const patternConf = computeConfidence({ type: 'pattern', content });

    // Facts have highest base confidence
    expect(factConf).toBeGreaterThan(decisionConf);
    expect(factConf).toBeGreaterThan(patternConf);
  });
});
