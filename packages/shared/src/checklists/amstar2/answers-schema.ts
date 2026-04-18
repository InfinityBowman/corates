/**
 * AMSTAR2 answer-payload schemas.
 *
 * Runtime Zod schemas and derived types for the `data` passed to
 * `handler.updateAnswer(answersMap, key, data)`. Distinct from the rendering
 * schema in `schema.ts` (which describes question UI) and the broader
 * interfaces in `../types.ts`.
 */

import { z } from 'zod';

export const Amstar2QuestionAnswerSchema = z.object({
  answers: z.array(z.array(z.boolean())),
  critical: z.boolean().optional(),
});

export type Amstar2QuestionAnswer = z.infer<typeof Amstar2QuestionAnswerSchema>;

export const Amstar2AnswersSchema = z.object({
  q1: Amstar2QuestionAnswerSchema,
  q2: Amstar2QuestionAnswerSchema,
  q3: Amstar2QuestionAnswerSchema,
  q4: Amstar2QuestionAnswerSchema,
  q5: Amstar2QuestionAnswerSchema,
  q6: Amstar2QuestionAnswerSchema,
  q7: Amstar2QuestionAnswerSchema,
  q8: Amstar2QuestionAnswerSchema,
  q9a: Amstar2QuestionAnswerSchema,
  q9b: Amstar2QuestionAnswerSchema,
  q10: Amstar2QuestionAnswerSchema,
  q11a: Amstar2QuestionAnswerSchema,
  q11b: Amstar2QuestionAnswerSchema,
  q12: Amstar2QuestionAnswerSchema,
  q13: Amstar2QuestionAnswerSchema,
  q14: Amstar2QuestionAnswerSchema,
  q15: Amstar2QuestionAnswerSchema,
  q16: Amstar2QuestionAnswerSchema,
});

export type Amstar2Answers = z.infer<typeof Amstar2AnswersSchema>;
export type Amstar2Key = keyof Amstar2Answers;
export type Amstar2AnswerFor<K extends Amstar2Key> = Amstar2Answers[K];

export const AMSTAR2_KEY_SCHEMAS: Record<Amstar2Key, typeof Amstar2QuestionAnswerSchema> = {
  q1: Amstar2QuestionAnswerSchema,
  q2: Amstar2QuestionAnswerSchema,
  q3: Amstar2QuestionAnswerSchema,
  q4: Amstar2QuestionAnswerSchema,
  q5: Amstar2QuestionAnswerSchema,
  q6: Amstar2QuestionAnswerSchema,
  q7: Amstar2QuestionAnswerSchema,
  q8: Amstar2QuestionAnswerSchema,
  q9a: Amstar2QuestionAnswerSchema,
  q9b: Amstar2QuestionAnswerSchema,
  q10: Amstar2QuestionAnswerSchema,
  q11a: Amstar2QuestionAnswerSchema,
  q11b: Amstar2QuestionAnswerSchema,
  q12: Amstar2QuestionAnswerSchema,
  q13: Amstar2QuestionAnswerSchema,
  q14: Amstar2QuestionAnswerSchema,
  q15: Amstar2QuestionAnswerSchema,
  q16: Amstar2QuestionAnswerSchema,
};

export function isAmstar2Key(key: string): key is Amstar2Key {
  return key in AMSTAR2_KEY_SCHEMAS;
}
