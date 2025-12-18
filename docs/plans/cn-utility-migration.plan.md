# cn() Utility Migration Plan

## Overview

Add `clsx` and `tailwind-merge` to the `@corates/ui` package and migrate all Zag components to use a `cn()` utility for cleaner, more flexible class handling.

## Goals

1. Enable cleaner conditional class logic
2. Allow consumers to override default styles without class conflicts
3. Establish consistent pattern across all UI components

## Dependencies to Add

```bash
pnpm add clsx tailwind-merge --filter @corates/ui
```

## Implementation Steps

### Phase 1: Setup

1. [ ] Install dependencies in `packages/ui`
2. [ ] Create `packages/ui/src/lib/cn.js` utility:

   ```js
   import { clsx } from 'clsx';
   import { twMerge } from 'tailwind-merge';

   export function cn(...inputs) {
     return twMerge(clsx(inputs));
   }
   ```

3. [ ] Export from `packages/ui/src/index.js`

### Phase 2: Migrate Zag Components (26 files)

Migrate each component to use `cn()` instead of template literals:

**Priority 1 - High usage components:**

- [ ] Dialog.jsx
- [ ] Select.jsx
- [ ] Combobox.jsx
- [ ] Tabs.jsx
- [ ] Menu.jsx
- [ ] Tooltip.jsx
- [ ] Popover.jsx

**Priority 2 - Form components:**

- [ ] Checkbox.jsx
- [ ] RadioGroup.jsx
- [ ] Switch.jsx
- [ ] NumberInput.jsx
- [ ] PasswordInput.jsx
- [ ] PinInput.jsx
- [ ] TagsInput.jsx
- [ ] Editable.jsx
- [ ] FileUpload.jsx

**Priority 3 - Display components:**

- [ ] Accordion.jsx
- [ ] Collapsible.jsx
- [ ] Avatar.jsx
- [ ] Progress.jsx
- [ ] QRCode.jsx
- [ ] Clipboard.jsx
- [ ] Toast.jsx

**Priority 4 - Utility components:**

- [ ] ToggleGroup.jsx
- [ ] Splitter.jsx
- [ ] FloatingPanel.jsx
- [ ] Tour.jsx

### Phase 3: Update Exports

- [ ] Add `cn` to `packages/ui/src/index.js` exports for consumer use

## Migration Pattern

### Before:

```jsx
<div
  class={`
    px-2 py-1 border rounded
    ${disabled() ? 'opacity-50 cursor-not-allowed' : ''}
    ${props.class || ''}
  `}
>
```

### After:

```jsx
<div
  class={cn(
    'px-2 py-1 border rounded',
    disabled() && 'opacity-50 cursor-not-allowed',
    props.class
  )}
>
```

## Benefits

- **Cleaner code**: No more `${x || ''}` or ternary templates
- **Safe overrides**: `cn('p-4', props.class)` where `props.class="p-2"` results in just `p-2`
- **Falsy handling**: `cn('base', false && 'conditional')` safely ignores falsy values
- **Array support**: `cn(['a', 'b'], props.class)` works

## Testing

- [ ] Verify each migrated component renders correctly
- [ ] Test class override behavior with consumer props
- [ ] Run existing component tests

## Estimated Effort

- Setup: 10 minutes
- Per component: 5-10 minutes
- Total: ~3-4 hours

## Notes

- Migration can be done incrementally (component by component)
- No breaking changes to component APIs
- Consider migrating `packages/web` components later as a follow-up
