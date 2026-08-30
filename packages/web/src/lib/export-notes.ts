import {
  resolveNestedTextValue,
  textAnswerKeys,
  type ChecklistType,
} from '@corates/shared/sync';

export function getAmstar2SchemaKey(dataKey: string): string {
  if (dataKey === 'q9a' || dataKey === 'q9b') return 'q9';
  if (dataKey === 'q11a' || dataKey === 'q11b') return 'q11';
  return dataKey;
}

export function getAmstar2QuestionNote(
  raw: Record<string, { note?: string; answers?: boolean[][] }> | null | undefined,
  dataKey: string,
): string {
  const schemaKey = getAmstar2SchemaKey(dataKey);
  return raw?.[schemaKey]?.note?.trim() || '';
}

/** Flatten non-AMSTAR2 text fields (comments, free-text sections) for CSV export. */
export function collectChecklistTextNotes(
  answers: Record<string, unknown> | null | undefined,
  type: ChecklistType,
): string {
  if (!answers) return '';

  const parts: string[] = [];
  for (const key of textAnswerKeys(type)) {
    if (type === 'AMSTAR2' && key.endsWith('.note')) continue;
    const value = resolveNestedTextValue(answers, key)?.trim();
    if (value) parts.push(`${key}: ${value}`);
  }
  return parts.join('\n');
}
