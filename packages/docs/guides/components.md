# Component Development Guide

Components in CoRATES are React 19 function components, written in TypeScript, and use TanStack Router for navigation, Zustand for shared client state, and shadcn/ui primitives (under `@/components/ui/`).

## Structure

A typical component lives under `packages/web/src/components/<feature>/` and imports via the `@/` path alias (`@/*` -> `packages/web/src/*`). There is only one alias -- no per-feature aliases.

```tsx
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { FolderIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useOrgs } from '@/hooks/useOrgs';
import { handleError } from '@/lib/error-utils';

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectModal({ open, onOpenChange }: CreateProjectModalProps) {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const { orgs } = useOrgs();
  // ...
}
```

Export components as **named exports**. Default exports are reserved for route modules (`createFileRoute`) and a few legacy files.

## Feature folders

`packages/web/src/components/` is organized by feature, not by component type:

```
components/
  admin/
  auth/
  billing/
  charts/
  checklist/
  dashboard/
  layout/
  org/
  pdf/
  project/
  resources/
  settings/
  ui/           <- shadcn/ui primitives
```

Keep related components, hooks, and helpers colocated inside the feature folder. Only components used across features belong higher up in the tree.

## Props

Props are plain destructured parameters, typed with an inline or colocated interface. There is no reactivity concern -- destructure freely, this is React 19, not SolidJS.

```tsx
interface ProjectCardProps {
  projectId: string;
  showActions?: boolean;
  onSelect?: (id: string) => void;
}

export function ProjectCard({ projectId, showActions = true, onSelect }: ProjectCardProps) {
  // ...
}
```

For handler props, prefix underscore-ignored parameters with `_` to satisfy `noUnusedParameters`:

```tsx
onOpenChange: (_open: boolean) => void;
```

## Reading state

Read Zustand stores via selector functions. Subscribe to one slice per call:

```tsx
import { useAuthStore } from '@/stores/authStore';

const signin = useAuthStore(s => s.signin);
const authError = useAuthStore(s => s.authError);
```

Read server state via TanStack Query hooks, usually wrapped in a feature hook (`useOrgs`, `useProjectList`, etc.) under `@/hooks/` or inside the feature folder.

```tsx
const { data: orgs, isLoading } = useOrgs();
```

Do not prop-drill shared state. Import the store or hook where you need it.

## Derived values and callbacks

Use `useMemo` for non-trivial derived values, `useCallback` for callbacks passed to memoized children or used in effect dependency lists.

```tsx
const resolvedOrgId = useMemo(() => {
  if (orgs.length === 1) return orgs[0].id;
  return selectedOrgId;
}, [orgs, selectedOrgId]);
```

For trivial expressions, an inline calculation is clearer than a memo.

## Effects

Use `useEffect` with an explicit dependency array. Never omit the array.

```tsx
useEffect(() => {
  if (orgs.length > 1 && !selectedOrgId) {
    setSelectedOrgId(orgs[0].id);
  }
}, [orgs, selectedOrgId]);
```

Use `useLayoutEffect` only when a DOM measurement must happen before paint. Use `useSyncExternalStore` when subscribing to a non-React external source (e.g. Yjs awareness); never wrap `useState` + `useEffect` to emulate it.

## Icons

Use `lucide-react` exclusively. No emoji, no unicode symbols, anywhere.

```tsx
import { FolderIcon, PlusIcon, TriangleAlertIcon } from 'lucide-react';

<Button>
  <PlusIcon className="size-4" />
  New project
</Button>
```

For icons lucide doesn't provide, inline an SVG component.

## UI primitives

Use shadcn/ui components from `@/components/ui/`. They are first-party -- copy-pasted into the repo, not imported from an external package.

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showToast } from '@/components/ui/toast';
```

Do not import UI from external packages (no Ark UI, no Radix directly -- shadcn wraps Radix internally).

## Styling

Tailwind CSS for everything. Use `className`, not `class`.

```tsx
<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
  <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
</div>
```

shadcn components accept `className` and merge it correctly via `cn()` (from `@/lib/utils`).

## Error handling

For API calls, use the shared error helpers from `@/lib/error-utils` and `@/lib/form-errors`. They understand the `@corates/shared` domain error schema.

```tsx
import { handleError, isErrorCode, getDomainError } from '@/lib/error-utils';
import { AUTH_ERRORS } from '@corates/shared';

async function handleSubmit() {
  setIsSubmitting(true);
  try {
    const res = await fetch('/api/projects', { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) throw await getDomainError(res);
    // ...
  } catch (err) {
    if (isErrorCode(err, AUTH_ERRORS.UNAUTHORIZED)) {
      navigate({ to: '/signin' });
      return;
    }
    handleError(err, { showToast: true });
  } finally {
    setIsSubmitting(false);
  }
}
```

For forms with field-level validation errors, use `createFormErrorState` / `handleFormError` from `@/lib/form-errors`.

For render-time errors, wrap at route boundaries with an error boundary component; routes can also declare an `errorComponent` in `createFileRoute`.

## Unique IDs

Use `useId()` for form element IDs (radio buttons, checkboxes, label-input pairs). Don't hand-generate them.

```tsx
const id = useId();
return (
  <>
    <label htmlFor={id}>Email</label>
    <input id={id} type="email" />
  </>
);
```

## What does not belong in a component

- Fetch/mutation logic -- move to a TanStack Query hook or a Zustand action.
- localStorage access without a `typeof window !== 'undefined'` guard -- breaks SSR.
- Direct Yjs document writes -- go through the project store or a sync helper.
- Global side effects at module scope. A component file that is imported should have no observable effect until the component is rendered.

## Don'ts

- Don't default-export non-route components.
- Don't use `class=` (SolidJS holdover) -- it's `className`.
- Don't import UI primitives from external packages.
- Don't add emoji or unicode symbols anywhere.
- Don't omit the `useEffect` dependency array.
- Don't prop-drill shared state; import the store/hook directly.
