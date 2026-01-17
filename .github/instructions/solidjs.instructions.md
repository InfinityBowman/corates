---
applyTo: 'packages/web/**,packages/landing/**'
description: 'SolidJS reactivity patterns, props, stores, and primitives'
---

# SolidJS Patterns

## Props - Critical Reactivity Rules

**NEVER destructure props** - it breaks reactivity:

```js
// WRONG - breaks reactivity
function MyComponent(props) {
  const { name } = props;
  return <div>{name}</div>; // Won't update
}

// CORRECT - access directly
function MyComponent(props) {
  return <div>{props.name}</div>;
}

// CORRECT - wrap in function
function MyComponent(props) {
  const name = () => props.name;
  return <div>{name()}</div>;
}
```

## State Architecture

### Stores vs Props

1. **Shared/cross-feature state** - External store (`packages/web/src/stores/`)
2. **Local component state** - `createSignal` or `createStore`
3. **Derived values** - `createMemo`
4. **Local configuration** - Props

### Import Stores Directly

```js
// CORRECT
import projectStore from '@/stores/projectStore.js';

function MyComponent() {
  const projects = () => projectStore.getProjectList();
  return <div>{projects()?.length}</div>;
}

// WRONG - prop drilling
function MyComponent({ projects }) {
  // Don't pass store data through props
}
```

## Reactive Primitives

### createSignal - Simple Values

```js
const [count, setCount] = createSignal(0);
```

### createStore - Complex Objects

```js
import { createStore } from 'solid-js/store';

const [state, setState] = createStore({
  items: [],
  loading: false,
});

// Update nested values
setState('items', items => [...items, newItem]);
setState('loading', true);
```

### createMemo - Derived Values

```js
const filteredItems = createMemo(() => items().filter(item => item.active));
```

## Component Patterns

- Components receive at most 1-5 props (local config only)
- Move business logic to stores, utilities, or primitives
- Use `Show` and `For` for conditional/list rendering
