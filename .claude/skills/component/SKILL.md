---
name: Component
description: This skill should be used when the user asks to "create a component", "scaffold a component", "add a new component", "build a SolidJS component", or mentions creating UI elements, views, or feature components. Provides SolidJS component patterns specific to CoRATES.
---

# SolidJS Component Creation

Create SolidJS components following CoRATES patterns and conventions.

## Core Principles

1. **No prop destructuring** - Access props via `props.field` directly
2. **No prop drilling** - Import stores directly where needed
3. **Minimal props** - Components receive 1-5 local config props only
4. **Small and focused** - Each component handles one responsibility
5. **No emojis** - Use `solid-icons` library for all icons

## Quick Reference

### File Location

```
packages/web/src/components/
  [feature]/           # Feature directory
    ComponentName.jsx  # PascalCase naming
    index.js           # Barrel export (optional, for lazy loading)
```

### Basic Component Template

```jsx
import { createSignal, createMemo, Show, For } from 'solid-js';
import { FiIcon } from 'solid-icons/fi';
import { Button, Dialog } from '@corates/ui';
import someStore from '@/stores/someStore.js';

export function ComponentName(props) {
  // Local state only
  const [localState, setLocalState] = createSignal(false);

  // Derived values
  const computed = createMemo(() => {
    return props.items?.length ?? 0;
  });

  // Access props directly - NEVER destructure
  const handleClick = () => {
    props.onAction?.(props.itemId);
  };

  return (
    <div class='...'>
      <Show when={props.showHeader}>
        <h2>{props.title}</h2>
      </Show>
      <span>{computed()} items</span>
    </div>
  );
}

export default ComponentName;
```

## Critical Rules

### Props - NEVER Destructure

```jsx
// WRONG - breaks reactivity
function Component({ title, items, onSelect }) {
  return <h1>{title}</h1>;
}

// CORRECT - preserves reactivity
function Component(props) {
  return <h1>{props.title}</h1>;
}
```

For derived values, wrap in function or createMemo:

```jsx
// Arrow function for simple access
const isOwner = () => props.role === 'owner';

// createMemo for computed values
const progress = createMemo(() => ({
  completed: props.completed ?? 0,
  total: props.total ?? 0,
  percentage: props.total ? Math.round((props.completed / props.total) * 100) : 0,
}));

// Usage
<Show when={isOwner()}>...</Show>
<span>{progress().percentage}%</span>
```

### Stores - Import Directly

```jsx
// WRONG - prop drilling
function Parent() {
  return <Child projects={projects()} user={user()} settings={settings()} />;
}

// CORRECT - import stores where needed
import projectStore from '@/stores/projectStore.js';
import { user } from '@/stores/authStore.js';

function Component(props) {
  // Read from store directly
  const studies = () => projectStore.getStudies(props.projectId);

  return <For each={studies()}>{study => ...}</For>;
}
```

### Icons - Use solid-icons

```jsx
import { FiCheck, FiX, FiFolder } from 'solid-icons/fi';
import { AiOutlineFolder } from 'solid-icons/ai';
import { HiOutlineDocumentCheck } from 'solid-icons/hi';

// Usage
<FiCheck class="h-4 w-4 text-green-500" />

// Conditional icons
<Show when={isExpanded()} fallback={<AiOutlineFolder class="h-4 w-4" />}>
  <AiOutlineFolderOpen class="h-4 w-4" />
</Show>
```

### UI Components - Import from @corates/ui

```jsx
// CORRECT
import { Dialog, Select, Toast, Avatar, Tooltip, useConfirmDialog } from '@corates/ui';

// WRONG - no local wrappers
import { Dialog } from '@/components/ark/Dialog.jsx';
```

## Import Aliases

Use path aliases from jsconfig.json:

```jsx
import Component from '@components/feature/Component.jsx';
import { useHook } from '@primitives/useHook.js';
import store from '@/stores/store.js';
import { config } from '@config/api.js';
import { utility } from '@lib/utils.js';
```

## State Patterns

### Local State (createSignal)

For UI state within the component:

```jsx
const [isOpen, setIsOpen] = createSignal(false);
const [search, setSearch] = createSignal('');
```

### Derived State (createMemo)

For computed values that depend on props or signals:

```jsx
const stats = createMemo(() => {
  const items = props.items ?? [];
  return {
    total: items.length,
    completed: items.filter(i => i.done).length,
  };
});
```

### Complex Local State (createStore)

For nested objects within the component:

```jsx
import { createStore, produce } from 'solid-js/store';

const [form, setForm] = createStore({
  name: '',
  settings: { notify: true },
});

// Update nested
setForm(
  produce(f => {
    f.settings.notify = false;
  }),
);
```

## Component Patterns

### Conditional Rendering

```jsx
<Show when={props.data} fallback={<Loading />}>
  {data => <Content data={data()} />}
</Show>

<Switch>
  <Match when={status() === 'loading'}><Loading /></Match>
  <Match when={status() === 'error'}><Error /></Match>
  <Match when={status() === 'success'}><Success /></Match>
</Switch>
```

### List Rendering

```jsx
<For each={props.items}>
  {(item, index) => (
    <Item
      item={item}
      index={index()}
      onSelect={() => props.onSelect?.(item.id)}
    />
  )}
</For>

// With keyed for identity-based updates
<Index each={items()}>
  {(item, index) => <Item item={item()} />}
</Index>
```

### Event Handlers

```jsx
// Call props handlers with optional chaining
<button onClick={() => props.onDelete?.(props.id)}>
  Delete
</button>

// Stop propagation when needed
<button onClick={e => {
  e.stopPropagation();
  props.onAction?.();
}}>
  Action
</button>
```

## Barrel Exports

For lazy-loaded routes, create index.js:

```jsx
// packages/web/src/components/feature/index.js
export { default } from './FeatureMain.jsx';
export { FeatureCard } from './FeatureCard.jsx';
export { FeatureList } from './FeatureList.jsx';
```

## Creation Checklist

When creating a component:

1. Determine file location under `packages/web/src/components/`
2. Identify required props (keep to 1-5 max)
3. Identify stores to import (no prop drilling)
4. Choose icons from solid-icons
5. Use Ark UI components from @corates/ui
6. Apply proper state patterns (signal/memo/store)
7. Ensure no prop destructuring
8. Keep component focused and small

## Additional Resources

### Reference Files

For detailed patterns and examples:

- **`references/patterns.md`** - Comprehensive state patterns, effects, and cleanup
- **`references/examples.md`** - Real component examples from the codebase

### Example Files

Working templates in `examples/`:

- **`ExampleComponent.jsx`** - Complete component template with all patterns
