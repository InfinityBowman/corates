/**
 * Constants for the memory system
 */

// Embedding dimensions for all-MiniLM-L6-v2
export const EMBEDDING_DIMENSIONS = 384;

// Model identifier
export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

// Validation limits
export const TITLE_MIN_LENGTH = 5;
export const TITLE_MAX_LENGTH = 100;
export const CONTENT_MIN_LENGTH = 10;
export const CONTENT_MAX_LENGTH = 5000;

// Search defaults
export const DEFAULT_SEARCH_LIMIT = 10;
export const MAX_SEARCH_LIMIT = 50;
export const DEFAULT_MIN_CONFIDENCE = 0.3;

// Deduplication threshold (cosine similarity)
export const DUPLICATE_THRESHOLD = 0.92;

// Ranking weights
export const RANKING_WEIGHTS = {
  similarity: 0.7,
  confidence: 0.2,
  recency: 0.1,
} as const;

// Recency scoring (days)
export const RECENCY_DECAY_DAYS = 180; // 6 months

// Database file location (relative to repo root)
export const DATABASE_PATH = '.mcp/memory.db';

// Schema version for migrations
export const SCHEMA_VERSION = 1;
