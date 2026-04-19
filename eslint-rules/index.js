/**
 * Custom ESLint rules for CoRATES
 *
 * These rules enforce project-specific patterns and best practices.
 */

import coratesErrorHelpers from './corates-error-helpers.js';

export default {
  rules: {
    'corates-error-helpers': coratesErrorHelpers,
  },
};
