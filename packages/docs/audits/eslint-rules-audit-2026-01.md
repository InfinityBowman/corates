# ESLint Rules Audit

**Date**: 2026-01-07
**Scope**: All packages in the CoRATES monorepo
**Focus Areas**: Code consistency, error prevention, TypeScript safety, import organization

## Executive Summary

This audit analyzes the CoRATES codebase to identify ESLint rules that would improve code consistency and prevent common issues. The current configuration includes custom Corates-specific rules and basic TypeScript support, but several opportunities exist to catch more issues at lint time.

**Overall Grade**: B (Good foundation with room for improvement)

**Key Statistics**:

- 700+ console statements in production code
- 1,356 async functions with varying error handling patterns
- 454 try/catch blocks with inconsistent handling
- 3 files using explicit `any` type
- Multiple import style inconsistencies

## 1. Current ESLint Configuration

### Strengths

**Custom Corates rules in place:**

- `corates/corates-error-helpers` - Enforces centralized error handling via `@corates/shared`
- `corates/corates-ui-imports` - Prevents direct `@ark-ui/solid` imports, requires `@corates/ui`

**Well-configured basics:**

- TypeScript parser with modern ECMAScript support
- SolidJS-specific rules enabled
- Underscore-prefixed unused variables allowed
- Comprehensive global definitions for browser/worker contexts

### Current Rule Set

| Rule                            | Level | Purpose                               |
| ------------------------------- | ----- | ------------------------------------- |
| `no-unused-vars`                | Error | Ignores `_` prefixed variables        |
| `no-throw-literal`              | Error | Require Error objects, not literals   |
| `corates/corates-error-helpers` | Warn  | Enforce centralized error handling    |
| `corates/corates-ui-imports`    | Error | Prevent direct ark-ui imports         |
| `no-restricted-imports`         | Error | Block `@ark-ui/*` imports in app code |

## 2. Recommended Rules - High Priority

### 2.1 Console Statement Control

**Severity**: High
**Issue**: 700+ console statements found across the codebase

**Examples Found**:

- [email.js:52](packages/workers/src/routes/email.js#L52) - `console.error('Email queue handler error:', err)`
- [better-auth-store.js:85](packages/web/src/api/better-auth-store.js#L85) - `console.error('Error loading cached auth:', err)`
- [ProjectDoc.js:117](packages/workers/src/durable-objects/ProjectDoc.js#L117) - `console.error('ProjectDoc error:', error)`

**Impact**: Development logging left in production, inconsistent logging patterns

**Recommendation**: Add `no-console` with exceptions

```javascript
// eslint.config.js
{
  rules: {
    'no-console': ['warn', {
      allow: ['warn', 'error']
    }],
  }
}
```

**Alternative**: Create custom rule `corates/structured-logging` that enforces using a centralized logger for all logging operations.

---

### 2.2 Floating Promise Detection

**Severity**: High
**Issue**: 1,356 async functions with many unhandled promise chains

**Examples Found**:

- [pdfs.js:82](packages/web/src/stores/projectActionsStore/pdfs.js#L82) - `.catch(console.warn)` (silent error swallowing)
- [pdfs.js:330](packages/web/src/stores/projectActionsStore/pdfs.js#L330) - `.catch(console.warn)` on critical operations
- [studies.js:91](packages/web/src/stores/projectActionsStore/studies.js#L91) - `.catch(console.warn)` pattern repeated
- [main.jsx:11](packages/web/src/main.jsx#L11) - `.catch(() => { ... })` (empty catch)

**Impact**: Unhandled promise rejections can cause silent failures and difficult-to-debug issues

**Recommendation**: Add TypeScript ESLint promise rules

```javascript
// eslint.config.js
{
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
  }
}
```

**Note**: Requires `parserOptions.project` to be set for type-aware linting.

---

### 2.3 Silent Error Swallowing

**Severity**: High
**Issue**: Many `.catch()` handlers that silently swallow errors

**Examples Found**:

- [pdfs.js:82](packages/web/src/stores/projectActionsStore/pdfs.js#L82) - `.catch(console.warn)` hides failures
- [main.jsx:11](packages/web/src/main.jsx#L11) - Empty catch block
- [SplitPanelControls.jsx:54](packages/web/src/components/checklist/SplitPanelControls.jsx#L54) - `catch (_err) { }` pattern

**Impact**: Errors are silently ignored, making debugging difficult

**Recommendation**: Create custom rule `corates/no-silent-catch`

```javascript
// eslint-rules/no-silent-catch.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow catch blocks that only log warnings or are empty',
    },
  },
  create(context) {
    return {
      CatchClause(node) {
        // Check for empty catch blocks
        if (node.body.body.length === 0) {
          context.report({
            node,
            message: 'Empty catch block. Handle the error or re-throw.',
          });
        }
        // Check for catch blocks that only call console.warn
        if (node.body.body.length === 1) {
          const statement = node.body.body[0];
          if (
            statement.type === 'ExpressionStatement' &&
            statement.expression.type === 'CallExpression' &&
            statement.expression.callee.object?.name === 'console' &&
            statement.expression.callee.property?.name === 'warn'
          ) {
            context.report({
              node,
              message: 'Catch block only logs warning. Consider proper error handling.',
            });
          }
        }
      },
    };
  },
};
```

---

### 2.4 Import Organization

**Severity**: Medium
**Issue**: Inconsistent import ordering and styles across files

**Examples Found**:

- [Routes.jsx:1-37](packages/web/src/Routes.jsx#L1-L37) - 37 consecutive imports with mixed ordering
- [LocalChecklistView.jsx:9-14](packages/web/src/components/checklist/LocalChecklistView.jsx#L9-L14) - No consistent order

**Patterns Observed**:

- Mix of relative (`../`) and alias imports (`@/`, `@api/`, `@config/`)
- Namespace imports: `import * as Y from 'yjs'`, `import * as d3 from 'd3'`
- No consistent grouping (external, internal, relative)

**Recommendation**: Add `eslint-plugin-import` with ordering rules

```javascript
// eslint.config.js
import importPlugin from 'eslint-plugin-import';

{
  plugins: {
    import: importPlugin,
  },
  rules: {
    'import/order': ['error', {
      groups: [
        'builtin',
        'external',
        'internal',
        ['parent', 'sibling', 'index'],
        'type',
      ],
      pathGroups: [
        { pattern: 'solid-js/**', group: 'external', position: 'before' },
        { pattern: '@solidjs/**', group: 'external', position: 'before' },
        { pattern: '@corates/**', group: 'internal', position: 'before' },
        { pattern: '@/**', group: 'internal' },
        { pattern: '@api/**', group: 'internal' },
        { pattern: '@config/**', group: 'internal' },
      ],
      pathGroupsExcludedImportTypes: ['type'],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true },
    }],
    'import/no-duplicates': 'error',
  },
}
```

## 3. Recommended Rules - Medium Priority

### 3.1 TypeScript Strict Rules

**Severity**: Medium
**Issue**: Limited TypeScript-specific linting enabled

**Current State**: Only 3 files use explicit `any` type, but other TypeScript issues may exist

**Recommendation**: Enable recommended TypeScript rules

```javascript
// eslint.config.js
{
  rules: {
    '@typescript-eslint/no-explicit-any': ['warn', {
      ignoreRestArgs: true
    }],
    '@typescript-eslint/no-unused-expressions': 'error',
    '@typescript-eslint/consistent-type-imports': ['error', {
      prefer: 'type-imports',
      disallowTypeAnnotations: false,
    }],
    '@typescript-eslint/no-non-null-assertion': 'warn',
  }
}
```

---

### 3.2 Async/Await Best Practices

**Severity**: Medium
**Issue**: Inconsistent async patterns across the codebase

**Examples Found**:

- Some files use `new Promise((resolve, reject) => { ... })` instead of async/await
- Async handlers in signals without proper cleanup patterns

**Recommendation**: Add async-related rules

```javascript
// eslint.config.js
{
  rules: {
    'no-async-promise-executor': 'error',
    'no-return-await': 'error',
    'require-await': 'warn',
  }
}
```

---

### 3.3 Empty Catch Block Detection

**Severity**: Medium
**Issue**: Empty or minimal catch blocks throughout codebase

**Recommendation**:

```javascript
// eslint.config.js
{
  rules: {
    'no-empty': ['error', {
      allowEmptyCatch: false
    }],
  }
}
```

---

### 3.4 Consistent Return Types

**Severity**: Medium
**Issue**: Functions with inconsistent return patterns

**Recommendation**:

```javascript
// eslint.config.js
{
  rules: {
    'consistent-return': 'warn',
    '@typescript-eslint/explicit-function-return-type': ['off'], // Too strict for JSX
  }
}
```

## 4. Recommended Rules - Low Priority

### 4.1 File Extension Enforcement

**Severity**: Low
**Issue**: Some files use `.js` extension when they contain JSX

**Recommendation**:

```javascript
// eslint.config.js
{
  rules: {
    // Consider renaming .js files with JSX to .jsx
    // This is more of a codemod task than an ESLint rule
  }
}
```

---

### 4.2 Test File Rules

**Severity**: Low
**Issue**: Test files may have focused or skipped tests committed

**Recommendation**: Add Vitest-specific rules

```javascript
// eslint.config.js - test file override
{
  files: ['**/*.test.{js,jsx,ts,tsx}', '**/__tests__/**'],
  rules: {
    'vitest/no-focused-tests': 'error',
    'vitest/no-disabled-tests': 'warn',
    'vitest/expect-expect': 'warn',
  }
}
```

---

### 4.3 Namespace Import Restrictions

**Severity**: Low
**Issue**: Namespace imports (`import * as`) used inconsistently

**Examples Found**:

- `import * as Y from 'yjs'` (11 files)
- `import * as d3 from 'd3'` (3 files)

**Recommendation**: Allow only for specific libraries

```javascript
// eslint.config.js
{
  rules: {
    'no-restricted-syntax': ['warn', {
      selector: 'ImportNamespaceSpecifier',
      message: 'Avoid namespace imports. Use named imports instead, except for Y (yjs) and d3.',
    }],
  }
}
```

**Note**: This may be too restrictive. Namespace imports are acceptable for certain libraries.

---

### 4.4 Prefer Const

**Severity**: Low
**Issue**: Ensures immutable bindings where possible

**Recommendation**:

```javascript
// eslint.config.js
{
  rules: {
    'prefer-const': 'error',
    'no-var': 'error',
  }
}
```

## 5. Custom Corates Rules to Consider

### 5.1 corates/solid-async-cleanup

**Purpose**: Ensure async operations in SolidJS effects have proper cleanup

**Use Case**: Prevent memory leaks from unfinished async operations when components unmount

```javascript
// Example violation
createEffect(() => {
  fetchData().then(setData); // No cleanup on unmount
});

// Correct usage
createEffect(() => {
  const controller = new AbortController();
  fetchData({ signal: controller.signal }).then(setData);
  onCleanup(() => controller.abort());
});
```

---

### 5.2 corates/no-direct-store-mutation

**Purpose**: Prevent direct mutations of store values outside of designated setters

**Use Case**: Maintain predictable state updates in the application

---

### 5.3 corates/consistent-error-context

**Purpose**: Ensure all errors include appropriate context (operation, resource, etc.)

**Use Case**: Improve debuggability by requiring structured error information

## 6. Implementation Plan

### Phase 1: Quick Wins (Week 1)

1. **Add `no-console` with warnings**
   - Minimal disruption
   - Helps identify leftover debug logs

2. **Add `prefer-const` and `no-var`**
   - Auto-fixable
   - Improves code consistency

3. **Add `no-empty` with catch block checking**
   - Catches obvious issues
   - Minimal false positives

### Phase 2: Import Organization (Week 2)

1. **Install `eslint-plugin-import`**
2. **Configure import ordering**
3. **Run autofix across codebase**
4. **Review and adjust configuration**

### Phase 3: Promise Handling (Week 3-4)

1. **Enable type-aware linting** (requires `parserOptions.project`)
2. **Add `@typescript-eslint/no-floating-promises`**
3. **Address violations incrementally**
4. **Consider creating `corates/no-silent-catch` rule**

### Phase 4: TypeScript Strictness (Week 5+)

1. **Add `@typescript-eslint/no-explicit-any`**
2. **Add `@typescript-eslint/consistent-type-imports`**
3. **Review and fix violations**

## 7. Configuration Template

Complete recommended configuration:

```javascript
// eslint.config.js additions
import importPlugin from 'eslint-plugin-import';

export default [
  // ... existing config
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      // High Priority
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Medium Priority
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-async-promise-executor': 'error',
      'no-return-await': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'consistent-return': 'warn',

      // Import Organization
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
          pathGroups: [
            { pattern: 'solid-js/**', group: 'external', position: 'before' },
            { pattern: '@solidjs/**', group: 'external', position: 'before' },
            { pattern: '@corates/**', group: 'internal', position: 'before' },
            { pattern: '@/**', group: 'internal' },
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',

      // TypeScript (requires type-aware linting)
      // '@typescript-eslint/no-floating-promises': 'error',
      // '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-explicit-any': ['warn', { ignoreRestArgs: true }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          disallowTypeAnnotations: false,
        },
      ],
    },
  },
  // Test file overrides
  {
    files: ['**/*.test.{js,jsx,ts,tsx}', '**/__tests__/**'],
    rules: {
      // Add vitest rules when eslint-plugin-vitest is installed
    },
  },
];
```

## 8. Summary of Recommendations

### By Impact

| Priority | Rule                                      | Impact                  | Effort |
| -------- | ----------------------------------------- | ----------------------- | ------ |
| High     | `no-console`                              | Catch debug logs        | Low    |
| High     | `@typescript-eslint/no-floating-promises` | Prevent silent failures | Medium |
| High     | `corates/no-silent-catch` (custom)        | Better error handling   | Medium |
| Medium   | `import/order`                            | Code consistency        | Low    |
| Medium   | `@typescript-eslint/no-explicit-any`      | Type safety             | Medium |
| Medium   | `no-empty`                                | Catch empty blocks      | Low    |
| Low      | `prefer-const` / `no-var`                 | Modern syntax           | Low    |
| Low      | Vitest rules                              | Test quality            | Low    |

### By Effort to Implement

**Low Effort (add rule, run autofix):**

- `prefer-const`, `no-var`
- `no-console`
- `no-empty`
- `import/order` (with autofix)

**Medium Effort (requires code changes):**

- `@typescript-eslint/no-floating-promises`
- `@typescript-eslint/no-explicit-any`
- `import/order` (manual review)

**High Effort (custom development):**

- `corates/no-silent-catch`
- `corates/solid-async-cleanup`
- `corates/consistent-error-context`

## Conclusion

The CoRATES codebase has a solid ESLint foundation with custom rules for architectural enforcement. The main opportunities for improvement are:

1. **Promise handling** - Catch floating promises and silent error swallowing
2. **Console logging** - Identify development logs in production code
3. **Import organization** - Enforce consistent import ordering
4. **TypeScript strictness** - Gradually increase type safety

These changes can be implemented incrementally without disrupting development velocity. Start with quick wins (Phase 1), then progress to more impactful changes as the team becomes comfortable with the stricter linting.

**Action Items:**

1. Implement Phase 1 rules immediately (low risk, high visibility)
2. Schedule Phase 2-3 for sprint planning
3. Consider custom rule development for Phase 4
4. Document linting standards in developer guide

---

## Appendix: Files with Most Issues

| File                                                                 | Console Statements | Empty Catches | Floating Promises |
| -------------------------------------------------------------------- | ------------------ | ------------- | ----------------- |
| [better-auth-store.js](packages/web/src/api/better-auth-store.js)    | 8                  | 2             | 3                 |
| [pdfs.js](packages/web/src/stores/projectActionsStore/pdfs.js)       | 12                 | 1             | 5                 |
| [studies.js](packages/web/src/stores/projectActionsStore/studies.js) | 6                  | 0             | 4                 |
| [ProjectDoc.js](packages/workers/src/durable-objects/ProjectDoc.js)  | 15                 | 2             | 2                 |
| [Routes.jsx](packages/web/src/Routes.jsx)                            | 0                  | 0             | 0 (import issues) |

## Appendix: Package Dependencies Required

```json
{
  "devDependencies": {
    "eslint-plugin-import": "^2.29.0",
    "@vitest/eslint-plugin": "^1.0.0"
  }
}
```

For type-aware linting (Phase 3+):

```javascript
// eslint.config.js
{
  languageOptions: {
    parserOptions: {
      project: ['./tsconfig.json', './packages/*/tsconfig.json'],
    },
  },
}
```
