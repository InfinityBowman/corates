/**
 * Custom lint rule: chain-hono-calls
 *
 * Bare `.openapi()` and `.route()` statements in workers route files discard
 * the returned app, so their types never reach AppType for Hono RPC.
 * See docs/audits/hono-rpc-migration.md
 */

const CHAINED_METHODS = ['openapi', 'route'];

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require .openapi() and .route() results to be assigned so types flow into AppType',
    },
    schema: [],
    messages: {
      chainCall:
        'Chain .{{ method }}() calls (assign return value) so types flow into AppType. See docs/audits/hono-rpc-migration.md',
    },
  },

  create(context) {
    return {
      'ExpressionStatement > CallExpression'(node) {
        const property = node.callee.type === 'MemberExpression' ? node.callee.property : null;
        if (
          !property ||
          property.type !== 'Identifier' ||
          !CHAINED_METHODS.includes(property.name)
        ) {
          return;
        }
        context.report({ node, messageId: 'chainCall', data: { method: property.name } });
      },
    };
  },
};
