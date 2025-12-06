/**
 * AddStudiesContext - Provides useAddStudies primitive to child sections
 * Eliminates prop drilling for PDF, Reference, DOI, and Google Drive sections
 */

import { createContext, useContext } from 'solid-js';

const AddStudiesContext = createContext();

export function AddStudiesProvider(props) {
  // The studies object is stable (from useAddStudies hook), only its internal signals are reactive
  // Using a getter satisfies the linter while preserving the same behavior
  const value = {
    get studies() {
      return props.studies;
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
