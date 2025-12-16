# UI Package Migration Plan

Extract Zag components from `packages/web` into a shared `packages/ui` package for reuse across web and landing.

## Package Structure

```
packages/
  ui/
    package.json
    jsconfig.json
    src/
      index.js              # Barrel export
      zag/
        index.js            # Zag barrel export
        Accordion.jsx
        Avatar.jsx
        Checkbox.jsx
        Clipboard.jsx
        Collapsible.jsx
        Combobox.jsx
        Dialog.jsx
        Editable.jsx
        FileUpload.jsx
        FloatingPanel.jsx
        Menu.jsx
        NumberInput.jsx
        PasswordInput.jsx
        PinInput.jsx
        Popover.jsx
        Progress.jsx
        QRCode.jsx
        RadioGroup.jsx
        Select.jsx
        Splitter.jsx
        Switch.jsx
        Tabs.jsx
        TagsInput.jsx
        Toast.jsx
        ToggleGroup.jsx
        Tooltip.jsx
        Tour.jsx
        README.md
```

## Tasks

### 1. Create Package Infrastructure

- [ ] Create `packages/ui/` directory
- [ ] Create `package.json` with name `@corates/ui`
- [ ] Create `jsconfig.json` for path aliases
- [ ] Add to `pnpm-workspace.yaml` (already includes `packages/*`)

### 2. Move Dependencies

Move these from `packages/web/package.json` to `packages/ui/package.json`:

**Zag.js packages:**

- @zag-js/accordion
- @zag-js/avatar
- @zag-js/checkbox
- @zag-js/clipboard
- @zag-js/collapsible
- @zag-js/combobox
- @zag-js/dialog
- @zag-js/editable
- @zag-js/file-upload
- @zag-js/floating-panel
- @zag-js/menu
- @zag-js/number-input
- @zag-js/pin-input
- @zag-js/popover
- @zag-js/progress
- @zag-js/qr-code
- @zag-js/radio-group
- @zag-js/select
- @zag-js/solid
- @zag-js/splitter
- @zag-js/switch
- @zag-js/tabs
- @zag-js/tags-input
- @zag-js/toast
- @zag-js/toggle-group
- @zag-js/tooltip
- @zag-js/tour

**Peer dependencies:**

- solid-js (peerDependency)
- solid-icons (or move icons to consuming packages)

### 3. Move Component Files

- [ ] Copy all files from `packages/web/src/components/zag/` to `packages/ui/src/zag/`
- [ ] Create barrel exports (`index.js` files)
- [ ] Delete original files from web package

### 4. Create Barrel Exports

`packages/ui/src/zag/index.js`:

```js
export { Accordion } from './Accordion';
export { Avatar } from './Avatar';
export { Checkbox } from './Checkbox';
export { Clipboard, CopyButton } from './Clipboard';
// ... all components
```

`packages/ui/src/index.js`:

```js
export * from './zag';
```

### 5. Update Consumer Packages

**packages/web/package.json:**

```json
{
  "dependencies": {
    "@corates/ui": "workspace:*"
  }
}
```

**packages/landing/package.json:**

```json
{
  "dependencies": {
    "@corates/ui": "workspace:*"
  }
}
```

### 6. Update Imports in Web Package

Find and replace all imports:

```js
// Before
import { Dialog } from '@components/zag/Dialog';
import { Select } from '@components/zag/Select';

// After
import { Dialog, Select } from '@corates/ui';
```

### 7. Tailwind Configuration

The UI package uses Tailwind classes. Options:

**Option A: Classes only (recommended)**

- UI package outputs JSX with Tailwind classes
- Each consuming app (web, landing) has its own Tailwind config
- Tailwind config must include `'./node_modules/@corates/ui/**/*.{js,jsx}'` in content paths

**Option B: Shared Tailwind config**

- Create base config in UI package
- Extend in web/landing

### 8. Update Tailwind Configs

`packages/web/tailwind.config.js` - add:

```js
content: ['./src/**/*.{js,jsx}', './node_modules/@corates/ui/**/*.{js,jsx}'];
```

`packages/landing/tailwind.config.js` - add:

```js
content: ['./src/**/*.{js,jsx}', './node_modules/@corates/ui/**/*.{js,jsx}'];
```

### 9. Handle Toast Primitive

The Toast component uses `@primitives/useToast`. Options:

- Move `useToast` primitive to UI package
- Or keep Toast in web, only share components that don't need primitives

### 10. Testing

- [ ] Run `pnpm install` to link workspace packages
- [ ] Run `pnpm lint` to check for errors
- [ ] Start dev servers for web and landing
- [ ] Verify components render correctly
- [ ] Test a component import in landing page

## Migration Order

1. Create package infrastructure (package.json, jsconfig.json)
2. Move dependencies
3. Move component files
4. Create barrel exports
5. Update web package imports
6. Update Tailwind configs
7. Test web package still works
8. Add dependency to landing
9. Test landing can use components

## Rollback Plan

If issues arise:

1. Revert package.json changes
2. Copy components back to web
3. Remove ui package directory

## Open Questions

1. Should solid-icons be a peer dependency or bundled?
2. Move useToast to UI package or keep Toast separate?
3. Any other primitives/utilities needed by components?

## Estimated Effort

- Package setup: 15 min
- Move files & dependencies: 20 min
- Update imports in web: 30 min (many files to update)
- Tailwind config updates: 10 min
- Testing: 15 min

**Total: ~1.5 hours**
