import js from '@eslint/js';
import solid from 'eslint-plugin-solid/configs/recommended';
import * as tsParser from '@typescript-eslint/parser';
// import eslintPluginUnicorn from 'eslint-plugin-unicorn';
// import sonarjs from 'eslint-plugin-sonarjs';

export default [
  js.configs.recommended,
  solid,
  // eslintPluginUnicorn.configs.recommended,
  // {
  //   rules: {
  //     'unicorn/better-regex': 'warn',
  //   },
  // },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    // plugins: {
    //   sonarjs,
    // },
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
