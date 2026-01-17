/**
 * Local embedding service using Xenova/transformers
 */

import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import type { EmbeddingService } from '../types.js';
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from '../constants.js';

export class LocalEmbeddingService implements EmbeddingService {
  private extractor: FeatureExtractionPipeline | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.extractor) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.loadModel();
    return this.initPromise;
  }

  private async loadModel(): Promise<void> {
    // Load the model - first run downloads it, subsequent runs use cache
    this.extractor = await pipeline('feature-extraction', EMBEDDING_MODEL, {
      // Quantized model for faster inference
      quantized: true,
    });
  }

  async embed(text: string): Promise<number[]> {
    await this.initialize();
    if (!this.extractor) {
      throw new Error('Embedding model not initialized');
    }

    // Mean pooling over tokens
    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });

    // Extract the embedding array
    const embedding = Array.from(output.data as Float32Array);

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Unexpected embedding dimensions: ${embedding.length}, expected ${EMBEDDING_DIMENSIONS}`,
      );
    }

    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // For simplicity, process sequentially
    // Could optimize with batching if needed
    const embeddings: number[][] = [];
    for (const text of texts) {
      embeddings.push(await this.embed(text));
    }
    return embeddings;
  }
}
