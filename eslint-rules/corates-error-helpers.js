/**
 * Custom ESLint rule: corates-error-helpers
 *
 * Enforces using @corates/shared error helpers instead of raw Error objects.
 * This ensures consistent error handling with proper error codes and types.
 *
 * Allowed:
 * - throw createDomainError(...)
 * - throw createTransportError(...)
 * - throw createValidationError(...)
 * - throw existingErrorVariable (re-throwing)
 *
 * Disallowed:
 * - throw new Error('message')
 * - throw Error('message')
 */

// Allowed error helper function names from @corates/shared
const ALLOWED_ERROR_HELPERS = [
  'createDomainError',
  'createTransportError',
  'createValidationError',
  'createMultiFieldValidationError',
  'createUnknownError',
];

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce using @corates/shared error helpers instead of raw Error objects',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          allowInTests: {
            type: 'boolean',
            default: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      useErrorHelper:
        "Use error helpers from '@corates/shared' instead of 'new Error()'. Import and use createDomainError(), createTransportError(), or createValidationError().",
      useErrorHelperRethrow:
        "If re-throwing an error, throw the error object directly without wrapping in 'new Error()'.",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const allowInTests = options.allowInTests !== false;

    // Check if file is a test file
    const filename = context.filename || context.getFilename();
    const isTestFile =
      filename.includes('__tests__') ||
      filename.includes('.test.') ||
      filename.includes('.spec.') ||
      filename.includes('/test/');

    // Skip test files if allowed
    if (allowInTests && isTestFile) {
      return {};
    }

    return {
      ThrowStatement(node) {
        const argument = node.argument;

        if (!argument) return;

        // Case 1: throw new Error(...) or throw Error(...)
        if (argument.type === 'NewExpression' || argument.type === 'CallExpression') {
          const callee = argument.callee;

          // Check if it's Error, TypeError, RangeError, etc.
          if (callee.type === 'Identifier') {
            const errorConstructors = [
              'Error',
              'TypeError',
              'RangeError',
              'ReferenceError',
              'SyntaxError',
              'URIError',
            ];

            if (errorConstructors.includes(callee.name)) {
              // Check if we're wrapping another error (common pattern: throw new Error(error.message))
              const args = argument.arguments;
              const isWrappingError =
                args.length > 0 &&
                args[0].type === 'MemberExpression' &&
                args[0].property.name === 'message';

              context.report({
                node: argument,
                messageId: isWrappingError ? 'useErrorHelperRethrow' : 'useErrorHelper',
              });
            }

            // Allow calls to error helper functions
            if (ALLOWED_ERROR_HELPERS.includes(callee.name)) {
              return;
            }
          }
        }

        // Case 2: Allow re-throwing variables (throw error, throw e, etc.)
        // These are identifiers, not new Error() calls
        if (argument.type === 'Identifier') {
          return;
        }

        // Case 3: Allow throwing objects directly (rare but valid)
        if (argument.type === 'ObjectExpression') {
          return;
        }

        // Case 4: Allow throwing call expressions that are error helpers
        if (argument.type === 'CallExpression') {
          const callee = argument.callee;
          if (callee.type === 'Identifier' && ALLOWED_ERROR_HELPERS.includes(callee.name)) {
            return;
          }
        }
      },
    };
  },
};
