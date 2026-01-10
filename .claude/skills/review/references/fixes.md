# Common Fixes

Before and after examples for common anti-patterns.

---

## SolidJS Fixes

### Fix: Prop Destructuring

**Before (broken reactivity):**

```jsx
function UserCard({ user, onSelect, showAvatar }) {
  return (
    <div onClick={() => onSelect(user.id)}>
      {showAvatar && <Avatar src={user.image} />}
      <span>{user.name}</span>
    </div>
  );
}
```

**After:**

```jsx
function UserCard(props) {
  return (
    <div onClick={() => props.onSelect?.(props.user?.id)}>
      <Show when={props.showAvatar}>
        <Avatar src={props.user?.image} />
      </Show>
      <span>{props.user?.name}</span>
    </div>
  );
}
```

---

### Fix: Prop Drilling

**Before (drilling shared state):**

```jsx
// Parent.jsx
function Parent() {
  const projects = useProjects();
  const user = useUser();

  return (
    <Layout user={user}>
      <Sidebar projects={projects} user={user} />
      <Content projects={projects} user={user} />
    </Layout>
  );
}

// Sidebar.jsx
function Sidebar({ projects, user }) {
  return (
    <div>
      <UserInfo user={user} />
      <ProjectList projects={projects} />
    </div>
  );
}
```

**After:**

```jsx
// Parent.jsx
function Parent() {
  return (
    <Layout>
      <Sidebar />
      <Content />
    </Layout>
  );
}

// Sidebar.jsx
import projectStore from '@/stores/projectStore.js';
import { user } from '@/stores/authStore.js';

function Sidebar() {
  const projects = () => projectStore.getProjects();

  return (
    <div>
      <UserInfo />
      <ProjectList />
    </div>
  );
}
```

---

### Fix: Wrong Ark UI Import

**Before:**

```jsx
import { Dialog } from '@/components/ark/Dialog.jsx';
import { Select } from '~/components/Select';
import { Tooltip } from '../../../components/Tooltip';
```

**After:**

```jsx
import { Dialog, Select, Tooltip } from '@corates/ui';
```

---

### Fix: Missing Effect Cleanup

**Before:**

```jsx
function Component() {
  const [width, setWidth] = createSignal(window.innerWidth);

  onMount(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);

    const interval = setInterval(() => {
      fetchData();
    }, 5000);
  });

  return <div>Width: {width()}</div>;
}
```

**After:**

```jsx
function Component() {
  const [width, setWidth] = createSignal(window.innerWidth);

  onMount(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);

    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
    });
  });

  return <div>Width: {width()}</div>;
}
```

---

### Fix: Derived Value Without Memo

**Before:**

```jsx
function Stats(props) {
  // Recomputes on every render
  const percentage = (props.completed / props.total) * 100;
  const isComplete = percentage === 100;

  return <span>{percentage}%</span>;
}
```

**After:**

```jsx
function Stats(props) {
  const stats = createMemo(() => {
    const total = props.total ?? 0;
    const completed = props.completed ?? 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { percentage, isComplete: percentage === 100 };
  });

  return <span>{stats().percentage}%</span>;
}
```

---

## API Route Fixes

### Fix: Missing Validation

**Before:**

```javascript
routes.post('/', requireAuth, async c => {
  const body = await c.req.json();
  const { name, email } = body; // Unvalidated!

  await db.insert(users).values({ name, email });
  return c.json({ success: true });
});
```

**After:**

```javascript
// In config/validation.js
export const userSchemas = {
  create: z.object({
    name: z
      .string()
      .min(1)
      .max(255)
      .transform(val => val.trim()),
    email: z.string().email(),
  }),
};

// In routes
routes.post('/', requireAuth, validateRequest(userSchemas.create), async c => {
  const { name, email } = c.get('validatedBody');

  await db.insert(users).values({ name, email });
  return c.json({ success: true });
});
```

---

### Fix: Raw Error Objects

**Before:**

```javascript
routes.get('/:id', async c => {
  const id = c.req.param('id');
  const item = await db.select().from(items).where(eq(items.id, id)).get();

  if (!item) {
    return c.json({ error: 'Item not found' }, 404);
  }

  return c.json(item);
});
```

**After:**

```javascript
import { createDomainError, ITEM_ERRORS, SYSTEM_ERRORS } from '@corates/shared';

routes.get('/:id', async c => {
  const id = c.req.param('id');

  try {
    const item = await db.select().from(items).where(eq(items.id, id)).get();

    if (!item) {
      const error = createDomainError(ITEM_ERRORS.NOT_FOUND, { id });
      return c.json(error, error.statusCode);
    }

    return c.json(item);
  } catch (error) {
    console.error('Error fetching item:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_item',
    });
    return c.json(dbError, dbError.statusCode);
  }
});
```

---

### Fix: Direct Context Access

**Before:**

```javascript
routes.get('/me', async c => {
  const user = c.get('user');
  const session = c.get('session');
  const orgId = c.get('orgId');

  // ...
});
```

**After:**

```javascript
import { getAuth } from '@/middleware/auth.js';
import { getOrgContext } from '@/middleware/requireOrg.js';

routes.get('/me', async c => {
  const { user, session } = getAuth(c);
  const { orgId, orgRole } = getOrgContext(c);

  // ...
});
```

---

### Fix: Missing Auth Middleware

**Before:**

```javascript
const userRoutes = new Hono();

userRoutes.get('/profile', async c => {
  const user = c.get('user'); // Could be null!
  return c.json(user);
});
```

**After:**

```javascript
const userRoutes = new Hono();

// Apply to all routes in this router
userRoutes.use('*', requireAuth);

userRoutes.get('/profile', async c => {
  const { user } = getAuth(c); // Guaranteed to exist
  return c.json(user);
});
```

---

## General Fixes

### Fix: Emojis in Code

**Before:**

```javascript
// ✅ User authentication complete
const STATUS_COMPLETE = '✓';
const STATUS_ERROR = '❌';

console.log('🚀 Server starting...');
```

**After:**

```javascript
// User authentication complete
import { FiCheck, FiX } from 'solid-icons/fi';

// Use icons in JSX
<FiCheck class="text-green-500" />
<FiX class="text-red-500" />

console.log('Server starting...');
```

---

### Fix: Deep Relative Imports

**Before:**

```javascript
import { helper } from '../../../lib/utils.js';
import Component from '../../components/shared/Component.jsx';
import store from '../../../stores/projectStore.js';
```

**After:**

```javascript
import { helper } from '@lib/utils.js';
import Component from '@components/shared/Component.jsx';
import store from '@/stores/projectStore.js';
```

---

### Fix: Narrating Comments

**Before:**

```javascript
// Get the user from the database
const user = await db.select().from(users).where(eq(users.id, id)).get();

// Check if user exists
if (!user) {
  // Return 404 error
  return c.json({ error: 'Not found' }, 404);
}

// Increment the login count
user.loginCount += 1;
```

**After:**

```javascript
const user = await db.select().from(users).where(eq(users.id, id)).get();

if (!user) {
  const error = createDomainError(USER_ERRORS.NOT_FOUND, { id });
  return c.json(error, error.statusCode);
}

// Track login frequency for rate limiting decisions
user.loginCount += 1;
```

---

### Fix: Over-Engineering

**Before:**

```javascript
// Unused feature flag
const ENABLE_NEW_AUTH = process.env.ENABLE_NEW_AUTH ?? false;

// Single-use helper
function formatUserName(user) {
  return user.name.trim();
}

// Backwards compat re-export
export { oldFunction as newFunction };

// Old implementation, now removed
// function legacyAuth() { ... }
```

**After:**

```javascript
// Just use the value directly
const userName = user.name.trim();

// Remove unused exports and dead code entirely
```

---

## Quick Reference Table

| Anti-Pattern       | Detection                          | Fix                       |
| ------------------ | ---------------------------------- | ------------------------- |
| Prop destructuring | `function Comp({ x })`             | `function Comp(props)`    |
| Prop drilling      | 5+ props, passing stores           | Import stores directly    |
| Wrong Ark import   | `from '@/components/ark'`          | `from '@corates/ui'`      |
| Missing cleanup    | addEventListener without onCleanup | Add onCleanup             |
| Missing validation | `c.req.json()` in handler          | Use `validateRequest()`   |
| Raw error          | `{ error: 'msg' }`                 | `createDomainError()`     |
| Direct context     | `c.get('user')`                    | `getAuth(c)`              |
| Emoji              | Any emoji character                | Remove or use solid-icons |
| Deep relative      | `../../../`                        | `@/` or `@components/`    |
