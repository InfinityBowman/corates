# Component Development Guide

This guide covers component structure, props patterns, composition, and best practices for building components in CoRATES.

## Overview

Components in CoRATES are built with SolidJS and follow patterns that maintain reactivity while keeping components lean and focused on rendering.

## Component Structure

### Basic Component Pattern

```jsx
import { createSignal, Show, For } from 'solid-js';
import projectStore from '@/stores/projectStore.js';

export default function MyComponent(props) {
  // Local state (only for UI state)
  const [isOpen, setIsOpen] = createSignal(false);

  // Read from stores (reactive)
  const projects = () => projectStore.getProjectList();

  // Computed values
  const projectCount = () => projects().length;

  return (
    <div>
      <Show when={isOpen()}>
        <For each={projects()}>
          {project => <ProjectCard project={project} />}
        </For>
      </Show>
    </div>
  );
}
```

## Props Patterns

### Critical: Never Destructure Props

**Destructuring breaks reactivity in SolidJS:**

```jsx
// WRONG - breaks reactivity
function MyComponent(props) {
  const { name, age } = props;
  return <div>{name} is {age}</div>; // Won't update when props change
}

// WRONG - another example
function MyComponent(props) {
  const name = props.name;
  return <div>{name}</div>; // Won't update
}

// CORRECT - access directly
function MyComponent(props) {
  return <div>{props.name} is {props.age}</div>; // Maintains reactivity
}

// CORRECT - wrap in function for computed access
function MyComponent(props) {
  const name = () => props.name;
  return <div>{name()}</div>; // Maintains reactivity
}
```

### Props Best Practices

```jsx
// Good: Direct prop access
function ProjectCard(props) {
  return (
    <div>
      <h3>{props.project.name}</h3>
      <p>{props.project.description}</p>
    </div>
  );
}

// Good: Memoized prop access for derived values
function ProjectCard(props) {
  const displayName = createMemo(() => {
    return `${props.project.name} (${props.project.status})`;
  });

  return <h3>{displayName()}</h3>;
}
```

## Component Organization

### File Structure

Components are organized by feature:

```
src/components/
├── project-ui/          # Project-related components
│   ├── ProjectView.jsx
│   ├── ProjectCard.jsx
│   └── CreateProjectForm.jsx
├── checklist-ui/        # Checklist-related components
│   ├── AMSTAR2Checklist.jsx
│   └── ChecklistYjsWrapper.jsx
├── auth-ui/             # Auth-related components
│   ├── SignIn.jsx
│   └── SignUp.jsx
└── common/              # Shared components
    └── NoteEditor.jsx
```

### Component Size

Keep components focused and small:

```jsx
// GOOD - Focused component
function ProjectCard(props) {
  const project = () => props.project;

  return (
    <div class="project-card">
      <h3>{project().name}</h3>
      <ProjectActions projectId={project().id} />
    </div>
  );
}

// BAD - Too much logic in component
function ProjectCard(props) {
  // Don't put API calls, complex logic, etc. in components
  const [data, setData] = createSignal(null);

  fetch('/api/project/' + props.project.id)
    .then(res => res.json())
    .then(setData);

  // Move this to a store or primitive instead
}
```

## State Management in Components

### When to Use createSignal

Use `createSignal` for **local UI state only**:

```jsx
function MyComponent() {
  // Good: UI state (modal open/closed, form field values)
  const [isOpen, setIsOpen] = createSignal(false);
  const [inputValue, setInputValue] = createSignal('');

  // Bad: Application state (should be in store)
  // const [projects, setProjects] = createSignal([]);
}
```

### When to Use Stores

Use stores for **shared/cross-feature state**:

```jsx
import projectStore from '@/stores/projectStore.js';

function MyComponent() {
  // Good: Read from store
  const projects = () => projectStore.getProjectList();

  // Bad: Local state for shared data
  // const [projects, setProjects] = createSignal([]);
}
```

### When to Use Primitives

Use primitives for **reusable business logic**:

```jsx
import { useProjectData } from '@/primitives/useProjectData.js';

function MyComponent(props) {
  // Good: Use primitive for project operations
  const { studies, isConnected } = useProjectData(props.projectId);

  // Bad: Duplicate logic in component
  // const [studies, setStudies] = createSignal([]);
  // useEffect(() => { /* fetch studies */ });
}
```

## Component Composition

### Passing Props vs Store Access

**Prefer store access over prop drilling:**

```jsx
// BAD - Prop drilling
function App() {
  const projects = () => projectStore.getProjectList();
  return <ProjectList projects={projects()} />;
}

function ProjectList({ projects }) {
  return <ProjectDashboard projects={projects} />;
}

function ProjectDashboard({ projects }) {
  return <div>{projects.length} projects</div>;
}

// GOOD - Direct store access
function App() {
  return <ProjectList />;
}

function ProjectList() {
  return <ProjectDashboard />;
}

function ProjectDashboard() {
  const projects = () => projectStore.getProjectList();
  return <div>{projects().length} projects</div>;
}
```

### Component Props Limit

Components should receive **at most 1-5 props** (for local configuration only):

```jsx
// GOOD - Few props for configuration
function ProjectCard(props) {
  // props.projectId, props.showActions, props.onClick - all configuration
  const project = () => projectStore.getProject(props.projectId);
  return <div>...</div>;
}

// BAD - Too many props (should use store or context)
function ProjectCard(props) {
  // 10+ props means you're prop drilling
  // Move shared state to a store instead
}
```

## Import Aliases

Use import aliases from `jsconfig.json`:

```jsx
// GOOD - Use aliases
import projectStore from '@/stores/projectStore.js';
import { handleError } from '@/lib/error-utils.js';
import SignIn from '@auth-ui/SignIn.jsx';
import ChecklistWrapper from '@checklist-ui/ChecklistYjsWrapper.jsx';

// BAD - Relative paths when alias available
import projectStore from '../../stores/projectStore.js';
```

### Available Aliases

- `@/*` → `src/*`
- `@components/*` → `src/components/*`
- `@auth-ui/*` → `src/components/auth-ui/*`
- `@checklist-ui/*` → `src/components/checklist-ui/*`
- `@project-ui/*` → `src/components/project-ui/*`
- `@routes/*` → `src/routes/*`
- `@primitives/*` → `src/primitives/*`
- `@api/*` → `src/api/*`
- `@config/*` → `src/config/*`
- `@lib/*` → `src/lib/*`

## UI Component Library

### Ark UI Components

**Always import from `@corates/ui`, not local components:**

```jsx
// GOOD - Import from @corates/ui
import { Dialog, Select, Toast, showToast, Avatar } from '@corates/ui';

// BAD - Don't import from local components
import { Dialog } from '@/components/zag/Dialog.jsx';
```

### Common Components

```jsx
import {
  Dialog,
  ConfirmDialog,
  useConfirmDialog,
  Select,
  Combobox,
  Toast,
  showToast,
  Avatar,
  Tabs,
  Checkbox,
  Switch,
  RadioGroup,
  Tooltip,
  Popover,
  Menu,
  FileUpload,
  PasswordInput,
} from '@corates/ui';

function MyComponent() {
  const confirmDialog = useConfirmDialog();

  const handleDelete = async () => {
    const confirmed = await confirmDialog.confirm({
      title: 'Delete Project?',
      message: 'This action cannot be undone.',
    });

    if (confirmed) {
      // Delete logic
      showToast.success('Project deleted');
    }
  };

  return (
    <Dialog>
      {/* Dialog content */}
    </Dialog>
  );
}
```

## Icons

**Always use `solid-icons` library, NEVER use emojis:**

```jsx
// GOOD - Import from solid-icons
import { BiRegularHome, BiRegularCheck } from 'solid-icons/bi';
import { FiUsers } from 'solid-icons/fi';
import { AiFillCheckCircle } from 'solid-icons/ai';

function MyComponent() {
  return (
    <div>
      <BiRegularHome />
      <FiUsers />
    </div>
  );
}

// BAD - Don't use emojis
function MyComponent() {
  return <span>🏠 Home</span>; // Use icon component instead
}
```

### Icon Packages

- `solid-icons/bi` - BoxIcons Regular
- `solid-icons/bx` - BoxIcons
- `solid-icons/fi` - Feather Icons
- `solid-icons/ai` - Ant Design Icons

Use the icon search MCP tool to find icons by name.

## Conditional Rendering

### Show Component

```jsx
import { Show } from 'solid-js';

<Show when={loading()} fallback={<div>Loading...</div>}>
  <Content />
</Show>

<Show when={error()}>
  <ErrorMessage error={error()} />
</Show>
```

### Switch/Match

```jsx
import { Switch, Match } from 'solid-js';

<Switch>
  <Match when={status() === 'loading'}>
    <Spinner />
  </Match>
  <Match when={status() === 'error'}>
    <ErrorMessage />
  </Match>
  <Match when={status() === 'success'}>
    <Content />
  </Match>
</Switch>
```

## Lists

### For Component

```jsx
import { For } from 'solid-js';

<For each={items()}>
  {(item, index) => (
    <ItemCard item={item} index={index()} />
  )}
</For>

// With fallback
<For each={items()} fallback={<div>No items</div>}>
  {item => <ItemCard item={item} />}
</For>
```

## Effects and Lifecycle

### createEffect

Use effects sparingly (prefer derived values with `createMemo`):

```jsx
import { createEffect, onCleanup } from 'solid-js';

function MyComponent(props) {
  createEffect(() => {
    const id = props.id();

    // Setup
    const subscription = subscribe(id);

    // Cleanup
    onCleanup(() => {
      subscription.unsubscribe();
    });
  });
}
```

### onMount / onCleanup

```jsx
import { onMount, onCleanup } from 'solid-js';

function MyComponent() {
  onMount(() => {
    // Component mounted
  });

  onCleanup(() => {
    // Component will unmount - cleanup
  });
}
```

## Error Handling in Components

### Error Boundaries

Use error boundaries for rendering errors:

```jsx
import AppErrorBoundary from '@/components/ErrorBoundary.jsx';

function App() {
  return (
    <AppErrorBoundary>
      <YourComponent />
    </AppErrorBoundary>
  );
}
```

### API Error Handling

Use `handleFetchError` for API calls:

```jsx
import { handleFetchError } from '@/lib/error-utils.js';

async function handleSubmit() {
  try {
    const response = await handleFetchError(
      fetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
      { showToast: true }
    );
    // Success
  } catch (error) {
    // Error already handled (toast shown)
  }
}
```

### Form Error Handling

Use form error signals:

```jsx
import { createFormErrorSignals } from '@/lib/form-errors.js';
import { createSignal } from 'solid-js';

function MyForm() {
  const errors = createFormErrorSignals(createSignal);

  async function handleSubmit() {
    try {
      // Submit form
    } catch (error) {
      errors.handleError(error); // Handles field-level and global errors
    }
  }

  return (
    <form>
      <input name="email" />
      {errors.fieldErrors().email && (
        <span class="error">{errors.fieldErrors().email}</span>
      )}
      {errors.globalError() && (
        <div class="error">{errors.globalError()}</div>
      )}
    </form>
  );
}
```

## Styling

Use Tailwind CSS classes (see [Style Guide](/guides/style-guide)):

```jsx
function MyComponent() {
  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 class="text-lg font-semibold text-gray-900">Title</h3>
      <p class="text-sm text-gray-600">Description</p>
    </div>
  );
}
```

## Best Practices

### DO

- Keep components lean and focused on rendering
- Move business logic to stores, primitives, or utilities
- Access props directly (never destructure)
- Use store imports instead of prop drilling
- Use import aliases
- Use Ark UI components from `@corates/ui`
- Use `solid-icons` for icons
- Handle errors appropriately
- Use Tailwind CSS for styling

### DON'T

- Don't destructure props
- Don't prop-drill application state
- Don't put business logic in components
- Don't use emojis (use icons)
- Don't import UI components from local files (use `@corates/ui`)
- Don't create "God components" that do too much
- Don't use more than 5 props (consider store or context)

## Component Examples

### Simple Component

```jsx
import { Show } from 'solid-js';
import projectStore from '@/stores/projectStore.js';

export default function ProjectList() {
  const projects = () => projectStore.getProjectList();
  const loading = () => projectStore.isProjectListLoading();

  return (
    <div class="space-y-4">
      <Show when={loading()} fallback={<div>Loading...</div>}>
        <For each={projects()}>
          {project => <ProjectCard project={project} />}
        </For>
      </Show>
    </div>
  );
}
```

### Form Component

```jsx
import { createSignal } from 'solid-js';
import { createFormErrorSignals } from '@/lib/form-errors.js';
import { handleFetchError } from '@/lib/error-utils.js';
import projectActionsStore from '@/stores/projectActionsStore';

export default function CreateProjectForm(props) {
  const [name, setName] = createSignal('');
  const errors = createFormErrorSignals(createSignal);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      await projectActionsStore.createProject({
        name: name(),
      });
      props.onSuccess?.();
    } catch (error) {
      errors.handleError(error);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={name()}
        onInput={(e) => setName(e.target.value)}
        class="border rounded px-3 py-2"
      />
      {errors.fieldErrors().name && (
        <span class="text-red-600">{errors.fieldErrors().name}</span>
      )}
      <button type="submit">Create</button>
    </form>
  );
}
```

## Related Guides

- [State Management Guide](/guides/state-management) - For store patterns
- [Primitives Guide](/guides/primitives) - For reusable logic patterns
- [Style Guide](/guides/style-guide) - For UI/UX guidelines
- [Error Handling Guide](/guides/error-handling) - For error handling patterns
