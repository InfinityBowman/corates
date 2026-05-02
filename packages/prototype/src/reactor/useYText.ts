import { useState, useEffect, useCallback } from 'react';
import * as Y from 'yjs';

export function useYText(yText: Y.Text | null): [string, (val: string) => void] {
  const [value, setValue] = useState(() => yText?.toString() ?? '');

  useEffect(() => {
    if (!yText) {
      setValue('');
      return;
    }
    setValue(yText.toString());
    const observer = () => setValue(yText.toString());
    yText.observe(observer);
    return () => yText.unobserve(observer);
  }, [yText]);

  const update = useCallback(
    (newValue: string) => {
      if (!yText) return;
      yText.doc?.transact(() => {
        yText.delete(0, yText.length);
        yText.insert(0, newValue);
      });
    },
    [yText],
  );

  return [value, update];
}

export function resolveYText(
  ydoc: Y.Doc,
  studyId: string,
  checklistId: string,
  flatKey: string,
): Y.Text | null {
  const reviews = ydoc.getMap('reviews');
  const study = reviews.get(studyId) as Y.Map<unknown> | undefined;
  if (!study) return null;
  const checklists = study.get('checklists') as Y.Map<unknown> | undefined;
  const cl = checklists?.get(checklistId) as Y.Map<unknown> | undefined;
  if (!cl) return null;
  const answers = cl.get('answers') as Y.Map<unknown> | undefined;
  if (!answers) return null;
  const val = answers.get(flatKey);
  return val instanceof Y.Text ? val : null;
}
