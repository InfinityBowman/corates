import js from '@eslint/js';
import solid from 'eslint-plugin-solid/configs/recommended';
import * as tsParser from '@typescript-eslint/parser';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import sonarjs from 'eslint-plugin-sonarjs';

export default [
  js.configs.recommended,
  solid,
  eslintPluginUnicorn.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      sonarjs,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },

      globals: {
        // Browser globals
        structuredClone: 'readonly',
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
      // Ignore unused variables that start with underscore
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // 'sonarjs/cognitive-complexity': 'error',

      // Unicorn rules - customized for this project
      // The recommended config is already applied above, these are overrides/customizations

      // File naming - prefer camelCase, but allow kebab-case and PascalCase
      // Set to warn so you can gradually fix file names
      'unicorn/filename-case': [
        'warn',
        {
          case: 'camelCase',
          ignore: [
            // Allow PascalCase for React/SolidJS components
            /^[A-Z][a-zA-Z0-9]*\.(jsx|tsx)$/,
            // Allow kebab-case for config files
            /^(eslint|prettier|vite|wrangler|jsconfig|tsconfig)\.(js|ts|json)$/,
            // Allow UPPER_CASE for constants/config
            /^[A-Z_]+\.(js|ts)$/,
            // Allow kebab-case files (common in many projects)
            /^[a-z]+(-[a-z]+)*\.(js|jsx|ts|tsx)$/,
          ],
        },
      ],

      // Prevent abbreviations - warn instead of error for flexibility
      'unicorn/prevent-abbreviations': [
        'warn',
        {
          replacements: {
            // Common abbreviations to allow
            args: false,
            db: false,
            err: false,
            req: false,
            res: false,
            temp: false,
            tmp: false,
            doc: false,
            env: false,
            i: false,
            obj: false,
            ext: false,
            val: false,
            num: false,
            ctx: false,
            params: false,
            dir: false,
            el: false,
            acc: false,
            utils: false,
            def: false,
            // React/SolidJS common patterns
            prev: false,
            props: false,
            // Project-specific
            ops: false,
            ref: false,
            refs: false,
            // Common abbreviations in codebases
            lib: false,
            docs: false,
            msg: false,
            cb: false,
            idx: false,
            j: false,
            e: false,
          },
        },
      ],

      // Allow null for compatibility with some APIs and patterns
      'unicorn/no-null': 'off',

      // Prefer top-level await - warn since it requires ES2022
      'unicorn/prefer-top-level-await': 'warn',

      // Allow 'err', 'error', or 'e' as catch parameter name
      'unicorn/catch-error-name': ['error', { name: 'err', ignore: ['error', 'e', '_e'] }],

      // Disable prefer-global-this for browser code - window is more idiomatic
      'unicorn/prefer-global-this': 'off',

      // Disable prefer-add-event-listener - IndexedDB and other APIs use onerror/onsuccess handlers
      'unicorn/prefer-add-event-listener': 'off',

      // Disable or relax rules that are too strict or have too many violations
      // These can be gradually enabled as code is refactored

      // Switch case braces - many violations, but easy to fix
      // 'unicorn/switch-case-braces': 'warn', // Consider enabling as warn first

      // Consistent function scoping - can be noisy, especially in React/SolidJS components
      'unicorn/consistent-function-scoping': 'off',

      // Array forEach - many violations, but forEach is sometimes more readable
      'unicorn/no-array-for-each': 'warn',

      // String replaceAll - many violations, but replace() is fine for single replacements
      'unicorn/prefer-string-replace-all': 'warn',

      // Number properties - parseInt/parseFloat are widely understood
      'unicorn/prefer-number-properties': 'warn',

      // Numeric separators - nice to have but not critical
      'unicorn/numeric-separators-style': 'warn',

      // Structured clone - JSON.parse(JSON.stringify()) is fine for simple cases
      'unicorn/prefer-structured-clone': 'error',

      // Node protocol - disabled, standard imports are fine
      'unicorn/prefer-node-protocol': 'off',

      // Array sort - toSorted() is newer, sort() is fine for now
      'unicorn/no-array-sort': 'warn',

      // Nested ternary - disabled, nested ternaries are acceptable
      'unicorn/no-nested-ternary': 'off',

      // New array - disabled, new Array() is fine and used for arraybuffers
      'unicorn/no-new-array': 'off',

      // Explicit length check - `array.length > 0` vs `array.length`
      'unicorn/explicit-length-check': 'warn',

      // Additional rules to disable/warn for gradual adoption
      // Switch case braces - disabled, braces in case clauses are optional
      'unicorn/switch-case-braces': 'off',

      // Response static JSON - Cloudflare Workers pattern
      // 'unicorn/prefer-response-static-json': 'off',

      // Spread operator - can be adopted gradually
      'unicorn/prefer-spread': 'off',

      // Await expression member - can be fixed gradually
      'unicorn/no-await-expression-member': 'warn',

      // Array.at() - newer API, can be adopted gradually
      'unicorn/prefer-at': 'warn',

      // Negated condition - style preference
      'unicorn/no-negated-condition': 'warn',

      // Zero fractions - can be fixed gradually
      'unicorn/no-zero-fractions': 'warn',

      // Prefer ternary - style preference
      'unicorn/prefer-ternary': 'warn',

      // Useless undefined - can be fixed gradually
      'unicorn/no-useless-undefined': 'warn',

      // For loop - for...of is preferred but for loops are fine
      'unicorn/no-for-loop': 'warn',

      // Prefer switch - disabled, if statements are fine
      'unicorn/prefer-switch': 'off',

      // DOM node append - can be adopted gradually
      'unicorn/prefer-dom-node-append': 'warn',

      // Array indexOf - can be adopted gradually
      'unicorn/prefer-array-index-of': 'warn',

      // Additional rules for gradual adoption
      // Prefer single call - style preference
      'unicorn/prefer-single-call': 'off',

      // Prefer includes - can be adopted gradually
      'unicorn/prefer-includes': 'warn',

      // Prefer export from - can be adopted gradually
      'unicorn/prefer-export-from': 'warn',

      // Number literal case - style preference
      'unicorn/number-literal-case': 'off',

      // Lonely if - style preference
      'unicorn/no-lonely-if': 'warn',

      // Array callback reference - can be adopted gradually
      'unicorn/no-array-callback-reference': 'off',

      // DOM node remove - can be adopted gradually
      'unicorn/prefer-dom-node-remove': 'warn',

      // Prefer set has - can be adopted gradually
      'unicorn/prefer-set-has': 'warn',

      // Prefer query selector - getElementById is fine
      'unicorn/prefer-query-selector': 'warn',

      // Optional catch binding - can be adopted gradually
      'unicorn/prefer-optional-catch-binding': 'warn',

      // Useless fallback in spread - can be fixed gradually
      'unicorn/no-useless-fallback-in-spread': 'warn',

      // Array reduce - reduce is fine, can be adopted gradually
      'unicorn/no-array-reduce': 'warn',

      // New for builtins - can be adopted gradually
      'unicorn/new-for-builtins': 'warn',

      // String slice - substring is fine
      'unicorn/prefer-string-slice': 'warn',

      // String raw - can be adopted gradually
      'unicorn/prefer-string-raw': 'warn',

      // Blob reading methods - can be adopted gradually
      'unicorn/prefer-blob-reading-methods': 'warn',

      // Immediate mutation - can be fixed gradually
      'unicorn/no-immediate-mutation': 'warn',

      // Import style - can be adopted gradually
      'unicorn/import-style': 'warn',
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
      },
    },
    rules: {},
  },
  {
    // Durable objects configuration - allow PascalCase file names
    files: ['**/durable-objects/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'unicorn/filename-case': 'off',
    },
  },
  {
    // Scripts and config files - disable all unicorn rules
    files: [
      '**/scripts/**/*.{js,jsx,ts,tsx,mjs}',
      '**/vite.config.{js,ts,mjs}',
      '**/*.config.{js,ts,mjs}',
    ],
    rules: Object.fromEntries(
      Object.keys(eslintPluginUnicorn.rules).map(rule => [`unicorn/${rule}`, 'off']),
    ),
  },
  {
    // MCP package - more lenient rules for tooling code
    files: ['**/mcp/**/*.{js,jsx,ts,tsx,mjs}'],
    rules: {
      'unicorn/filename-case': 'off', // Allow camelCase for tool files
      'unicorn/prefer-node-protocol': 'off', // Standard imports are fine
      'unicorn/no-process-exit': 'off', // CLI tools need process.exit
      'unicorn/prevent-abbreviations': 'off', // More lenient for tooling
    },
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
    rules: {
      // 'self' is the standard in service workers, not 'globalThis'
      'unicorn/prefer-global-this': 'off',
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
      'packages/learn/.astro/**',
    ],
  },
];
