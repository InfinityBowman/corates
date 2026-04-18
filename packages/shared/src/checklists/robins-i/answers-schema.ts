/**
 * ROBINS-I answer-payload schemas.
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

export const RobinsIDomainUpdateSchema = z
  .object({
    judgement: z.string().nullable().optional(),
    judgementSource: z.string().optional(),
    direction: z.string().nullable().optional(),
    answers: z.record(z.string(), QuestionEntrySchema).optional(),
  })
  .strict();

export const RobinsIOverallUpdateSchema = z
  .object({
    judgement: z.string().nullable().optional(),
    judgementSource: z.string().optional(),
    direction: z.string().nullable().optional(),
  })
  .strict();

export const RobinsISectionBUpdateSchema = z
  .object({
    b1: QuestionEntrySchema.optional(),
    b2: QuestionEntrySchema.optional(),
    b3: QuestionEntrySchema.optional(),
    stopAssessment: z.boolean().optional(),
  })
  .strict();

export const RobinsISectionDUpdateSchema = z
  .object({
    sources: z.record(z.string(), z.boolean()).optional(),
    otherSpecify: z.string().optional(),
  })
  .strict();

export const RobinsIConfoundingEvaluationUpdateSchema = z
  .object({
    predefined: z.array(z.unknown()).optional(),
    additional: z.array(z.unknown()).optional(),
  })
  .strict();

export const RobinsIPlanningUpdateSchema = z
  .object({
    confoundingFactors: z.string().optional(),
  })
  .strict();

export const RobinsISectionAUpdateSchema = z
  .object({
    numericalResult: z.string().optional(),
    furtherDetails: z.string().optional(),
    outcome: z.string().optional(),
  })
  .strict();

export const RobinsISectionCUpdateSchema = z
  .object({
    isPerProtocol: z.boolean().optional(),
    participants: z.string().optional(),
    interventionStrategy: z.string().optional(),
    comparatorStrategy: z.string().optional(),
  })
  .strict();

export const ROBINS_I_KEY_SCHEMAS = {
  planning: RobinsIPlanningUpdateSchema,
  sectionA: RobinsISectionAUpdateSchema,
  sectionB: RobinsISectionBUpdateSchema,
  sectionC: RobinsISectionCUpdateSchema,
  sectionD: RobinsISectionDUpdateSchema,
  confoundingEvaluation: RobinsIConfoundingEvaluationUpdateSchema,
  domain1a: RobinsIDomainUpdateSchema,
  domain1b: RobinsIDomainUpdateSchema,
  domain2: RobinsIDomainUpdateSchema,
  domain3: RobinsIDomainUpdateSchema,
  domain4: RobinsIDomainUpdateSchema,
  domain5: RobinsIDomainUpdateSchema,
  domain6: RobinsIDomainUpdateSchema,
  overall: RobinsIOverallUpdateSchema,
} as const;

export type RobinsIAnswers = {
  [K in keyof typeof ROBINS_I_KEY_SCHEMAS]: z.infer<(typeof ROBINS_I_KEY_SCHEMAS)[K]>;
};
export type RobinsIKey = keyof RobinsIAnswers;
export type RobinsIAnswerFor<K extends RobinsIKey> = RobinsIAnswers[K];

export function isRobinsIKey(key: string): key is RobinsIKey {
  return key in ROBINS_I_KEY_SCHEMAS;
}
