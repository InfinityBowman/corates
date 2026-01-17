/**
 * Form-level error handling utilities
 * Handles validation errors with field-level details and multi-field errors
 */

// Form error handling utilities
// Uses error system from @corates/shared

/**
 * Handle form errors - extracts field-level errors from validation errors
 * @param {DomainError|TransportError} error - Error from API or network
 * @param {Function} setFieldError - Function to set field-specific error: (field: string, message: string) => void
 * @param {Function} setGlobalError - Function to set global form error: (message: string) => void
 * @returns {boolean} True if error was handled as a form error, false otherwise
 */
export function handleFormError(error, setFieldError, setGlobalError) {
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

/**
 * Create a field error state manager for SolidJS forms
 * Returns a store-like object with field errors and helper functions
 * @returns {Object} Form error state manager
 */
export function createFormErrorState() {
  const fieldErrors = new Map();

  return {
    /**
     * Set error for a specific field
     * @param {string} field - Field name
     * @param {string} message - Error message
     */
    setFieldError(field, message) {
      if (field && message) {
        fieldErrors.set(field, message);
      }
    },

    /**
     * Get error for a specific field
     * @param {string} field - Field name
     * @returns {string|undefined} Error message or undefined
     */
    getFieldError(field) {
      return fieldErrors.get(field);
    },

    /**
     * Clear error for a specific field
     * @param {string} field - Field name
     */
    clearFieldError(field) {
      fieldErrors.delete(field);
    },

    /**
     * Clear all field errors
     */
    clearAll() {
      fieldErrors.clear();
    },

    /**
     * Check if a field has an error
     * @param {string} field - Field name
     * @returns {boolean}
     */
    hasFieldError(field) {
      return fieldErrors.has(field);
    },

    /**
     * Get all field errors as an object
     * @returns {Record<string, string>} Object mapping field names to error messages
     */
    getAllErrors() {
      return Object.fromEntries(fieldErrors);
    },

    /**
     * Check if there are any errors
     * @returns {boolean}
     */
    hasErrors() {
      return fieldErrors.size > 0;
    },
  };
}

/**
 * Helper to create SolidJS signals for form errors
 * Returns reactive signals for field errors and global error
 * Note: This function must be called inside a SolidJS component context
 * @param {Function} createSignal - SolidJS createSignal function (imported from 'solid-js')
 * @param {Function} createStore - SolidJS createStore function (imported from 'solid-js/store')
 * @returns {Object} Object with fieldErrors store, globalError signal, and helper functions
 */
export function createFormErrorSignals(createSignal, createStore) {
  // Use store for field errors for fine-grained reactivity per field
  const [fieldErrors, setFieldErrors] = createStore({});
  const [globalError, _setGlobalErrorSignal] = createSignal('');

  return {
    /**
     * Reactive store for field errors: { [fieldName]: errorMessage }
     * Access individual fields directly: fieldErrors.email, fieldErrors.password
     */
    fieldErrors,

    /**
     * Reactive signal for global form error
     */
    globalError,

    /**
     * Get error for a specific field (for compatibility with signal-style access)
     * @param {string} field - Field name
     * @returns {string|undefined} Error message
     */
    getFieldError(field) {
      return fieldErrors[field];
    },

    /**
     * Set error for a specific field
     * @param {string} field - Field name
     * @param {string} message - Error message
     */
    setFieldError(field, message) {
      if (field && message) {
        setFieldErrors(field, message);
      }
    },

    /**
     * Clear error for a specific field
     * @param {string} field - Field name
     */
    clearFieldError(field) {
      setFieldErrors(field, undefined);
    },

    /**
     * Clear all field errors
     */
    clearFieldErrors() {
      // Get all current keys and set them to undefined
      Object.keys(fieldErrors).forEach(key => {
        setFieldErrors(key, undefined);
      });
    },

    /**
     * Set global form error
     * @param {string} message - Error message
     */
    setGlobalError(message) {
      _setGlobalErrorSignal(message || '');
    },

    /**
     * Clear global error
     */
    clearGlobalError() {
      _setGlobalErrorSignal('');
    },

    /**
     * Clear all errors (both field and global)
     */
    clearAll() {
      Object.keys(fieldErrors).forEach(key => {
        setFieldErrors(key, undefined);
      });
      _setGlobalErrorSignal('');
    },

    /**
     * Handle an error using handleFormError
     * @param {DomainError|TransportError} error - Error to handle
     */
    handleError(error) {
      handleFormError(
        error,
        (field, message) => this.setFieldError(field, message),
        message => this.setGlobalError(message),
      );
    },
  };
}
