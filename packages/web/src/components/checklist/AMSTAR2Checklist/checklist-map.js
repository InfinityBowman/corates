/**
 * AMSTAR2 Checklist Schema/Map
 *
 * Re-exports the checklist schema from @corates/shared for backward compatibility.
 * All new code should import directly from @corates/shared.
 */

import { amstar2 } from '@corates/shared';

// Re-export from shared package
export const AMSTAR_CHECKLIST = amstar2.AMSTAR_CHECKLIST;
export const CHECKLIST_TYPES = amstar2.AMSTAR2_CHECKLIST_TYPES;

// Question keys for iteration
export const AMSTAR2_QUESTION_KEYS = amstar2.AMSTAR2_QUESTION_KEYS;
export const AMSTAR2_DATA_KEYS = amstar2.AMSTAR2_DATA_KEYS;
export const AMSTAR2_CRITICAL_QUESTIONS = amstar2.AMSTAR2_CRITICAL_QUESTIONS;
