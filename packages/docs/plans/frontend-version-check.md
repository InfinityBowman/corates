# Frontend Version Check and Update Prompt

## Overview

Detect when the deployed frontend version differs from the user's loaded version and prompt them to refresh, preventing stale client issues and API mismatches.

## Problem

1. User loads app (bundles cached in browser)
2. New version deployed to Cloudflare
3. User continues using stale frontend
4. API calls may fail or return unexpected shapes
5. New features/fixes not available to user

## Solution

Embed a build version in both frontend and backend. Check version on API responses and prompt user to refresh when mismatch detected.

## Implementation

### 1. Generate Build Version

Add version generation to the build process:

```typescript
// packages/web/scripts/generate-version.js
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

const version = {
  hash: execSync('git rev-parse --short HEAD').toString().trim(),
  timestamp: Date.now(),
};

writeFileSync('src/generated/version.ts', `export const BUILD_VERSION = ${JSON.stringify(version)};`);
```

Update build script:

```json
// packages/web/package.json
{
  "scripts": {
    "build": "node scripts/generate-version.js && vinxi build"
  }
}
```

### 2. Backend Version Header

Add version to all API responses:

```typescript
// packages/workers/src/middleware/version.ts
import type { MiddlewareHandler } from 'hono';

// Injected at build time via wrangler.jsonc or build script
declare const BUILD_VERSION: string;

export const versionHeader: MiddlewareHandler = async (c, next) => {
  await next();
  c.header('X-App-Version', BUILD_VERSION);
};
```

Apply to app:

```typescript
// packages/workers/src/index.ts
import { versionHeader } from './middleware/version';

app.use('*', versionHeader);
```

Configure in wrangler:

```jsonc
// packages/workers/wrangler.jsonc
{
  "define": {
    "BUILD_VERSION": "\"${CF_PAGES_COMMIT_SHA:0:7}\"",
  },
}
```

### 3. Frontend Version Store

```typescript
// packages/web/src/stores/versionStore.ts
import { createSignal } from 'solid-js';
import { BUILD_VERSION } from '@/generated/version';

const [serverVersion, setServerVersion] = createSignal<string | null>(null);
const [updateAvailable, setUpdateAvailable] = createSignal(false);
const [dismissed, setDismissed] = createSignal(false);

export function checkVersion(responseHeaders: Headers) {
  const version = responseHeaders.get('X-App-Version');
  if (!version) return;

  setServerVersion(version);

  if (version !== BUILD_VERSION.hash && !dismissed()) {
    setUpdateAvailable(true);
  }
}

export function dismissUpdate() {
  setDismissed(true);
  setUpdateAvailable(false);
}

export function applyUpdate() {
  window.location.reload();
}

export { updateAvailable, serverVersion, BUILD_VERSION };
```

### 4. Integrate with API Client

```typescript
// packages/web/src/lib/api.ts
import { checkVersion } from '@/stores/versionStore';

export async function apiFetch(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
  });

  // Check version on every response
  checkVersion(response.headers);

  return response;
}
```

### 5. Update Banner Component

```tsx
// packages/web/src/components/UpdateBanner.tsx
import { Show } from 'solid-js';
import { updateAvailable, applyUpdate, dismissUpdate } from '@/stores/versionStore';

export function UpdateBanner() {
  return (
    <Show when={updateAvailable()}>
      <div class='fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg bg-blue-600 px-4 py-3 text-white shadow-lg'>
        <span class='text-sm'>A new version is available</span>
        <button
          onClick={applyUpdate}
          class='rounded bg-white px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50'
        >
          Refresh
        </button>
        <button onClick={dismissUpdate} class='text-blue-200 hover:text-white' aria-label='Dismiss'>
          <svg class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
          </svg>
        </button>
      </div>
    </Show>
  );
}
```

### 6. Add to App Layout

```tsx
// packages/web/src/app.tsx (or root layout)
import { UpdateBanner } from '@/components/UpdateBanner';

export default function App() {
  return (
    <>
      {/* ... existing app content */}
      <UpdateBanner />
    </>
  );
}
```

## Behavior

| Scenario            | Action                    |
| ------------------- | ------------------------- |
| Versions match      | Nothing shown             |
| Version mismatch    | Banner appears            |
| User clicks Refresh | Page reloads              |
| User dismisses      | Banner hidden for session |
| User navigates      | Banner stays dismissed    |
| New tab/refresh     | Check happens fresh       |

## Optional Enhancements

### Periodic Background Check

Poll for version without user action:

```typescript
// packages/web/src/lib/versionPoller.ts
import { checkVersion } from '@/stores/versionStore';

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function startVersionPolling() {
  setInterval(async () => {
    try {
      const response = await fetch('/api/health', { method: 'HEAD' });
      checkVersion(response.headers);
    } catch {
      // Ignore network errors
    }
  }, POLL_INTERVAL);
}
```

### Force Update for Critical Changes

For breaking API changes, force refresh instead of prompting:

```typescript
// Backend adds header for breaking changes
c.header('X-App-Version', BUILD_VERSION);
c.header('X-Force-Update', 'true'); // Only on breaking deploys

// Frontend checks
export function checkVersion(responseHeaders: Headers) {
  const forceUpdate = responseHeaders.get('X-Force-Update');
  if (forceUpdate === 'true') {
    window.location.reload();
    return;
  }
  // ... normal check
}
```

### Version in Error Reporting

Include versions in error reports for debugging:

```typescript
// When logging errors
console.error('API Error', {
  clientVersion: BUILD_VERSION.hash,
  serverVersion: serverVersion(),
  versionMismatch: BUILD_VERSION.hash !== serverVersion(),
  // ... other error details
});
```

## Files to Create/Modify

**New files:**

- `packages/web/scripts/generate-version.js`
- `packages/web/src/generated/version.ts` (generated)
- `packages/web/src/stores/versionStore.ts`
- `packages/web/src/components/UpdateBanner.tsx`
- `packages/workers/src/middleware/version.ts`

**Modified files:**

- `packages/web/package.json` (build script)
- `packages/web/src/lib/api.ts` (or wherever fetch wrapper lives)
- `packages/web/src/app.tsx` (add banner)
- `packages/workers/src/index.ts` (add middleware)
- `packages/workers/wrangler.jsonc` (define BUILD_VERSION)

## Testing

1. Build with version A, load app
2. Change code, build with version B
3. Make API request from stale tab
4. Verify banner appears
5. Click refresh, verify new version loads
6. Dismiss, verify banner stays hidden
7. New tab, verify fresh check

## Rollout

1. Add version middleware to backend (returns header)
2. Add version generation to frontend build
3. Add version store and banner component
4. Update fetch wrapper to check versions
5. Test in staging with simulated version mismatch
6. Deploy to production
