/**
 * Form-level error handling utilities
 * Handles validation errors with field-level details and multi-field errors
 */

interface FormError {
  code: string;
  message: string;
  statusCode?: number;
  details?: {
    field?: string;
    fields?: Array<{ field: string; message: string }>;
    [key: string]: unknown;
  };
}

/**
 * Handle form errors - extracts field-level errors from validation errors
 */
export function handleFormError(
  error: FormError | null | undefined,
  setFieldError: (field: string, message: string) => void,
  setGlobalError: (message: string) => void,
): boolean {
  if (!error || !error.code) {
    return false;
  }

  // Handle validation errors with field details
  if (error.code.startsWith('VALIDATION_')) {
    const details = error.details;

    // Single field error
    if (details?.field) {
      setFieldError(details.field, error.message);
      return true;
    }

    // Multi-field errors
    if (details?.fields && Array.isArray(details.fields)) {
      details.fields.forEach(({ field, message }) => {
        if (field && message) {
          setFieldError(field, message);
        }
      });
      return true;
    }

    // Validation error without field details - show as global error
    setGlobalError(error.message);
    return true;
  }

  // Other domain errors - show as global error
  if (error.statusCode) {
    setGlobalError(error.message);
    return true;
  }

  // Transport errors - show as global error
  setGlobalError(error.message);
  return true;
}

interface FormErrorState {
  setFieldError(field: string, message: string): void;
  getFieldError(field: string): string | undefined;
  clearFieldError(field: string): void;
  clearAll(): void;
  hasFieldError(field: string): boolean;
  getAllErrors(): Record<string, string>;
  hasErrors(): boolean;
}

/**
 * Create a field error state manager
 * Returns a store-like object with field errors and helper functions
 */
export function createFormErrorState(): FormErrorState {
  const fieldErrors = new Map<string, string>();

  return {
    setFieldError(field: string, message: string): void {
      if (field && message) {
        fieldErrors.set(field, message);
      }
    },

    getFieldError(field: string): string | undefined {
      return fieldErrors.get(field);
    },

    clearFieldError(field: string): void {
      fieldErrors.delete(field);
    },

    clearAll(): void {
      fieldErrors.clear();
    },

    hasFieldError(field: string): boolean {
      return fieldErrors.has(field);
    },

    getAllErrors(): Record<string, string> {
      return Object.fromEntries(fieldErrors);
    },

    hasErrors(): boolean {
      return fieldErrors.size > 0;
    },
  };
}
