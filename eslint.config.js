import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import drizzle from 'eslint-plugin-drizzle';
import coratesRules from './eslint-rules/index.js';

export default [
  js.configs.recommended,
  // eslintPluginUnicorn.configs.recommended,
  // {
  //   rules: {
  //     'unicorn/better-regex': 'warn',
  //   },
  // },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      corates: coratesRules,
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },

      globals: {
        // Browser globals
        SVGGElement: 'readonly',
        SVGElement: 'readonly',
        SVGSVGElement: 'readonly',
        DOMParser: 'readonly',
        DOMException: 'readonly',
        requestIdleCallback: 'readonly',
        cancelIdleCallback: 'readonly',
        performance: 'readonly',
        ReadableStream: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        EventTarget: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLLabelElement: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',

        fetch: 'readonly',
        URL: 'readonly',
        caches: 'readonly',
        queueMicrotask: 'readonly',
        URLSearchParams: 'readonly',
        BroadcastChannel: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        BodyInit: 'readonly',
        RequestInit: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        Element: 'readonly',
        HTMLElement: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        getComputedStyle: 'readonly',
        matchMedia: 'readonly',
        crypto: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        WebSocket: 'readonly',
        WebSocketPair: 'readonly',
        indexedDB: 'readonly',
        Image: 'readonly',
        XMLSerializer: 'readonly',
        // Node.js globals (for config files, tests, etc.)
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
      },
    },
    rules: {
      // Use TypeScript-aware unused vars (understands interfaces, type params)
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Prevent throwing literals - must throw Error objects
      'no-throw-literal': 'error',

      // Ensure correct usage of @corates/ui prestyled vs primitive components
      // Prestyled (Dialog) should not be used with .Root, .Content patterns
      // Use DialogPrimitive for primitive patterns
      'corates/corates-ui-imports': 'error',

      // Prevent Outlet usage - use props.children for nested routes
      'corates/no-outlet': 'error',
    },
  },
  {
    // Test file configuration
    files: [
      '**/__tests__/**/*.{js,jsx,ts,tsx}',
      '**/*.test.{js,jsx,ts,tsx}',
      '**/*.spec.{js,jsx,ts,tsx}',
    ],
    languageOptions: {
      globals: {
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        ResizeObserverCallback: 'readonly',
        IntersectionObserverCallback: 'readonly',
        Document: 'readonly',
        Crypto: 'readonly',
        FrameRequestCallback: 'readonly',
        CSSStyleDeclaration: 'readonly',
        DOMRect: 'readonly',
        PointerEventInit: 'readonly',
        PointerEvent: 'readonly',
        DragEvent: 'readonly',
      },
    },
    rules: {},
  },
  {
    // Service worker configuration
    files: ['**/sw.js', '**/service-worker.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        clients: 'readonly',
        skipWaiting: 'readonly',
        registration: 'readonly',
        ServiceWorkerGlobalScope: 'readonly',
      },
    },
  },
  {
    // Backend workers - enforce structured error handling
    files: ['packages/workers/src/**/*.{js,ts}'],
    plugins: {
      drizzle,
    },
    languageOptions: {
      globals: {
        // Cloudflare Workers globals
        MessageEvent: 'readonly',
        Message: 'readonly',
        MessageBatch: 'readonly',
        Cloudflare: 'readonly',
        D1Database: 'readonly',
        DurableObject: 'readonly',
        DurableObjectState: 'readonly',
        DurableObjectNamespace: 'readonly',
        DurableObjectStub: 'readonly',
        R2Bucket: 'readonly',
        KVNamespace: 'readonly',
        ExecutionContext: 'readonly',
        ScheduledController: 'readonly',
        Env: 'readonly',
        RequestInit: 'readonly',
        R2PutOptions: 'readonly',
      },
    },
    rules: {
      // Use createDomainError(), createTransportError(), or createValidationError()
      'corates/corates-error-helpers': 'warn',
      // Prevent accidental table-wide deletes/updates without a where clause
      'drizzle/enforce-delete-with-where': ['error', { drizzleObjectName: 'db' }],
      'drizzle/enforce-update-with-where': ['error', { drizzleObjectName: 'db' }],
    },
  },
  {
    // Workers route files - enforce chained .openapi() and .route() calls
    // so types flow into AppType for Hono RPC. See docs/audits/hono-rpc-migration.md
    files: ['packages/workers/src/routes/**/*.{js,ts}'],
    ignores: ['**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExpressionStatement > CallExpression[callee.property.name="openapi"]',
          message:
            'Chain .openapi() calls (assign return value) so types flow into AppType. See docs/audits/hono-rpc-migration.md',
        },
        {
          selector: 'ExpressionStatement > CallExpression[callee.property.name="route"]',
          message:
            'Chain .route() calls (assign return value) so types flow into AppType. See docs/audits/hono-rpc-migration.md',
        },
      ],
    },
  },
  {
    // Web package - React with hooks linting
    files: ['packages/web/**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        React: 'readonly',
        HTMLSpanElement: 'readonly',
        HTMLFormElement: 'readonly',
        HTMLAnchorElement: 'readonly',
        Node: 'readonly',
        NodeJS: 'readonly',
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'corates/corates-ui-imports': 'off',
      'corates/no-outlet': 'off',
    },
  },
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.wrangler/**',
      '**/build/**',
      '**/.vinxi/**',
      '**/.output/**',
      '**/coverage/**',
      '**/mocks/**',
      'packages/learn/.astro/**',
      '**/.vitepress/cache/**',
      '**/.vitepress/dist/**',
      'reference/**',
      '**/.localflare/**',
      '.claude/skills/**/examples/**',
      'packages/ai/**',
    ],
  },
];
