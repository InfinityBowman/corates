# Plan: Notification Center

**Status:** In Review (Phases 0 to 2 in #629, Phase 3 tracked in #628)
**Created:** 2026-09-01
**Last Updated:** 2026-09-05

---

## Overview

Events that involve a user (invitations, membership changes, project deletion) reach them today only through transactional email or a transient WebSocket push that the client mostly drops. There is no persistent place in the app to see what needs their attention. This plan adds per-user persisted notifications backed by D1, live delivery through the existing `USER_SESSION` Durable Object, and a bell entry point in the navbar.

Tracking issue: #580.

## Prerequisites

- Invite anchoring (#581, merged 2026-09-01): every add is an invitation, and the invitation token is the access capability. A "you were invited" notification can therefore link straight to `/invite/$token`, which already handles every invitation state.

## What exists today

- **Transport is complete.** `packages/workers/src/durable-objects/UserSession.ts` accepts any `{ type: string, ...payload }` in `notify()`, broadcasts to open sockets, and queues up to 50 undelivered items in DO storage, flushed on the next connect. The client hook `packages/web/src/hooks/useNotifications.ts` reconnects with backoff and keepalive. `useMembershipSync` (mounted in `AppLayout`) is the only consumer and uses events purely as TanStack Query cache-invalidation triggers.
- **Nothing above transport exists.** No table, no read state, no store, no query keys, no UI. `user.preferences` is declared but never read; `PreferencesSettings.tsx` is a disabled stub.
- **Event types are uncoordinated.** `packages/workers/src/commands/lib/notifications.ts` (`NotificationTypes`) and `packages/workers/src/lib/notify.ts` (`EventTypes`) declare disjoint const maps; `acceptInvitation.ts` sends a raw `'project-invite'` literal. The client handles `project-invite` and `project-deleted` nowhere, so both are silently dropped. `EventTypes.ORG_MEMBER_*` and `PROJECT_SHARED/UNSHARED` are declared but never emitted.
- **The inviter is never told an invitation was accepted**, although `project_invitations.invitedBy` is available.
- **Reviewer assignment has no server hook.** `assignedTo` is a client-side CRDT mutation (`packages/shared/src/sync/mutators.ts`) that the workspace DO only verifies. Nothing in `packages/workers/src/commands/` runs when it changes.

## Goals

1. A user can open a bell in the navbar and see the notifications addressed to them, with an unread count, persisted across sessions and devices.
2. New notifications appear live without a refresh when the user is online, and are waiting in the list when they come back.
3. The inviter learns when an invitation is accepted; an invitee with an existing account sees the invitation in-app and can act on it from there.
4. One typed union of push event types shared by server and client, so no event is dropped by accident again.

## Non-Goals

- Email digests, per-type email preferences, or unsubscribe. `PreferencesSettings.tsx` stays "Coming soon".
- A dedicated `/notifications` route or infinite-scroll history. The popover shows the most recent page; that is enough for the volume this app produces.
- Comments or @mentions (no such feature exists).
- Notifying the accepting user that they accepted (they just clicked the button; the invite page already toasts).
- Reviewer-assignment notifications in the first release (see Phase 3).

## Design decisions

### Events vs notifications

The existing pushes (`subscription:updated`, `project-membership-*`, etc.) are **events**: ephemeral signals whose only job is cache invalidation. They stay exactly as they are and are not persisted.

A **notification** is a D1 row addressed to one user. Creating one also pushes a single new event type, `notification:new`, carrying the row, so the client can prepend it without a refetch. D1 is the source of truth; on connect the client refetches from D1, so the DO's pending queue is irrelevant for this type (it stays for the ephemeral events).

### Store data, render copy on the client

A row stores `type` plus a small JSON `data` payload (ids and display names captured at creation time). The client owns a `type -> { title, actor, action, icon, destructive, href }` renderer map. Copy changes never touch rows, and the row never needs updating when the referenced thing changes state.

### Invitations link to the invite page

`invitation.received` links to `/invite/$token`. That page already renders pending, expired, accepted, and cancelled states, so the notification does not need to track invitation status. Accept happens there or from the dashboard ghost card, which is also where the invitee can decline (Phase 2).

### Server state lives in TanStack Query

Notifications are server state, so they use query keys and `useQuery`, not a Zustand store. The push handler does `setQueryData` to prepend and bumps the unread-count query. Reconnect invalidates both keys.

### Retention is lazy

On insert, delete the user's rows beyond the newest 200. No cron, no scheduled worker.

## Implementation

### Phase 0: One typed event union

Small and mechanical, and it fixes the dropped-event bug on its own.

**Tasks:**

- [x] Add `packages/shared/src/notifications.ts` exporting a `UserSessionEvent` discriminated union covering every type actually emitted today plus `notification:new`. The never-emitted constants (`ORG_MEMBER_*`, `PROJECT_SHARED/UNSHARED`) were removed.
- [x] Make `commands/lib/notifications.ts`, `lib/notify.ts`, and `acceptInvitation.ts` use the union instead of local const maps and literals. `EventTypes` survives with only the two subscription entries because `admin-orgs.server.ts` and its tests reference it.
- [x] Make `useMembershipSync` switch over the union with `assertNever`. Handles `project-deleted` (invalidate project lists); the accepter-side `project-invite` push is gone.

### Phase 1: Persisted notifications, two event types, navbar bell

Implemented. Migration `0008_notifications.sql`; `createdAt` and `readAt` are millisecond timestamps. The list server function returns `{ items, nextCursor }`. Live updates and reconnect refetch live in `useMembershipSync`; the bell fetches the unread count eagerly and the list only when opened.

**Schema** (`packages/db/src/schema.ts`, migration via DrizzleKit):

```ts
notifications: {
  id: text primary key
  userId: text references user.id on delete cascade
  type: text                       // 'invitation.received' | 'invitation.accepted' | ...
  data: text                       // JSON, shape depends on type
  readAt: integer (timestamp) null
  createdAt: integer (timestamp)
}
index (userId, createdAt desc)
index (userId, readAt)             // unread count
```

**Command** `packages/workers/src/commands/notifications/createNotification.ts`:

1. Insert the row.
2. Trim the user to the newest 200 rows.
3. Push `{ type: 'notification:new', notification: row }` through `USER_SESSION`, best-effort, wrapped in `captureError` like every existing push.

**Server functions** `packages/web/src/server/functions/notifications.server.ts`, all scoped to the session user (no userId parameter is ever accepted from the client):

- `listNotifications({ limit = 20, before? })` returns rows newest first with cursor pagination on `(createdAt, id)`.
- `getUnreadCount()`.
- `markRead({ ids })`.
- `markAllRead()`.

**Emitters:**

- `invitation.accepted` from `acceptInvitation.ts`, addressed to `invitation.invitedBy`. Data: `{ projectId, projectName, acceptedByName, acceptedByEmail }`. Href: project overview tab.
- `invitation.received` from `createInvitation.ts`, addressed to the user whose email equals the normalized invited email, if one exists. Data: `{ invitationId, token, projectId, projectName, inviterName, role }`. Href: `/invite/$token`. Emitted on resend too, since the token may have rotated.

**Client:**

- `queryKeys.notifications.list` and `queryKeys.notifications.unreadCount`.
- `packages/web/src/components/layout/NotificationBell.tsx`: `BellIcon` button with an unread badge, placed in `AppNavbar` between the Dashboard link and the Admin link. Opens a shadcn `Popover` listing the most recent page, each item rendered by the type map, with "Mark all as read". Clicking an item marks it read and navigates to its href.
- `packages/web/src/components/notifications/renderers.ts`: the `type -> renderer` map. Unknown types render a generic fallback rather than crashing, so a server ahead of a cached client degrades gracefully.
- `useMembershipSync` handles `notification:new` by prepending to the list query and incrementing the unread count; reconnect invalidates both.

**Tests:**

- Command unit test: inserts, trims beyond 200, pushes `notification:new`.
- Server function tests: list is scoped to the session user; `markRead` on another user's ids is a no-op; cursor pagination.
- e2e extension of `invitation-flow.spec.ts`: inviter's badge shows 1 after the invitee accepts in a second context, popover lists the acceptance, mark-all-read clears the badge.

### Phase 2: Remaining membership events and the dashboard card

Implemented. Both project payloads carry `actorName`, looked up from the `user` table by the command (`commands/lib/displayName.ts`, same precedence as invitation emails), because the row copy reads "Otto removed you from the project" and the callers only pass an actor id.

**Tasks:**

- [x] `project.removed` from `removeMember.ts` (not on self-removal) and `project.deleted` from `deleteProject.ts` (all members except the actor). Each is a one-call addition next to the existing event push, covered by command tests.
- [x] Pending invitations as ghost cards in the dashboard projects grid (`InvitationCard`): pending, unexpired `project_invitations` whose email matches the signed-in user, each with Accept and Decline. Served by `listMyPendingInvitations`, keyed on `queryKeys.invitations.pendingForMe`, invalidated when an `invitation.received` push arrives and after an accept on the invite page. This is a plain invitations query, not a notification, and it covers the case where the account was created after the invitation was sent (so no `invitation.received` row exists). The existing-user invitation e2e accepts from the card.
- [x] Invitee-side decline (`declineInvitation`): deletes the row, like the inviter's cancel, scoped to the session email. Acts immediately with a toast, no confirmation. The inviter is not notified, so a stranger's invitation gives them no signal about the account.
- [x] Popover redesign after manual testing. Each row is object first, actor second: line one is the project name, line two is "Actor did what", with the actor's initials as an avatar and a small type glyph pinned to its corner (`NotificationRow`). Unread is a dot plus medium weight rather than a tint. Hovering or focusing a row swaps the timestamp for mark-read and dismiss; dismiss (`dismissNotification`) deletes the row for the session user. The header carries the unread count, an All / Unread filter, and mark-all-read as an icon button. No keyboard shortcuts; researchers are not shortcut users.

### Phase 3: Reviewer assignment (split out to #628)

Assignment changes flow through the sync engine, not commands, and the engine has no post-commit seam today. #628 adds an `onMutationCommitted` hook to `@cf-sync/server` that receives the principal and each written row with its previous value; the workspace DO uses it to emit `checklist.assigned` through `createNotification` unchanged.

Also a candidate for this phase: admin announcements. There is no broadcast today; an `announcement` type with an admin-only server function that fans out one row per user would reuse `createNotification` and the renderer map as they are.

## Technical Details

- No breaking changes: one new table, one new event type. Existing events and their client handling are untouched apart from the Phase 0 type tightening.
- `createNotification` must never throw into its caller. Notification creation is a side effect of a membership action that has already committed.
- The `invitation.received` lookup uses the normalized email. Under invite anchoring the account may live at a different address; that case is covered by email and by the Phase 2 dashboard card, not by a notification.
- Rows are keyed on `(userId, createdAt desc)`; the popover fetches 20 and there is no infinite scroll in this release.

## Success Criteria

- [x] Inviter sees an in-app notification, live, when an invitation is accepted (unit, server function, and e2e coverage).
- [x] An existing user who is invited sees the invitation in the bell and can accept from there.
- [x] Unread count and read state persist across reload and across devices.
- [x] No push event type is unhandled on the client; the union is the single source of truth.
- [x] `packages/docs/architecture/diagrams/02-system-architecture.md` "UserSession Notification Flow" updated to show persistence. `07-api-actions.md` has no invitation flows, so nothing there conflicts.
- [ ] No regressions in existing membership event handling.

## Decisions

- Dashboard surface: pending invitations render as ghost cards inside the projects grid rather than a separate section (Phase 2); no recent-notifications feed.
- Rows for accepted, declined, or cancelled invitations stay in the list until dismissed or trimmed; the invite page shows the final state on click. Dismiss is the per-row escape hatch.
- Retention: 200 rows per user, trimmed on insert (`MAX_NOTIFICATIONS_PER_USER`).
- No unread-count polling; every socket (re)connect invalidates the notification queries.

## Related Documents

- Issue #580 (this plan), #581 (invite anchoring, merged), #628 (Phase 3), PR #629
- [System architecture](/architecture/diagrams/02-system-architecture)
- [API actions](/architecture/diagrams/07-api-actions)
- [Organizations guide](/guides/organizations)
