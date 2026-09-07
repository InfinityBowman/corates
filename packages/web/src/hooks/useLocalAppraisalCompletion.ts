/**
 * Emits `client.local_appraisal.completed` once per local checklist. Local
 * practice has no status or Mark Complete, so done means the score first
 * becomes computable, the same completeness the export path uses.
 */

import { useEffect, useRef } from 'react';
import { clientLogger } from '@/lib/clientLogger';

const STORAGE_KEY = 'corates:local-appraisals-completed';

function readCompleted(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** True the first time this checklist is recorded; false if it already was. */
export function markLocalAppraisalCompleted(checklistId: string): boolean {
  const completed = readCompleted();
  if (completed.includes(checklistId)) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed, checklistId]));
  } catch {
    // Storage unavailable: still emit once this session.
  }
  return true;
}

export function useLocalAppraisalCompletion(
  checklistId: string,
  checklistType: string | null,
  score: string | null,
): void {
  // Only a null-to-score transition counts, so opening an already complete
  // checklist emits nothing.
  const previousScore = useRef(score);

  useEffect(() => {
    const becameComplete = previousScore.current === null && score !== null;
    previousScore.current = score;
    if (!becameComplete || !checklistType) return;
    if (markLocalAppraisalCompleted(checklistId)) {
      clientLogger.info('client.local_appraisal.completed', { type: checklistType });
    }
  }, [checklistId, checklistType, score]);
}
