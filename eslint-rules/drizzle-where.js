/**
 * Ports of eslint-plugin-drizzle's enforce-delete-with-where and
 * enforce-update-with-where. The upstream plugin requires @typescript-eslint
 * internals that left the tree with ESLint, so the two rules live here.
 */

const schema = [
  {
    type: 'object',
    properties: { drizzleObjectName: { type: ['string', 'array'] } },
    additionalProperties: false,
  },
];

function isDrizzleObj(node, context) {
  const wanted = (context.options[0] || {}).drizzleObjectName || [];
  const target =
    node.object.type === 'Identifier' ? node.object
    : node.object.type === 'MemberExpression' ? node.object.property
    : null;
  if (!target || target.type !== 'Identifier') return false;
  if (typeof wanted === 'string') return target.name === wanted;
  return wanted.length === 0 || wanted.includes(target.name);
}

// Member expressions are visited outermost first, so on `db.delete(t).where(x)`
// the `.where` member is seen right before `.delete`. That ordering is how the
// upstream rules detect a chained where, and it is preserved here.
function createChecker(check) {
  return context => {
    let lastMemberName = '';
    return {
      MemberExpression(node) {
        if (node.property.type !== 'Identifier') return;
        if (lastMemberName !== 'where') check(node, context);
        lastMemberName = node.property.name;
      },
    };
  };
}

export const enforceDeleteWithWhere = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require .where() on delete so a whole table is never cleared by accident',
    },
    schema,
    messages: {
      enforceDeleteWithWhere:
        'Without `.where(...)` you will delete all the rows in a table. Use `{{ name }}.delete(...).where(...)` instead, or disable this rule here if that is intended.',
    },
  },
  create: createChecker((node, context) => {
    if (node.property.name === 'delete' && isDrizzleObj(node, context)) {
      context.report({
        node,
        messageId: 'enforceDeleteWithWhere',
        data: { name: node.object.name },
      });
    }
  }),
};

export const enforceUpdateWithWhere = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require .where() on update so a whole table is never rewritten by accident',
    },
    schema,
    messages: {
      enforceUpdateWithWhere:
        'Without `.where(...)` you will update all the rows in a table. Use `{{ name }}.update(...).set(...).where(...)` instead, or disable this rule here if that is intended.',
    },
  },
  create: createChecker((node, context) => {
    const callee = node.object.type === 'CallExpression' ? node.object.callee : null;
    if (
      node.property.name === 'set' &&
      callee?.type === 'MemberExpression' &&
      callee.property.type === 'Identifier' &&
      callee.property.name === 'update' &&
      isDrizzleObj(callee, context)
    ) {
      context.report({
        node,
        messageId: 'enforceUpdateWithWhere',
        data: { name: callee.object.name },
      });
    }
  }),
};
