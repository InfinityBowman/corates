/**
 * LocalTextAdapter - Y.Text-compatible adapter for local checklist comments
 *
 * Mimics Y.Text interface to enable NoteEditor to work with plain strings
 * in local checklists without requiring full Yjs infrastructure.
 */

/**
 * Creates adapter factory functions for local checklist text fields.
 * Encapsulates all the path resolution and caching logic.
 *
 * @param {Function} getChecklist - Getter for current checklist state
 * @param {Function} updateState - Function to update checklist state: (updater: (prev) => next) => void
 * @param {Function} save - Function to trigger debounced persistence (reads current state when it fires)
 * @returns {Object} Factory functions and cache control
 */
export function createLocalAdapterFactories(getChecklist, updateState, save) {
  const cache = new Map();

  function getOrCreateAdapter(path, getValue, getUpdatedState) {
    if (cache.has(path)) {
      return cache.get(path);
    }

    const currentValue = getValue(getChecklist());

    const adapter = new LocalTextAdapter(currentValue, newValue => {
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
  function getRob2Text(sectionKey, fieldKey, questionKey) {
    let path, getValue, getUpdatedState;

    if (sectionKey.startsWith('domain') && questionKey) {
      path = `${sectionKey}.${questionKey}.comment`;
      getValue = cl => cl?.[sectionKey]?.answers?.[questionKey]?.comment || '';
      getUpdatedState = (prev, newValue) => ({
        ...prev,
        [sectionKey]: {
          ...prev[sectionKey],
          answers: {
            ...prev[sectionKey]?.answers,
            [questionKey]: {
              ...prev[sectionKey]?.answers?.[questionKey],
              comment: newValue,
            },
          },
        },
      });
    } else if (sectionKey === 'preliminary') {
      path = `preliminary.${fieldKey}`;
      getValue = cl => cl?.preliminary?.[fieldKey] || '';
      getUpdatedState = (prev, newValue) => ({
        ...prev,
        preliminary: {
          ...prev.preliminary,
          [fieldKey]: newValue,
        },
      });
    } else {
      return null;
    }

    return getOrCreateAdapter(path, getValue, getUpdatedState);
  }

  // AMSTAR2: question notes
  function getQuestionNote(questionKey) {
    const path = `notes.${questionKey}`;
    const getValue = cl => cl?.notes?.[questionKey] || '';
    const getUpdatedState = (prev, newValue) => ({
      ...prev,
      notes: {
        ...prev.notes,
        [questionKey]: newValue,
      },
    });

    return getOrCreateAdapter(path, getValue, getUpdatedState);
  }

  // ROBINS-I: domain comments, sectionB comments, and section text fields
  function getRobinsText(sectionKey, fieldKey, questionKey) {
    let path, getValue, getUpdatedState;

    if (sectionKey.startsWith('domain') && questionKey) {
      path = `${sectionKey}.${questionKey}.comment`;
      getValue = cl => cl?.[sectionKey]?.answers?.[questionKey]?.comment || '';
      getUpdatedState = (prev, newValue) => ({
        ...prev,
        [sectionKey]: {
          ...prev[sectionKey],
          answers: {
            ...prev[sectionKey]?.answers,
            [questionKey]: {
              ...prev[sectionKey]?.answers?.[questionKey],
              comment: newValue,
            },
          },
        },
      });
    } else if (sectionKey === 'sectionB' && questionKey) {
      path = `sectionB.${questionKey}.comment`;
      getValue = cl => cl?.sectionB?.[questionKey]?.comment || '';
      getUpdatedState = (prev, newValue) => ({
        ...prev,
        sectionB: {
          ...prev.sectionB,
          [questionKey]: {
            ...prev.sectionB?.[questionKey],
            comment: newValue,
          },
        },
      });
    } else if (['sectionA', 'sectionC', 'sectionD', 'planning'].includes(sectionKey)) {
      path = `${sectionKey}.${fieldKey}`;
      getValue = cl => cl?.[sectionKey]?.[fieldKey] || '';
      getUpdatedState = (prev, newValue) => ({
        ...prev,
        [sectionKey]: {
          ...prev[sectionKey],
          [fieldKey]: newValue,
        },
      });
    } else {
      return null;
    }

    return getOrCreateAdapter(path, getValue, getUpdatedState);
  }

  function clearCache() {
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
  constructor(initialValue = '', onUpdate) {
    this._value = initialValue;
    this._onUpdate = onUpdate;
    this._observers = new Set();

    // Mock doc object with transact method (executes immediately)
    this.doc = {
      transact: fn => {
        fn();
      },
    };
  }

  toString() {
    return this._value;
  }

  get length() {
    return this._value.length;
  }

  observe(callback) {
    this._observers.add(callback);
  }

  unobserve(callback) {
    this._observers.delete(callback);
  }

  delete(index, length) {
    const before = this._value.substring(0, index);
    const after = this._value.substring(index + length);
    this._value = before + after;
    this._notifyUpdate();
  }

  insert(index, text) {
    const before = this._value.substring(0, index);
    const after = this._value.substring(index);
    this._value = before + text + after;
    this._notifyUpdate();
  }

  _notifyUpdate() {
    if (this._onUpdate) {
      this._onUpdate(this._value);
    }
    this._observers.forEach(callback => callback());
  }

  // Allow external sync of value (e.g., when checklist reloads)
  _syncValue(newValue) {
    if (this._value !== newValue) {
      this._value = newValue;
      this._observers.forEach(callback => callback());
    }
  }
}
