import js from '@eslint/js';
import solid from 'eslint-plugin-solid/configs/recommended';
import * as tsParser from '@typescript-eslint/parser';
import coratesRules from './eslint-rules/index.js';

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
    plugins: {
      corates: coratesRules,
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
        SVGGElement: 'readonly',
        SVGElement: 'readonly',
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
      // Prevent throwing literals - must throw Error objects
      'no-throw-literal': 'error',

      // Ensure correct usage of @corates/ui prestyled vs primitive components
      // Prestyled (Dialog) should not be used with .Root, .Content patterns
      // Use DialogPrimitive for primitive patterns
      'corates/corates-ui-imports': 'error',

      // Prevent Outlet usage - use props.children for nested routes
      'corates/no-outlet': 'error',

      // Restrict direct imports from @ark-ui/solid - use @corates/ui instead
      // This ensures consistent styling and prevents confusion between
      // prestyled components (Dialog) and primitives (DialogPrimitive)
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@ark-ui/solid',
              message:
                'Import from @corates/ui instead. Use ComponentName for prestyled or ComponentNamePrimitive for the Ark UI primitive.',
            },
            {
              name: '@ark-ui/solid/accordion',
              message: "Import { Accordion } or { AccordionPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/avatar',
              message: "Import { Avatar } or { AvatarPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/checkbox',
              message: "Import { Checkbox } or { CheckboxPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/clipboard',
              message: "Import { Clipboard } or { ClipboardPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/collapsible',
              message: "Import { Collapsible } or { CollapsiblePrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/combobox',
              message: "Import { Combobox } or { ComboboxPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/dialog',
              message: "Import { Dialog } or { DialogPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/drawer',
              message: "Import { Drawer } or { DrawerPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/editable',
              message: "Import { Editable } or { EditablePrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/file-upload',
              message: "Import { FileUpload } or { FileUploadPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/floating-panel',
              message: "Import { FloatingPanel } or { FloatingPanelPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/menu',
              message: "Import { Menu } or { MenuPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/number-input',
              message: "Import { NumberInput } or { NumberInputPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/pin-input',
              message: "Import { PinInput } or { PinInputPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/popover',
              message: "Import { Popover } or { PopoverPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/progress',
              message: "Import { Progress } or { ProgressPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/qr-code',
              message: "Import { QRCode } or { QRCodePrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/radio-group',
              message: "Import { RadioGroup } or { RadioGroupPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/select',
              message: "Import { Select } or { SelectPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/splitter',
              message: "Import { Splitter } or { SplitterPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/switch',
              message: "Import { Switch } or { SwitchPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/tabs',
              message: "Import { Tabs } or { TabsPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/tags-input',
              message: "Import { TagsInput } or { TagsInputPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/toast',
              message: "Import { Toaster, showToast } or { ToastPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/toggle-group',
              message: "Import { ToggleGroup } or { ToggleGroupPrimitive } from '@corates/ui'",
            },
            {
              name: '@ark-ui/solid/tooltip',
              message: "Import { Tooltip } or { TooltipPrimitive } from '@corates/ui'",
            },
          ],
          patterns: [
            {
              group: ['@ark-ui/solid/*'],
              message:
                'Import from @corates/ui instead. Use ComponentName for prestyled or ComponentNamePrimitive for the Ark UI primitive.',
            },
          ],
        },
      ],
    },
  },
  {
    // UI package can import from @ark-ui/solid directly (it wraps primitives)
    files: ['packages/ui/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // Web UI components can import from @ark-ui/solid directly (shadcn-style primitives)
    files: ['packages/web/src/components/ui/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
      'corates/corates-ui-imports': 'off',
    },
  },
  {
    // Web lib/ui can import from @ark-ui/solid directly
    files: ['packages/web/src/lib/ui/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
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
    languageOptions: {
      globals: {
        // Cloudflare Workers globals
        MessageEvent: 'readonly',
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
      },
    },
    rules: {
      // Use createDomainError(), createTransportError(), or createValidationError()
      'corates/corates-error-helpers': 'warn',
    },
  },
  {
    // Preact components - disable SolidJS rules
    files: ['**/preact/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        React: 'readonly',
        HTMLAnchorElement: 'readonly',
        HTMLFormElement: 'readonly',
        Node: 'readonly',
        NodeJS: 'readonly',
      },
    },
    rules: {
      'solid/reactivity': 'off',
      'solid/no-destructure': 'off',
      'solid/prefer-for': 'off',
      'solid/components-return-once': 'off',
      'solid/no-react-specific-props': 'off',
      'solid/style-prop': 'off',
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
    ],
  },
];
