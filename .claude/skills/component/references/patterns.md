# Detailed Component Patterns

Comprehensive patterns for SolidJS components in CoRATES.

## Effects and Lifecycle

### createEffect

For side effects that run when dependencies change:

```jsx
import { createEffect, onCleanup } from 'solid-js';

// Simple effect
createEffect(() => {
  if (user()) {
    localStorage.setItem('userName', user().name);
  }
});

// Effect with cleanup
createEffect(() => {
  const handler = (e) => {
    if (!ref.contains(e.target)) {
      setOpen(false);
    }
  };

  document.addEventListener('mousedown', handler);
  onCleanup(() => document.removeEventListener('mousedown', handler));
});
```

### onMount

For one-time setup when component mounts:

```jsx
import { onMount, onCleanup } from 'solid-js';

onMount(async () => {
  await loadData();

  const interval = setInterval(refresh, 30000);
  onCleanup(() => clearInterval(interval));
});
```

### onCleanup

Always clean up subscriptions, timers, and event listeners:

```jsx
onMount(() => {
  const handleResize = () => setWidth(window.innerWidth);
  window.addEventListener('resize', handleResize);

  onCleanup(() => {
    window.removeEventListener('resize', handleResize);
  });
});
```

## Store Integration Patterns

### Reading from Stores

```jsx
import projectStore from '@/stores/projectStore.js';

function ProjectView(props) {
  // Direct store access - reactive
  const project = () => projectStore.getProject(props.projectId);
  const studies = () => projectStore.getStudies(props.projectId);
  const connected = () => projectStore.getConnectionState(props.projectId).connected;

  return (
    <Show when={connected()}>
      <h1>{project()?.meta?.title}</h1>
      <For each={studies()}>
        {study => <StudyItem study={study} />}
      </For>
    </Show>
  );
}
```

### Using Custom Hooks

```jsx
import { useProjectData } from '@primitives/useProjectData.js';

function ProjectView(props) {
  // Hook provides reactive getters
  const projectData = useProjectData(props.projectId);

  return (
    <Show when={projectData.connected()}>
      <For each={projectData.studies()}>
        {study => <StudyItem study={study} />}
      </For>
    </Show>
  );
}
```

### Store Actions

```jsx
import projectStore from '@/stores/projectStore.js';

function AddStudyButton(props) {
  const handleAdd = async () => {
    await projectStore.addStudy(props.projectId, {
      title: 'New Study',
    });
  };

  return <button onClick={handleAdd}>Add Study</button>;
}
```

## Complex State with createStore

### Nested Object State

```jsx
import { createStore, produce } from 'solid-js/store';

function FormComponent(props) {
  const [form, setForm] = createStore({
    name: '',
    email: '',
    preferences: {
      notifications: true,
      theme: 'light',
    },
  });

  // Update top-level field
  const updateName = (value) => setForm('name', value);

  // Update nested field
  const toggleNotifications = () => {
    setForm(produce(f => {
      f.preferences.notifications = !f.preferences.notifications;
    }));
  };

  // Or with path syntax
  const setTheme = (theme) => setForm('preferences', 'theme', theme);

  return (
    <form>
      <input
        value={form.name}
        onInput={(e) => updateName(e.target.value)}
      />
    </form>
  );
}
```

### Array State

```jsx
import { createStore, produce } from 'solid-js/store';

function ListComponent() {
  const [items, setItems] = createStore([]);

  // Add item
  const addItem = (item) => {
    setItems(produce(arr => {
      arr.push({ id: crypto.randomUUID(), ...item });
    }));
  };

  // Update item
  const updateItem = (id, updates) => {
    setItems(produce(arr => {
      const item = arr.find(i => i.id === id);
      if (item) Object.assign(item, updates);
    }));
  };

  // Remove item
  const removeItem = (id) => {
    setItems(items => items.filter(i => i.id !== id));
  };

  return (
    <For each={items}>
      {item => (
        <ItemRow
          item={item}
          onUpdate={(updates) => updateItem(item.id, updates)}
          onRemove={() => removeItem(item.id)}
        />
      )}
    </For>
  );
}
```

## Context Pattern

For deeply nested component communication:

```jsx
import { createContext, useContext } from 'solid-js';

// Create context with default value
export const ThemeContext = createContext({
  theme: () => 'light',
  setTheme: () => {},
});

// Provider component
function ThemeProvider(props) {
  const [theme, setTheme] = createSignal('light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {props.children}
    </ThemeContext.Provider>
  );
}

// Consumer component
function ThemedButton(props) {
  const { theme } = useContext(ThemeContext);

  return (
    <button class={theme() === 'dark' ? 'bg-gray-800' : 'bg-white'}>
      {props.children}
    </button>
  );
}
```

## Animation Patterns

### Animated Show

```jsx
function AnimatedShow(props) {
  const [shouldRender, setShouldRender] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(false);
  let timeoutId;

  const duration = () => props.duration ?? 200;

  createEffect(() => {
    if (props.when) {
      clearTimeout(timeoutId);
      setShouldRender(true);
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
      timeoutId = setTimeout(() => setShouldRender(false), duration());
    }
  });

  onCleanup(() => clearTimeout(timeoutId));

  return (
    <Show when={shouldRender()}>
      <div
        class={`transition-opacity duration-${duration()}`}
        classList={{ 'opacity-0': !isVisible(), 'opacity-100': isVisible() }}
      >
        {props.children}
      </div>
    </Show>
  );
}
```

### CSS Transitions

```jsx
function Dropdown(props) {
  return (
    <div
      class="transition-all duration-200 ease-out"
      classList={{
        'opacity-0 scale-95 pointer-events-none': !props.open,
        'opacity-100 scale-100': props.open,
      }}
    >
      {props.children}
    </div>
  );
}
```

## Error Boundary

```jsx
import { ErrorBoundary } from 'solid-js';

function App() {
  return (
    <ErrorBoundary
      fallback={(err, reset) => (
        <div class="error-container">
          <h2>Something went wrong</h2>
          <p>{err.message}</p>
          <button onClick={reset}>Try Again</button>
        </div>
      )}
    >
      <MainContent />
    </ErrorBoundary>
  );
}
```

## Refs and DOM Access

```jsx
function AutoFocusInput(props) {
  let inputRef;

  onMount(() => {
    inputRef?.focus();
  });

  return <input ref={inputRef} {...props} />;
}

// Multiple refs
function ResizablePanel() {
  let containerRef;
  let handleRef;

  onMount(() => {
    // Access both refs
  });

  return (
    <div ref={containerRef}>
      <div ref={handleRef} class="resize-handle" />
    </div>
  );
}
```

## Async Data Patterns

### With createResource

```jsx
import { createResource, Suspense } from 'solid-js';

const fetchUser = async (id) => {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
};

function UserProfile(props) {
  const [user] = createResource(() => props.userId, fetchUser);

  return (
    <Suspense fallback={<Loading />}>
      <Show when={user()}>
        <div>
          <h1>{user().name}</h1>
          <p>{user().email}</p>
        </div>
      </Show>
    </Suspense>
  );
}
```

### Manual Async with Signals

```jsx
function DataComponent(props) {
  const [data, setData] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getData(props.id);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  onMount(fetchData);

  // Refetch when id changes
  createEffect(() => {
    props.id; // Track dependency
    fetchData();
  });

  return (
    <Switch>
      <Match when={loading()}><Loading /></Match>
      <Match when={error()}><Error message={error()} /></Match>
      <Match when={data()}><Content data={data()} /></Match>
    </Switch>
  );
}
```

## Form Patterns

### Controlled Inputs

```jsx
function ContactForm() {
  const [form, setForm] = createStore({
    name: '',
    email: '',
    message: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitForm(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={form.name}
        onInput={(e) => setForm('name', e.target.value)}
        placeholder="Name"
      />
      <input
        value={form.email}
        onInput={(e) => setForm('email', e.target.value)}
        placeholder="Email"
        type="email"
      />
      <textarea
        value={form.message}
        onInput={(e) => setForm('message', e.target.value)}
        placeholder="Message"
      />
      <button type="submit">Send</button>
    </form>
  );
}
```

### Form Validation

```jsx
function ValidatedForm() {
  const [form, setForm] = createStore({ email: '', password: '' });
  const [errors, setErrors] = createStore({ email: '', password: '' });

  const validate = () => {
    let valid = true;

    if (!form.email.includes('@')) {
      setErrors('email', 'Invalid email');
      valid = false;
    } else {
      setErrors('email', '');
    }

    if (form.password.length < 8) {
      setErrors('password', 'Password must be at least 8 characters');
      valid = false;
    } else {
      setErrors('password', '');
    }

    return valid;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      // Submit form
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input
          value={form.email}
          onInput={(e) => setForm('email', e.target.value)}
        />
        <Show when={errors.email}>
          <span class="text-red-500">{errors.email}</span>
        </Show>
      </div>
      {/* ... */}
    </form>
  );
}
```

## Ark UI Component Usage

### Dialog

```jsx
import { Dialog, useConfirmDialog } from '@corates/ui';

function SettingsButton() {
  const [open, setOpen] = createSignal(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Settings</button>
      <Dialog open={open()} onOpenChange={setOpen}>
        <Dialog.Content>
          <Dialog.Title>Settings</Dialog.Title>
          <Dialog.Description>Configure your preferences</Dialog.Description>
          {/* Content */}
          <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
        </Dialog.Content>
      </Dialog>
    </>
  );
}

// Confirm dialog hook
function DeleteButton(props) {
  const confirmDialog = useConfirmDialog();

  const handleDelete = async () => {
    const confirmed = await confirmDialog.confirm({
      title: 'Delete Item?',
      message: 'This action cannot be undone.',
    });
    if (confirmed) {
      props.onDelete?.();
    }
  };

  return <button onClick={handleDelete}>Delete</button>;
}
```

### Select

```jsx
import { Select } from '@corates/ui';

function StatusSelect(props) {
  const options = [
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <Select
      value={props.value}
      onChange={props.onChange}
      options={options}
      placeholder="Select status"
    />
  );
}
```

### Tooltip

```jsx
import { Tooltip } from '@corates/ui';

function IconButton(props) {
  return (
    <Tooltip content={props.tooltip}>
      <button onClick={props.onClick}>
        {props.icon}
      </button>
    </Tooltip>
  );
}
```

### Avatar

```jsx
import { Avatar } from '@corates/ui';

function UserAvatar(props) {
  return (
    <Avatar
      src={props.user?.image}
      name={props.user?.name}
      class="h-8 w-8 rounded-full"
      fallbackClass="flex items-center justify-center bg-gray-200 text-gray-600 text-sm font-medium"
    />
  );
}
```
