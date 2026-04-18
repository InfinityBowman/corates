/**
 * RoB2 answer-payload schemas.
 *
 * Runtime Zod schemas and derived types for the `data` passed to
 * `handler.updateAnswer(answersMap, key, data)`. Distinct from the rendering
 * schema in `schema.ts` and the broader interfaces in `../types.ts`.
 */

import { z } from 'zod';

const QuestionEntrySchema = z.object({
  answer: z.string().nullable().optional(),
  comment: z.string().optional(),
});

export const Rob2DomainUpdateSchema = z
  .object({
    judgement: z.string().nullable().optional(),
    direction: z.string().nullable().optional(),
    answers: z.record(z.string(), QuestionEntrySchema).optional(),
  })
  .strict();

export const Rob2OverallUpdateSchema = z
  .object({
    judgement: z.string().nullable().optional(),
    direction: z.string().nullable().optional(),
  })
  .strict();

export const Rob2PreliminaryUpdateSchema = z
  .object({
    studyDesign: z.string().nullable().optional(),
    experimental: z.string().optional(),
    comparator: z.string().optional(),
    numericalResult: z.string().optional(),
    aim: z.string().nullable().optional(),
    deviationsToAddress: z.array(z.string()).optional(),
    sources: z.record(z.string(), z.boolean()).optional(),
  })
  .strict();

export const ROB2_KEY_SCHEMAS = {
  preliminary: Rob2PreliminaryUpdateSchema,
  domain1: Rob2DomainUpdateSchema,
  domain2a: Rob2DomainUpdateSchema,
  domain2b: Rob2DomainUpdateSchema,
  domain3: Rob2DomainUpdateSchema,
  domain4: Rob2DomainUpdateSchema,
  domain5: Rob2DomainUpdateSchema,
  overall: Rob2OverallUpdateSchema,
} as const;

export type Rob2Answers = {
  [K in keyof typeof ROB2_KEY_SCHEMAS]: z.infer<(typeof ROB2_KEY_SCHEMAS)[K]>;
};
export type Rob2Key = keyof Rob2Answers;
export type Rob2AnswerFor<K extends Rob2Key> = Rob2Answers[K];

export function isRob2Key(key: string): key is Rob2Key {
  return key in ROB2_KEY_SCHEMAS;
}
