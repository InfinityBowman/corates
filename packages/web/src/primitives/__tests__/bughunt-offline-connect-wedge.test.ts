/**
 * Bug hunt: opening a project while offline wedges the connection manager.
 *
 * connect() called while navigator.onLine is false sets shouldBeConnected and
 * returns WITHOUT creating a WebsocketProvider. Both recovery paths are then
 * dead:
 *
 * 1. connection.ts's own window 'online' handler requires `provider` to be
 *    non-null ("if (shouldBeConnected && provider && ...)"), so it no-ops.
 * 2. ProjectGate's online-transition path calls
 *    connectionPool.reconnectIfNeeded(), which gates on
 *    cm.getShouldReconnect(); that returns `provider?.shouldConnect ?? false`,
 *    i.e. false while provider is null, so reconnect() is never called.
 *
 * Result: a user who navigates to a project while offline (supported flow --
 * the project renders from Dexie in the 'cached' phase) never connects or
 * syncs after the network returns, until they leave and re-enter the project.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import {
  createConnectionManager,
  type ConnectionManager,
} from '@/primitives/useProject/connection';

let online = true;
let managers: ConnectionManager[] = [];

function makeManager(): ConnectionManager {
  const ydoc = new Y.Doc();
  const cm = createConnectionManager('bughunt-project', ydoc, {
    onSync: () => {},
    isLocalProject: () => false,
  });
  managers.push(cm);
  return cm;
}

describe('connection manager after connect() while offline', () => {
  beforeEach(() => {
    online = true;
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => online,
    });
  });

  afterEach(() => {
    for (const cm of managers) cm.destroy();
    managers = [];
    Reflect.deleteProperty(window.navigator, 'onLine');
  });

  // .fails: documents a known unfixed bug without failing CI. When the bug is
  // fixed, vitest reports this test as failing -- then restore plain it().
  it.fails('reports that it should reconnect (ProjectGate reconnectIfNeeded path)', () => {
    online = false;
    const cm = makeManager();
    cm.connect();

    // No provider is created while offline (current behavior).
    expect(cm.getProvider()).toBeNull();

    // ProjectGate's online handler does:
    //   if (cm.getShouldReconnect()) { cm.reconnect(); }
    // For that recovery path to ever fire, a manager that was asked to
    // connect and is waiting for the network must report true here.
    expect(cm.getShouldReconnect()).toBe(true);
  });

  it.fails('establishes a connection when the browser comes back online', () => {
    online = false;
    const cm = makeManager();
    cm.connect();
    expect(cm.getProvider()).toBeNull();

    // Network returns.
    online = true;
    window.dispatchEvent(new Event('online'));

    // The manager was asked to connect and the network is back: it must now
    // have a provider attempting the websocket connection.
    expect(cm.getProvider()).not.toBeNull();
  });
});
