/**
 * Type definitions for the memory system
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export type McpServerType = McpServer;

// Knowledge entry types
export type KnowledgeType = 'fact' | 'decision' | 'procedure' | 'pattern';

export type SourceType = 'code' | 'discussion' | 'documentation' | 'observation';

export interface KnowledgeSource {
  type: SourceType;
  reference?: string;
}

export interface KnowledgeEntry {
  id: string;
  type: KnowledgeType;
  title: string;
  content: string;
  tags: string[];
  source?: KnowledgeSource;
  confidence: number;
  embedding: number[];
  version: number;
  supersededBy?: string;
  createdAt: string;
  updatedAt: string;
}

// Search types
export interface SearchQuery {
  query: string;
  types?: KnowledgeType[];
  tags?: string[];
  limit?: number;
  minConfidence?: number;
  includeSuperseded?: boolean;
}

export interface SearchResult {
  id: string;
  type: KnowledgeType;
  title: string;
  content: string;
  tags: string[];
  confidence: number;
  relevanceScore: number;
  createdAt: string;
  updatedAt: string;
  supersedes?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  totalMatches: number;
}

// Write types
export interface CreateEntryInput {
  type: KnowledgeType;
  title: string;
  content: string;
  tags?: string[];
  source?: KnowledgeSource;
  confidenceHint?: number;
}

export interface CreateEntryResult {
  status: 'accepted' | 'rejected';
  id?: string;
  confidence?: number;
  similarEntries?: Array<{ id: string; title: string; similarity: number }>;
  reason?: string;
  suggestion?: string;
}

// Update types
export type UpdateAction = 'supersede' | 'refine';

export interface UpdateEntryInput {
  targetId: string;
  action: UpdateAction;
  title?: string;
  content: string;
  justification: string;
  tags?: string[];
}

export interface UpdateEntryResult {
  status: 'accepted' | 'rejected';
  newId?: string;
  supersededId?: string;
  confidence?: number;
  reason?: string;
}

// Storage interface for adapter pattern
export interface MemoryStorage {
  // Core operations
  search(_query: SearchQuery, _embedding: number[]): Promise<SearchResponse>;
  create(
    _entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<string>;
  update(_id: string, _entry: Partial<KnowledgeEntry>): Promise<void>;
  supersede(
    _oldId: string,
    _newEntry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<string>;

  // Queries
  getById(_id: string): Promise<KnowledgeEntry | null>;
  findSimilar(
    _embedding: number[],
    _threshold: number,
    _limit: number,
  ): Promise<Array<{ entry: KnowledgeEntry; similarity: number }>>;

  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
}

// Embedding service interface
export interface EmbeddingService {
  embed(_text: string): Promise<number[]>;
  embedBatch(_texts: string[]): Promise<number[][]>;
  initialize(): Promise<void>;
}
