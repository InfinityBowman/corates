/**
 * Validation utilities for memory entries
 */

import { z } from 'zod';
import {
  TITLE_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  CONTENT_MIN_LENGTH,
  CONTENT_MAX_LENGTH,
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  DEFAULT_MIN_CONFIDENCE,
} from './constants.js';

// Knowledge types enum
export const KnowledgeTypeSchema = z.enum(['fact', 'decision', 'procedure', 'pattern']);

// Source types enum
export const SourceTypeSchema = z.enum(['code', 'discussion', 'documentation', 'observation']);

// Source schema
export const SourceSchema = z.object({
  type: SourceTypeSchema,
  reference: z.string().optional(),
});

// Search query schema
export const SearchQuerySchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  types: z.array(KnowledgeTypeSchema).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(MAX_SEARCH_LIMIT).optional().default(DEFAULT_SEARCH_LIMIT),
  min_confidence: z.number().min(0).max(1).optional().default(DEFAULT_MIN_CONFIDENCE),
});

// Create entry schema
export const CreateEntrySchema = z.object({
  type: KnowledgeTypeSchema,
  title: z
    .string()
    .min(TITLE_MIN_LENGTH, `Title must be at least ${TITLE_MIN_LENGTH} characters`)
    .max(TITLE_MAX_LENGTH, `Title must be at most ${TITLE_MAX_LENGTH} characters`),
  content: z
    .string()
    .min(CONTENT_MIN_LENGTH, `Content must be at least ${CONTENT_MIN_LENGTH} characters`)
    .max(CONTENT_MAX_LENGTH, `Content must be at most ${CONTENT_MAX_LENGTH} characters`),
  tags: z.array(z.string()).optional().default([]),
  source: SourceSchema.optional(),
  confidence_hint: z.number().min(0).max(1).optional(),
});

// Update action enum
export const UpdateActionSchema = z.enum(['supersede', 'refine']);

// Update entry schema
export const UpdateEntrySchema = z.object({
  target_id: z.string().uuid('Invalid entry ID'),
  action: UpdateActionSchema,
  title: z.string().min(TITLE_MIN_LENGTH).max(TITLE_MAX_LENGTH).optional(),
  content: z
    .string()
    .min(CONTENT_MIN_LENGTH, `Content must be at least ${CONTENT_MIN_LENGTH} characters`)
    .max(CONTENT_MAX_LENGTH, `Content must be at most ${CONTENT_MAX_LENGTH} characters`),
  justification: z.string().min(5, 'Justification must be at least 5 characters'),
  tags: z.array(z.string()).optional(),
});

// Type exports for use in tools
export type SearchQueryInput = z.input<typeof SearchQuerySchema>;
export type CreateEntryInput = z.input<typeof CreateEntrySchema>;
export type UpdateEntryInput = z.input<typeof UpdateEntrySchema>;
