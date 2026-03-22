/**
 * LocalTextAdapter - Y.Text-compatible adapter for local checklist comments
 *
 * Mimics Y.Text interface to enable NoteEditor to work with plain strings
 * in local checklists without requiring full Yjs infrastructure.
 */

type ObserverCallback = () => void;
type UpdateCallback = (newValue: string) => void;
type ChecklistGetter = () => Record<string, unknown> | null;
type StateUpdater = (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
type SaveFn = () => void;
type ValueGetter = (checklist: Record<string, unknown> | null) => string;
type StateUpdateGetter = (
  prev: Record<string, unknown>,
  newValue: string,
) => Record<string, unknown>;

export interface LocalAdapterFactories {
  getRob2Text: (
    sectionKey: string,
    fieldKey: string,
    questionKey?: string,
  ) => LocalTextAdapter | null;
  getQuestionNote: (questionKey: string) => LocalTextAdapter;
  getRobinsText: (
    sectionKey: string,
    fieldKey: string,
    questionKey?: string,
  ) => LocalTextAdapter | null;
  clearCache: () => void;
}

/**
 * Creates adapter factory functions for local checklist text fields.
 * Encapsulates all the path resolution and caching logic.
 */
export function createLocalAdapterFactories(
  getChecklist: ChecklistGetter,
  updateState: StateUpdater,
  save: SaveFn,
): LocalAdapterFactories {
  const cache = new Map<string, LocalTextAdapter>();

  function getOrCreateAdapter(
    path: string,
    getValue: ValueGetter,
    getUpdatedState: StateUpdateGetter,
  ): LocalTextAdapter {
    if (cache.has(path)) {
      return cache.get(path)!;
    }

    const currentValue = getValue(getChecklist());

    const adapter = new LocalTextAdapter(currentValue, (newValue: string) => {
      updateState(prev => {
        if (!prev) return prev;
        const updated = getUpdatedState(prev, newValue);
        // Trigger save after state is updated - save() reads current state when it fires
        save();
        return updated;
      });
    });

    cache.set(path, adapter);
    return adapter;
  }

  // ROB2: domain comments and preliminary text fields
  function getRob2Text(
    sectionKey: string,
    fieldKey: string,
    questionKey?: string,
  ): LocalTextAdapter | null {
    let path: string;
    let getValue: ValueGetter;
    let getUpdatedState: StateUpdateGetter;

    if (sectionKey.startsWith('domain') && questionKey) {
      path = `${sectionKey}.${questionKey}.comment`;
      getValue = (cl): string =>
        (
          (cl?.[sectionKey] as Record<string, unknown>)?.answers as Record<
            string,
            Record<string, unknown>
          >
        )?.[questionKey]?.comment as string || '';
      getUpdatedState = (prev, newValue) => ({
        ...prev,
        [sectionKey]: {
          ...(prev[sectionKey] as Record<string, unknown>),
          answers: {
            ...((prev[sectionKey] as Record<string, unknown>)?.answers as Record<string, unknown>),
            [questionKey]: {
              ...(
                ((prev[sectionKey] as Record<string, unknown>)?.answers as Record<
                  string,
                  Record<string, unknown>
                >) ?? {}
              )[questionKey],
              comment: newValue,
            },
          },
        },
      });
    } else if (sectionKey === 'preliminary') {
      path = `preliminary.${fieldKey}`;
      getValue = (cl): string =>
        ((cl?.preliminary as Record<string, unknown>)?.[fieldKey] as string) || '';
      getUpdatedState = (prev, newValue) => ({
        ...prev,
        preliminary: {
          ...(prev.preliminary as Record<string, unknown>),
          [fieldKey]: newValue,
        },
      });
    } else {
      return null;
    }

    return getOrCreateAdapter(path, getValue, getUpdatedState);
  }

  // AMSTAR2: question notes
  function getQuestionNote(questionKey: string): LocalTextAdapter {
    const path = `notes.${questionKey}`;
    const getValue: ValueGetter = (cl): string =>
      ((cl?.notes as Record<string, unknown>)?.[questionKey] as string) || '';
    const getUpdatedState: StateUpdateGetter = (prev, newValue) => ({
      ...prev,
      notes: {
        ...(prev.notes as Record<string, unknown>),
        [questionKey]: newValue,
      },
    });

    return getOrCreateAdapter(path, getValue, getUpdatedState);
  }

  // ROBINS-I: domain comments, sectionB comments, and section text fields
  function getRobinsText(
    sectionKey: string,
    fieldKey: string,
    questionKey?: string,
  ): LocalTextAdapter | null {
    let path: string;
    let getValue: ValueGetter;
    let getUpdatedState: StateUpdateGetter;

    if (sectionKey.startsWith('domain') && questionKey) {
      path = `${sectionKey}.${questionKey}.comment`;
      getValue = (cl): string =>
        (
          (cl?.[sectionKey] as Record<string, unknown>)?.answers as Record<
            string,
            Record<string, unknown>
          >
        )?.[questionKey]?.comment as string || '';
      getUpdatedState = (prev, newValue) => ({
        ...prev,
        [sectionKey]: {
          ...(prev[sectionKey] as Record<string, unknown>),
          answers: {
            ...((prev[sectionKey] as Record<string, unknown>)?.answers as Record<string, unknown>),
            [questionKey]: {
              ...(
                ((prev[sectionKey] as Record<string, unknown>)?.answers as Record<
                  string,
                  Record<string, unknown>
                >) ?? {}
              )[questionKey],
              comment: newValue,
            },
          },
        },
      });
    } else if (sectionKey === 'sectionB' && questionKey) {
      path = `sectionB.${questionKey}.comment`;
      getValue = (cl): string =>
        ((cl?.sectionB as Record<string, Record<string, unknown>>)?.[questionKey]?.comment as string) || '';
      getUpdatedState = (prev, newValue) => ({
        ...prev,
        sectionB: {
          ...(prev.sectionB as Record<string, unknown>),
          [questionKey]: {
            ...((prev.sectionB as Record<string, Record<string, unknown>>)?.[questionKey]),
            comment: newValue,
          },
        },
      });
    } else if (['sectionA', 'sectionC', 'sectionD', 'planning'].includes(sectionKey)) {
      path = `${sectionKey}.${fieldKey}`;
      getValue = (cl): string =>
        ((cl?.[sectionKey] as Record<string, unknown>)?.[fieldKey] as string) || '';
      getUpdatedState = (prev, newValue) => ({
        ...prev,
        [sectionKey]: {
          ...(prev[sectionKey] as Record<string, unknown>),
          [fieldKey]: newValue,
        },
      });
    } else {
      return null;
    }

    return getOrCreateAdapter(path, getValue, getUpdatedState);
  }

  function clearCache(): void {
    cache.clear();
  }

  return {
    getRob2Text,
    getQuestionNote,
    getRobinsText,
    clearCache,
  };
}

export class LocalTextAdapter {
  private _value: string;
  private _onUpdate: UpdateCallback | undefined;
  private _observers: Set<ObserverCallback>;

  /** Mock doc object with transact method (executes immediately) */
  doc: { transact: (fn: () => void) => void };

  constructor(initialValue: string = '', onUpdate?: UpdateCallback) {
    this._value = initialValue;
    this._onUpdate = onUpdate;
    this._observers = new Set();

    this.doc = {
      transact: (fn: () => void) => {
        fn();
      },
    };
  }

  toString(): string {
    return this._value;
  }

  get length(): number {
    return this._value.length;
  }

  observe(callback: ObserverCallback): void {
    this._observers.add(callback);
  }

  unobserve(callback: ObserverCallback): void {
    this._observers.delete(callback);
  }

  delete(index: number, length: number): void {
    const before = this._value.substring(0, index);
    const after = this._value.substring(index + length);
    this._value = before + after;
    this._notifyUpdate();
  }

  insert(index: number, text: string): void {
    const before = this._value.substring(0, index);
    const after = this._value.substring(index);
    this._value = before + text + after;
    this._notifyUpdate();
  }

  private _notifyUpdate(): void {
    if (this._onUpdate) {
      this._onUpdate(this._value);
    }
    this._observers.forEach(callback => callback());
  }

  /** Allow external sync of value (e.g., when checklist reloads) */
  _syncValue(newValue: string): void {
    if (this._value !== newValue) {
      this._value = newValue;
      this._observers.forEach(callback => callback());
    }
  }
}
