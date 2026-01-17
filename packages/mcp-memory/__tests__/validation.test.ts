/**
 * Tests for validation schemas
 */

import { describe, it, expect } from 'vitest';
import { SearchQuerySchema, CreateEntrySchema, UpdateEntrySchema } from '../src/validation.js';

describe('SearchQuerySchema', () => {
  it('should accept valid search query', () => {
    const result = SearchQuerySchema.safeParse({
      query: 'authentication patterns',
      types: ['pattern', 'decision'],
      limit: 5,
    });

    expect(result.success).toBe(true);
  });

  it('should reject empty query', () => {
    const result = SearchQuerySchema.safeParse({
      query: '',
    });

    expect(result.success).toBe(false);
  });

  it('should apply defaults', () => {
    const result = SearchQuerySchema.parse({
      query: 'test',
    });

    expect(result.limit).toBe(10);
    expect(result.min_confidence).toBe(0.3);
  });

  it('should reject invalid types', () => {
    const result = SearchQuerySchema.safeParse({
      query: 'test',
      types: ['invalid'],
    });

    expect(result.success).toBe(false);
  });
});

describe('CreateEntrySchema', () => {
  it('should accept valid entry', () => {
    const result = CreateEntrySchema.safeParse({
      type: 'fact',
      title: 'Valid Title',
      content: 'This is valid content for the entry.',
      tags: ['test'],
    });

    expect(result.success).toBe(true);
  });

  it('should reject title too short', () => {
    const result = CreateEntrySchema.safeParse({
      type: 'fact',
      title: 'Hi',
      content: 'Valid content here.',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('title');
    }
  });

  it('should reject title too long', () => {
    const result = CreateEntrySchema.safeParse({
      type: 'fact',
      title: 'A'.repeat(101),
      content: 'Valid content here.',
    });

    expect(result.success).toBe(false);
  });

  it('should reject content too short', () => {
    const result = CreateEntrySchema.safeParse({
      type: 'fact',
      title: 'Valid Title',
      content: 'Short',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('content');
    }
  });

  it('should accept source with reference', () => {
    const result = CreateEntrySchema.safeParse({
      type: 'decision',
      title: 'Valid Title',
      content: 'This is valid content for the entry.',
      source: {
        type: 'code',
        reference: 'src/index.ts',
      },
    });

    expect(result.success).toBe(true);
  });

  it('should accept confidence hint', () => {
    const result = CreateEntrySchema.parse({
      type: 'pattern',
      title: 'Valid Pattern',
      content: 'This is a pattern that is used.',
      confidence_hint: 0.9,
    });

    expect(result.confidence_hint).toBe(0.9);
  });

  it('should reject invalid confidence hint', () => {
    const result = CreateEntrySchema.safeParse({
      type: 'pattern',
      title: 'Valid Pattern',
      content: 'This is a pattern that is used.',
      confidence_hint: 1.5,
    });

    expect(result.success).toBe(false);
  });
});

describe('UpdateEntrySchema', () => {
  it('should accept valid supersede', () => {
    const result = UpdateEntrySchema.safeParse({
      target_id: '550e8400-e29b-41d4-a716-446655440000',
      action: 'supersede',
      title: 'New Title',
      content: 'Updated content here.',
      justification: 'Information was outdated.',
    });

    expect(result.success).toBe(true);
  });

  it('should accept valid refine', () => {
    const result = UpdateEntrySchema.safeParse({
      target_id: '550e8400-e29b-41d4-a716-446655440000',
      action: 'refine',
      content: 'Refined content here.',
      justification: 'Added more detail.',
    });

    expect(result.success).toBe(true);
  });

  it('should reject invalid UUID', () => {
    const result = UpdateEntrySchema.safeParse({
      target_id: 'not-a-uuid',
      action: 'refine',
      content: 'Valid content here.',
      justification: 'Valid justification.',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('target_id');
    }
  });

  it('should reject empty justification', () => {
    const result = UpdateEntrySchema.safeParse({
      target_id: '550e8400-e29b-41d4-a716-446655440000',
      action: 'refine',
      content: 'Valid content here.',
      justification: 'Hi',
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid action', () => {
    const result = UpdateEntrySchema.safeParse({
      target_id: '550e8400-e29b-41d4-a716-446655440000',
      action: 'delete',
      content: 'Valid content here.',
      justification: 'Valid justification.',
    });

    expect(result.success).toBe(false);
  });
});
