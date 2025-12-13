# Presence Plan (Project WebSocket)

## Goals

- Show who is in a project and on which screen; optionally show live cursors.
- Reuse the existing project WebSocket (ProjectDoc DO) to avoid extra sockets.
- Keep payloads compact and server-derived identity; support reconnect/idle cleanup.

## Current context

- Project WebSocket lives in `packages/workers/src/durable-objects/ProjectDoc.js` and is already auth-gated via `verifyAuth` and membership check.
- Front-end project wire-up is in `packages/web/src/primitives/useProject.js` with Y.js syncing and connection state via `projectStore`.
- Notifications use a separate WebSocket (`useNotifications`), but presence should stay on the project channel.

## Message contract (add to existing WS)

- `presence:join` { screenId, cursor?: { x, y, vw, vh } }
- `presence:screen` { screenId } // screen change without reconnect
- `presence:state` { roster: [ { userId, displayName, avatar, screenId, cursor?, lastSeenAt, status } ] }
- `presence:cursor` { screenId, cursor: { x, y, vw, vh }, ts }
- `presence:leave` { screenId }
- `presence:ping`/`presence:pong` for liveness (or reuse existing heartbeat interval)

## Server changes (ProjectDoc DO)

- Track connections in-memory: map of conn -> { user, screenId, lastSeenAt, cursor? }.
- On WS open: after auth+membership, require `presence:join` from client; then broadcast `presence:state` to room (screenId) and `presence:join` delta to others.
- Screen scoping: treat `screenId` as a sub-room under the project; broadcast only to peers on the same screen when possible; still emit project-wide events if desired (optional).
- Heartbeats: accept `presence:ping` or reuse WS ping; mark idle if no message for ~45-60s; prune and broadcast `presence:leave`.
- Cursors: throttle fan-out to ~20-30 Hz server-side; drop if too frequent; expire cursor after inactivity timeout.
- Identity: derive `userId`, `displayName`, `avatar` from auth (ignore client-sent identity except for cursor/screen metadata).
- Optional snapshot: keep a small roster snapshot (per screen) in memory only; no persistence needed. If late joiners need immediate state, send `presence:state` on successful `presence:join`.

## Client changes

- Add a dedicated presence store under `packages/web/src/stores/presenceStore.js` to avoid prop drilling; shape: per project -> per screen roster and cursors; expose getters and setters.
- Add a primitive `usePresence(projectId, screenId)` under `packages/web/src/primitives/usePresence.js` that:
  - Hooks into the existing project WebSocket instance (from `useProject`) via a small event multiplexer.
  - Sends `presence:join` on mount and `presence:screen` on route change; sends `presence:leave` on cleanup.
  - Throttles outbound cursor sends (~20 Hz) and merges with window size for positioning.
  - Handles `presence:state|join|leave|cursor` messages to update the store.
- Update `useProject` to allow registering custom WS message handlers and senders so presence can share the socket without forking the connection logic.
- UI hooks: navbar/toolbar badges for avatars per project; optional overlay canvas/layer for cursors on checklist/compare screens.
- Feature flag: env-driven toggle to disable cursor layer while keeping avatar presence.

## UX/behavior

- Cursor rendering: absolute layer with small trail/lerp; hide after inactivity; color from stable user hash.
- Idle detection: when tab hidden or no ping >60s, mark `status: idle`; clear on activity.
- Error handling: if WS closes with membership error, presence stops (reuse project error paths).

## Testing

- Unit: DO presence manager (join/leave, screen change, timeouts, cursor throttle).
- Client: presence store reducers; `usePresence` message handling with mocked WS.
- Manual: two-browser session on the same project, navigate between screens, cursors visible/timed out.

## Rollout steps

1. Server: add presence handling to `ProjectDoc` WS (message parsing, roster map, heartbeats, per-screen broadcast helper).
2. Client infra: extend `useProject` to expose a plugin-style handler registry; add presence store + `usePresence` primitive.
3. UI: show avatars in existing project UI (e.g., checklist compare navbar) behind a flag.
4. Cursors: add cursor layer in target screens; gate by feature flag; add throttle/smoothing.
5. Observability: basic logs/metrics for room sizes, timeouts, and close reasons; optional debug panel.
