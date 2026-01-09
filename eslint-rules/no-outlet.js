/**
 * Custom ESLint rule: no-outlet
 *
 * Prevents usage of Outlet from @solidjs/router.
 * Use props.children instead for nested routes to maintain consistent patterns.
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow Outlet from @solidjs/router, use props.children instead',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noOutlet:
        'Do not use Outlet from @solidjs/router. Use props.children instead for nested routes.',
    },
    schema: [],
  },
  create(context) {
    return {
      ImportSpecifier(node) {
        if (
          node.imported.name === 'Outlet' &&
          node.parent.type === 'ImportDeclaration' &&
          node.parent.source.value === '@solidjs/router'
        ) {
          context.report({
            node,
            messageId: 'noOutlet',
          });
        }
      },
    };
  },
};
