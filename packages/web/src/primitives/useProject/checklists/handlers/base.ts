/**
 * Base handler interface for checklist type-specific operations
 */

import * as Y from 'yjs';
import { applyYTextDiff } from '@/hooks/useYText';

export type TextGetterFn = (
  studyId: string,
  checklistId: string,
  sectionKey: string,
  fieldKey: string,
  questionKey?: string | null,
) => Y.Text | null;

export abstract class ChecklistHandler {
  abstract extractAnswersFromTemplate(template: Record<string, unknown>): Record<string, unknown>;
  abstract createAnswersYMap(answersData: Record<string, unknown>): Y.Map<unknown>;

  serializeKey(_key: string, sectionYMap: unknown): unknown {
    const section = sectionYMap as { toJSON?: () => unknown };
    return section.toJSON ? section.toJSON() : sectionYMap;
  }

  serializeAnswers(answersMap: Y.Map<unknown>): Record<string, unknown> {
    const answers: Record<string, unknown> = {};
    for (const [key, sectionYMap] of answersMap.entries()) {
      answers[key] = this.serializeKey(key, sectionYMap);
    }
    return answers;
  }

  getTextGetter(_getYDoc: () => Y.Doc | null): TextGetterFn | null {
    return null;
  }

  setYTextField(map: Y.Map<unknown>, fieldKey: string, value: string | null): void {
    const str = value ?? '';
    const existing = map.get(fieldKey);
    if (existing instanceof Y.Text) {
      if (existing.toString() === str) return;
      applyYTextDiff(existing, existing.toString(), str);
    } else {
      const newText = new Y.Text();
      newText.insert(0, str);
      map.set(fieldKey, newText);
    }
  }
}

export function yTextToString(value: unknown): string {
  if (value instanceof Y.Text) {
    return value.toString();
  }
  return (value as string) ?? '';
}
