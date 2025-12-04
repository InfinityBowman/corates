import { defineCollection, z } from 'astro:content';

const docs = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    category: z
      .enum([
        'getting-started',
        'evidence-synthesis',
        'amstar2',
        'systematic-reviews',
        'meta-analysis',
        'tools-methods',
      ])
      .default('getting-started'),
    order: z.number().default(100),
    tags: z.array(z.string()).optional(),
    lastUpdated: z.date().optional(),
  }),
});

const tutorials = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    estimatedTime: z.string().optional(),
    prerequisites: z.array(z.string()).optional(),
    order: z.number().default(100),
  }),
});

const glossary = defineCollection({
  type: 'content',
  schema: z.object({
    term: z.string(),
    abbreviation: z.string().optional(),
    relatedTerms: z.array(z.string()).optional(),
  }),
});

export const collections = {
  docs,
  tutorials,
  glossary,
};
