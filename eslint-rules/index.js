/**
 * Custom ESLint rules for CoRATES
 *
 * These rules enforce project-specific patterns and best practices.
 */

import coratesUiImports from './corates-ui-imports.js';
import coratesErrorHelpers from './corates-error-helpers.js';
import noOutlet from './no-outlet.js';

export default {
  rules: {
    'corates-ui-imports': coratesUiImports,
    'corates-error-helpers': coratesErrorHelpers,
    'no-outlet': noOutlet,
  },
};
