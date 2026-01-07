/**
 * Custom ESLint rules for CoRATES
 *
 * These rules enforce project-specific patterns and best practices.
 */

import coratesUiImports from './corates-ui-imports.js';

export default {
  rules: {
    'corates-ui-imports': coratesUiImports,
  },
};
