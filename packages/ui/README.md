# @corates/ui

**Shared UI component library for CoRATES** - SolidJS components built with Ark UI, providing accessible, headless components with Tailwind CSS styling.

## Purpose

This package provides reusable UI components for the CoRATES frontend:

- **40+ accessible components** built on Ark UI primitives
- **Headless component architecture** with full styling control
- **SolidJS-native** with reactive state management
- **Tailwind CSS** styling with `cn()` utility for class merging
- **TypeScript** type definitions for all components

## Tech Stack

- **Framework:** SolidJS 1.9+ (peer dependency)
- **Primitives:** Ark UI 5.30+ (accessible headless components)
- **Legacy:** Zag.js 1.32+ (Tour component only)
- **Styling:** Tailwind CSS + clsx + tailwind-merge
- **Icons:** solid-icons 1.1+ (peer dependency)
- **Testing:** Vitest 4.0+ with SolidJS Testing Library

## Installation

This package is designed for use within the CoRATES monorepo:

```bash
# Add to another workspace package
pnpm add @corates/ui --workspace
```

## Usage

### Importing Components

```jsx
import {
  Dialog,
  Select,
  Tabs,
  Toast,
  toaster,
  Tooltip,
} from '@corates/ui';

// Import primitives for custom components
import { DialogPrimitive } from '@corates/ui';

// Import utilities
import { cn, Z_INDEX } from '@corates/ui';
```

### Basic Example

```jsx
import { Dialog, toaster } from '@corates/ui';

function MyComponent() {
  const [open, setOpen] = createSignal(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Open Dialog</button>

      <Dialog
        open={open()}
        onOpenChange={({ open }) => setOpen(open)}
        title="Confirm Action"
        description="Are you sure you want to proceed?"
      >
        <button onClick={() => {
          toaster.success('Action confirmed!');
          setOpen(false);
        }}>
          Confirm
        </button>
      </Dialog>
    </>
  );
}
```

## Component Categories

### Layout & Structure

| Component | Description |
|-----------|-------------|
| **Accordion** | Expandable/collapsible content sections with keyboard navigation |
| **Collapsible** | Single collapsible content section |
| **Splitter** | Resizable split panels for layouts |
| **Tabs** | Tabbed content panels with routed or local state |

### Forms & Input

| Component | Description |
|-----------|-------------|
| **Checkbox** | Checkbox input with indeterminate state support |
| **Combobox** | Searchable select with autocomplete and filtering |
| **Editable** | Inline editable text with submit/cancel |
| **FileUpload** | File upload with drag-and-drop and previews |
| **NumberInput** | Numeric input with increment/decrement buttons |
| **PasswordInput** | Password input with visibility toggle |
| **PinInput** | OTP/PIN code input with auto-focus |
| **RadioGroup** | Radio button group with keyboard navigation |
| **Select** | Dropdown select with search and multi-select |
| **Switch** | Toggle switch (on/off) |
| **TagsInput** | Tag/chip input with add/remove |

### Overlays & Dialogs

| Component | Description |
|-----------|-------------|
| **Dialog** | Modal dialog with backdrop and focus trap |
| **ConfirmDialog** | Pre-built confirmation dialog with promise API |
| **Drawer** | Slide-in panel from any edge |
| **FloatingPanel** | Draggable/resizable floating panel |
| **Menu** | Dropdown menu with submenus and keyboard navigation |
| **Popover** | Floating content panel with positioning |
| **Tooltip** | Hover tooltips with delay and positioning |

### Feedback & Status

| Component | Description |
|-----------|-------------|
| **Avatar** | User avatar with fallback initials |
| **Progress** | Progress bar with percentage display |
| **Spinner** | Loading spinner with variants (button, page, inline) |
| **Toast/Toaster** | Toast notifications (success, error, info, loading) |

### Utilities

| Component | Description |
|-----------|-------------|
| **Clipboard** | Copy to clipboard button with feedback |
| **QRCode** | QR code generator |
| **ToggleGroup** | Group of toggle buttons (single or multi-select) |
| **Tour** | Guided tour/onboarding with steps |

## Key Exports

### Components

All components export two versions:

1. **High-level component** (e.g., `Dialog`) - Pre-styled, opinionated implementation
2. **Primitive** (e.g., `DialogPrimitive`) - Headless Ark UI primitive for custom styling

```jsx
// Use high-level component for standard UI
import { Dialog } from '@corates/ui';

// Use primitive for custom implementations
import { DialogPrimitive } from '@corates/ui';
```

### Hooks

Some components also export hooks:

```jsx
import {
  useCheckbox,
  useCombobox,
  useConfirmDialog,
  usePopover,
  useSelect,
  useSwitch,
  useTour,
  useTooltip,
  useWindowDrag,
} from '@corates/ui';
```

### Utilities

```jsx
import { cn } from '@corates/ui';  // Class name utility (clsx + tailwind-merge)
import { Z_INDEX } from '@corates/ui';  // z-index constants for layering
```

### Toast API

```jsx
import { toaster, showToast } from '@corates/ui';

// Promise-based API
toaster.promise(
  fetchData(),
  {
    loading: 'Loading...',
    success: 'Data loaded!',
    error: 'Failed to load data',
  }
);

// Direct API
toaster.success('Success message');
toaster.error('Error message');
toaster.info('Info message');
toaster.loading('Loading...');

// Custom toast with duration
showToast({
  title: 'Custom Toast',
  description: 'With custom options',
  type: 'success',
  duration: 5000,
});
```

## Styling

### Tailwind CSS

Components use Tailwind CSS classes. Ensure your Tailwind config includes the UI package:

```js
// tailwind.config.js (Tailwind v4)
@source "../../packages/ui/src/**/*.{ts,tsx}";
```

### Class Name Merging

Use the `cn()` utility to merge Tailwind classes with proper precedence:

```jsx
import { cn } from '@corates/ui';

<div className={cn(
  'bg-blue-500 text-white',  // Base classes
  isActive && 'bg-green-500', // Conditional override
  className                   // User-provided override
)} />
```

### Z-Index System

Use centralized z-index constants for consistent layering:

```jsx
import { Z_INDEX } from '@corates/ui';

// Z_INDEX.MODAL, Z_INDEX.TOOLTIP, Z_INDEX.POPOVER, etc.
<div style={{ zIndex: Z_INDEX.MODAL }} />
```

## Development

```bash
# Install dependencies
pnpm install

# Type check
pnpm typecheck

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Testing

All components have comprehensive unit tests using Vitest and SolidJS Testing Library:

```bash
# Run all tests
pnpm test

# Run specific test
pnpm test Dialog

# Watch mode
pnpm test:watch
```

Test files are located in `src/components/__tests__/`.

### Testing Example

```tsx
import { render, screen } from '@solidjs/testing-library';
import { Dialog } from './Dialog';

test('Dialog renders with title and description', () => {
  render(() => (
    <Dialog
      open={true}
      title="Test Title"
      description="Test Description"
    />
  ));

  expect(screen.getByText('Test Title')).toBeInTheDocument();
  expect(screen.getByText('Test Description')).toBeInTheDocument();
});
```

## Architecture

### Component Structure

Each component follows this pattern:

```tsx
// High-level styled component
export function Dialog(props) {
  return (
    <DialogPrimitive.Root {...props}>
      {/* Pre-styled implementation */}
    </DialogPrimitive.Root>
  );
}

// Re-export primitive for custom use
export { Dialog as DialogPrimitive } from '@ark-ui/solid';
```

### Headless Primitives

Most components are built on [Ark UI](https://ark-ui.com/) primitives:
- **Accessibility**: ARIA attributes, keyboard navigation, focus management
- **State management**: Handle open/close, selection, focus, etc.
- **No styling**: Bring your own styles with Tailwind

### Legacy Components

The **Tour** component still uses Zag.js (not migrated to Ark UI). This is the only remaining Zag.js dependency and may be migrated in the future.

## Common Patterns

### Dialog with Confirmation

```jsx
import { ConfirmDialog, useConfirmDialog } from '@corates/ui';

const confirmDialog = useConfirmDialog();

// Show confirmation dialog
const confirmed = await confirmDialog.confirm({
  title: 'Delete Project',
  description: 'Are you sure? This cannot be undone.',
  confirmText: 'Delete',
  cancelText: 'Cancel',
});

if (confirmed) {
  // Proceed with deletion
}
```

### Select with Search

```jsx
import { Select } from '@corates/ui';

<Select
  items={[
    { label: 'Option 1', value: '1' },
    { label: 'Option 2', value: '2' },
  ]}
  value={selectedValue()}
  onValueChange={({ value }) => setSelectedValue(value)}
  placeholder="Select an option"
/>
```

### Tooltip

```jsx
import { Tooltip } from '@corates/ui';

<Tooltip content="This is a helpful tooltip">
  <button>Hover me</button>
</Tooltip>
```

### File Upload

```jsx
import { FileUpload } from '@corates/ui';

<FileUpload
  accept="application/pdf"
  maxFiles={5}
  onFilesChange={(files) => {
    console.log('Uploaded files:', files);
  }}
/>
```

## Peer Dependencies

This package requires:
- **solid-js** ^1.9.0 - SolidJS framework
- **solid-icons** ^1.1.0 - Icon library

These are marked as peer dependencies to avoid version conflicts.

## Links

- **Frontend Package:** [packages/web/](../web/)
- **Ark UI Documentation:** https://ark-ui.com/
- **SolidJS Documentation:** https://solidjs.com/
- **Tailwind CSS:** https://tailwindcss.com/

## Migration Notes

### From Zag.js to Ark UI

Most components have been migrated from Zag.js to Ark UI. The API is similar but with improvements:

**Old (Zag.js):**
```jsx
const [state, send] = createMachine(dialog.machine({ id: '1' }));
const api = dialog.connect(state, send);
```

**New (Ark UI):**
```jsx
<Dialog.Root open={open()} onOpenChange={setOpen}>
  <Dialog.Trigger />
  <Dialog.Backdrop />
  <Dialog.Positioner>
    <Dialog.Content />
  </Dialog.Positioner>
</Dialog.Root>
```

### Custom Components

If you need custom behavior, use primitives directly:

```jsx
import { SelectPrimitive } from '@corates/ui';

<SelectPrimitive.Root {...props}>
  {/* Your custom implementation */}
</SelectPrimitive.Root>
```

## TypeScript

All components are fully typed with TypeScript. Import types from components:

```tsx
import type { SpinnerProps, SpinnerSize, SpinnerVariant } from '@corates/ui';
```
