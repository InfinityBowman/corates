# SSE Real-Time Sync Plan

## Overview

Implement Server-Sent Events (SSE) for real-time state synchronization while maintaining local-first offline capabilities. The goal is to ensure users always see the most up-to-date information when online, while gracefully degrading to cached data when offline.

## Current Pain Points

1. **Subscription staleness** - After Stripe checkout, user may see old plan until manual refresh
2. **Webhook race conditions** - User returns from external flow before webhook processes
3. **Cross-tab inconsistency** - Changes in one tab don't reflect in others
4. **Cache invalidation complexity** - Multiple caching layers (TanStack Query, IndexedDB) cause sync issues

## Architecture Principles

### Local-First Requirements

- Cached data available immediately on page load
- App remains functional when offline
- Subscription entitlements enforced from cached data
- Clear UI indication when using cached vs fresh data

### Real-Time Requirements

- Push updates for critical state changes (subscription, org membership)
- No polling overhead for idle users
- Automatic reconnection on network recovery
- Graceful degradation when SSE unavailable

## Proposed Architecture

**Reuse existing UserSession Durable Object** - Already has WebSocket management, internal notify endpoint, and pending notification queue for offline users.

```
                                    +------------------+
                                    |   Stripe/OAuth   |
                                    +--------+---------+
                                             |
                                             v webhook
+-------------+  WebSocket +----------------+----------------+
|   Browser   |<-----------|   Workers API  |  UserSession   |
|  (SolidJS)  |----------->|   (Hono)       |  (existing DO) |
+-------------+   fetch    +----------------+----------------+
       |                            |
       v                            v
  IndexedDB                      D1 Database
  (offline cache)               (source of truth)
```

### Existing UserSession Features (Already Implemented)

- WebSocket connection management per user
- Internal `/notify` POST endpoint for pushing events
- Pending notification queue (stored when user offline, delivered on reconnect)
- Authentication via session cookies
- Broadcast to all connected clients for same user

## Implementation Plan

### Phase 1: Event Emission from Webhooks/Actions

#### 1.1 Helper to Send Events to UserSession

Create a utility to send events to a user's UserSession DO:

```js
// packages/workers/src/lib/notify.js
export async function notifyUser(env, userId, event) {
  const id = env.USER_SESSION.idFromName(userId);
  const stub = env.USER_SESSION.get(id);
  await stub.fetch(
    new Request('https://internal/notify', {
      method: 'POST',
      body: JSON.stringify(event),
    }),
  );
}
```

#### 1.2 Emit Events from Stripe Webhooks

Update Better Auth Stripe plugin config to emit events:

```js
// In auth/config.js stripe plugin config
onSubscriptionComplete: async ({ subscription }) => {
  await notifyUser(env, subscription.referenceId, {
    type: 'subscription:updated',
    data: { tier: subscription.plan, status: subscription.status }
  });
},
onSubscriptionUpdate: async ({ subscription }) => {
  await notifyUser(env, subscription.referenceId, {
    type: 'subscription:updated',
    data: { tier: subscription.plan, status: subscription.status }
  });
},
onSubscriptionCancel: async ({ subscription }) => {
  await notifyUser(env, subscription.referenceId, {
    type: 'subscription:canceled',
    data: { tier: subscription.plan, cancelAt: subscription.cancelAt }
  });
}
```

#### 1.3 Emit Events from Org Actions

Add event emission to org membership changes in API routes.

| Event                   | Payload                       | Trigger        |
| ----------------------- | ----------------------------- | -------------- |
| `subscription:updated`  | `{ tier, status, periodEnd }` | Stripe webhook |
| `subscription:canceled` | `{ tier, cancelAt }`          | Stripe webhook |
| `org:member-added`      | `{ orgId, userId, role }`     | API action     |
| `org:member-removed`    | `{ orgId, userId }`           | API action     |
| `org:role-changed`      | `{ orgId, userId, role }`     | API action     |
| `project:shared`        | `{ projectId, orgId }`        | API action     |
| `heartbeat`             | `{ timestamp }`               | Every 30s      |

### Phase 2: Frontend Integration

#### 2.1 WebSocket Hook (or extend existing)

Check if there's already a hook connecting to UserSession, otherwise create:

```js
// packages/web/src/primitives/useNotifications.js
// Manages WebSocket connection to UserSession DO
// Handles reconnection with exponential backoff
// Dispatches events to appropriate handlers
```

#### 2.2 Query Invalidation on Events

```js
// When event received, invalidate relevant queries
ws.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (data.type === 'subscription:updated') {
    queryClient.invalidateQueries({ queryKey: ['subscription'] });
  }
});
```

#### 2.3 Optimistic + Confirmed Pattern

```js
// 1. Show optimistic update immediately
// 2. SSE confirms when backend processes
// 3. If no confirmation within timeout, refetch
```

### Phase 3: Caching Strategy Overhaul

#### 3.1 Data Classification

| Data Type       | Cache Strategy               | SSE Updates | Offline Access  |
| --------------- | ---------------------------- | ----------- | --------------- |
| Subscription    | Short stale (30s), persist   | Yes         | Yes (read-only) |
| Org members     | Medium stale (2min), persist | Yes         | Yes             |
| Projects list   | Medium stale (2min), persist | No          | Yes             |
| Project content | Yjs (existing)               | N/A         | Yes (full sync) |
| User profile    | Long stale (10min), persist  | No          | Yes             |

#### 3.2 Unified Cache Layer

Replace fragmented caching with single TanStack Query setup:

```js
// packages/web/src/lib/queryClient.js

// Critical data: short stale, SSE-invalidated
const criticalQueryDefaults = {
  staleTime: 1000 * 30, // 30 seconds
  gcTime: 1000 * 60 * 60, // 1 hour (for offline)
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
};

// Standard data: longer stale
const standardQueryDefaults = {
  staleTime: 1000 * 60 * 2, // 2 minutes
  gcTime: 1000 * 60 * 60, // 1 hour
};
```

#### 3.3 Remove Manual localStorage Caching

The `useSubscription` manual localStorage cache should be removed (already done). Rely solely on TanStack Query + IndexedDB persister.

### Phase 4: Offline Indicators

#### 4.1 Connection Status

```jsx
// Show when using cached data
<Show when={isUsingCachedData()}>
  <OfflineBanner lastSynced={lastSynced()} />
</Show>
```

#### 4.2 Sync Status

```jsx
// Show SSE connection state
<Show when={!sseConnected()}>
  <SyncIndicator status='disconnected' />
</Show>
```

## Event Flow Examples

### Subscription Upgrade Flow

```
1. User clicks "Upgrade to Pro"
2. Frontend calls POST /api/billing/checkout
3. User redirected to Stripe Checkout
4. User completes payment
5. Stripe sends webhook to /api/auth/stripe/webhook
6. Webhook handler:
   a. Updates subscription in D1
   b. Sends event to EventHub DO
7. EventHub broadcasts "subscription:updated" via SSE
8. Frontend receives SSE event
9. Frontend invalidates subscription query
10. Fresh data fetched, UI updates to Pro
11. User redirected to /settings/billing?success=true
12. Page shows success toast with correct plan
```

### Offline to Online Transition

```
1. User opens app while offline
2. TanStack Query loads from IndexedDB persister
3. UI renders with cached subscription data
4. Network becomes available
5. SSE connection established
6. Queries marked stale are refetched
7. Any missed events replayed via Last-Event-ID
8. UI updates with fresh data
9. Offline indicator hidden
```

## Technical Considerations

### Cloudflare Workers Constraints

- **No long-lived connections in Workers** - Must use Durable Objects for SSE
- **Hibernation** - DO can hibernate, need to handle reconnection
- **Costs** - DO duration billing, but SSE is lightweight

### SSE vs WebSocket

| Feature         | SSE                | WebSocket               |
| --------------- | ------------------ | ----------------------- |
| Direction       | Server to client   | Bidirectional           |
| Reconnection    | Built-in           | Manual                  |
| Browser support | Universal          | Universal               |
| Complexity      | Simple             | More complex            |
| Use case fit    | Push notifications | Real-time collaboration |

**Recommendation**: Use SSE for state sync (simpler, sufficient). Keep existing Yjs WebSocket for document collaboration.

### Security

- SSE endpoint requires valid session
- Events scoped to user's orgs only
- No sensitive data in events (just invalidation signals)
- Rate limiting on reconnection

## Migration Path

### Step 1: Infrastructure (Non-Breaking)

- Add EventHub DO
- Add SSE endpoint
- Add useSSE hook (disabled by default)

### Step 2: Subscription Sync

- Enable SSE for subscription events
- Add webhook event emission
- Test end-to-end flow

### Step 3: Org Events

- Add org membership events
- Update relevant webhooks/API handlers

### Step 4: Remove Old Caching

- Remove manual localStorage caches
- Simplify useSubscription
- Update cache configuration

## Files to Create/Modify

### New Files

- `packages/workers/src/lib/notify.js` - Helper to send events to UserSession DO
- `packages/web/src/primitives/useNotifications.js` - WebSocket hook (if not existing)
- `packages/web/src/components/common/SyncIndicator.jsx` - Connection status UI

### Modified Files

- `packages/workers/src/auth/config.js` - Add Stripe webhook event emission
- `packages/workers/src/routes/org/*.js` - Add org action event emission
- `packages/web/src/lib/queryClient.js` - Adjust cache settings
- `packages/web/src/primitives/useSubscription.js` - Integrate with notifications
- `packages/web/src/App.jsx` - Add notifications provider/connection

## Success Metrics

1. **Subscription updates visible within 2s of webhook** (vs current manual refresh)
2. **Zero reported "wrong plan displayed" issues**
3. **Offline functionality unchanged**
4. **Cross-tab consistency** within 1s

## Open Questions

1. Should we replay missed events on reconnection, or just invalidate all critical queries?
2. Do we need SSE for project-level events (collaborator added, etc.)?
3. Should heartbeat interval be configurable?

## Timeline Estimate

Since we're reusing existing UserSession DO infrastructure:

- Phase 1 (Event Emission): 2-3 hours
- Phase 2 (Frontend Integration): 2-3 hours
- Phase 3 (Caching Overhaul): 2-3 hours
- Phase 4 (Offline Indicators): 1-2 hours
- Testing & Polish: 2-3 hours

**Total: ~10-14 hours** (reduced from 15-20 by reusing UserSession)
