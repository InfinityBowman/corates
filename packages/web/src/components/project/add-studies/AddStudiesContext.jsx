/**
 * AddStudiesContext - Provides useAddStudies primitive to child sections
 * Eliminates prop drilling for PDF, Reference, DOI, and Google Drive sections
 */

import { createContext, useContext } from 'solid-js';

const AddStudiesContext = createContext();

/**
 * @param {Object} props
 * @param {Object} props.studies - The useAddStudies hook result
 * @param {'createProject' | 'addStudies'} [props.formType] - Form type for state persistence
 * @param {string} [props.projectId] - Project ID (for addStudies form type)
 * @param {() => Promise<void>} [props.onSaveFormState] - Called before OAuth redirect
 * @param {any} props.children
 */
export function AddStudiesProvider(props) {
  // The studies object is stable (from useAddStudies hook), only its internal signals are reactive
  // Using a getter satisfies the linter while preserving the same behavior
  const value = {
    get studies() {
      return props.studies;
    },
    get formType() {
      return props.formType;
    },
    get projectId() {
      return props.projectId;
    },
    get onSaveFormState() {
      return props.onSaveFormState;
    },
  };

  return <AddStudiesContext.Provider value={value}>{props.children}</AddStudiesContext.Provider>;
}

export function useStudiesContext() {
  const context = useContext(AddStudiesContext);
  if (!context) {
    throw new Error('useStudiesContext must be used within AddStudiesProvider');
  }
  return context.studies;
}

/**
 * Get form persistence props from context
 * @returns {{ formType?: string, projectId?: string, onSaveFormState?: () => Promise<void> }}
 */
export function useFormPersistenceContext() {
  const context = useContext(AddStudiesContext);
  if (!context) {
    throw new Error('useFormPersistenceContext must be used within AddStudiesProvider');
  }
  return {
    formType: context.formType,
    projectId: context.projectId,
    onSaveFormState: context.onSaveFormState,
  };
}
