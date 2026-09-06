/**
 * Custom ESLint rules for CoRATES
 *
 * These rules enforce project-specific patterns and best practices.
 */

import coratesErrorHelpers from './corates-error-helpers.js';
import chainHonoCalls from './chain-hono-calls.js';
import { enforceDeleteWithWhere, enforceUpdateWithWhere } from './drizzle-where.js';

export default {
  rules: {
    'corates-error-helpers': coratesErrorHelpers,
    'chain-hono-calls': chainHonoCalls,
    'enforce-delete-with-where': enforceDeleteWithWhere,
    'enforce-update-with-where': enforceUpdateWithWhere,
  },
};
