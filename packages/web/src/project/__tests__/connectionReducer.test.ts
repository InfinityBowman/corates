import { describe, it, expect } from 'vitest';
import {
  connectionReducer,
  INITIAL_STATE,
  type ConnectionMachineState,
} from '../connectionReducer';

describe('connectionReducer', () => {
  // -----------------------------------------------------------
  // Critical guards for the cached phase
  // -----------------------------------------------------------
  describe('cached phase guards', () => {
    it('REMOTE_DISCONNECTED from synced preserves content (-> cached)', () => {
      const state: ConnectionMachineState = { phase: 'synced', error: null };
      expect(connectionReducer(state, { type: 'REMOTE_DISCONNECTED' })).toEqual({
        phase: 'cached',
        error: null,
      });
    });

    it('REMOTE_DISCONNECTED from connected shows fallback (-> connecting)', () => {
      const state: ConnectionMachineState = { phase: 'connected', error: null };
      expect(connectionReducer(state, { type: 'REMOTE_DISCONNECTED' })).toEqual({
        phase: 'connecting',
        error: null,
      });
    });

    it('PERSISTENCE_LOADED does not downgrade synced', () => {
      const state: ConnectionMachineState = { phase: 'synced', error: null };
      expect(connectionReducer(state, { type: 'PERSISTENCE_LOADED' })).toEqual({
        phase: 'synced',
        error: null,
      });
    });
  });

  // -----------------------------------------------------------
  // Multi-step sequences that mirror real user scenarios
  // -----------------------------------------------------------
  describe('realistic sequences', () => {
    it('returning user: connect -> cache -> ws connect -> sync', () => {
      let state = INITIAL_STATE;
      state = connectionReducer(state, { type: 'CONNECT_REQUESTED' });
      expect(state.phase).toBe('connecting');

      state = connectionReducer(state, { type: 'PERSISTENCE_LOADED' });
      expect(state.phase).toBe('cached');

      state = connectionReducer(state, { type: 'REMOTE_CONNECTED' });
      expect(state.phase).toBe('cached');

      state = connectionReducer(state, { type: 'SYNC_COMPLETE' });
      expect(state.phase).toBe('synced');
    });

    it('first visit: connect -> ws connect -> sync (no cache)', () => {
      let state = INITIAL_STATE;
      state = connectionReducer(state, { type: 'CONNECT_REQUESTED' });
      state = connectionReducer(state, { type: 'REMOTE_CONNECTED' });
      expect(state.phase).toBe('connected');

      state = connectionReducer(state, { type: 'SYNC_COMPLETE' });
      expect(state.phase).toBe('synced');
    });

    it('fast WebSocket: ws syncs before Dexie finishes', () => {
      let state = INITIAL_STATE;
      state = connectionReducer(state, { type: 'CONNECT_REQUESTED' });
      state = connectionReducer(state, { type: 'REMOTE_CONNECTED' });
      state = connectionReducer(state, { type: 'SYNC_COMPLETE' });
      expect(state.phase).toBe('synced');

      state = connectionReducer(state, { type: 'PERSISTENCE_LOADED' });
      expect(state.phase).toBe('synced');
    });

    it('WiFi hiccup: synced -> disconnect -> reconnect -> sync', () => {
      let state: ConnectionMachineState = { phase: 'synced', error: null };

      state = connectionReducer(state, { type: 'REMOTE_DISCONNECTED' });
      expect(state.phase).toBe('cached');

      state = connectionReducer(state, { type: 'REMOTE_CONNECTED' });
      expect(state.phase).toBe('cached');

      state = connectionReducer(state, { type: 'SYNC_COMPLETE' });
      expect(state.phase).toBe('synced');
    });

    it('full offline toggle: synced -> offline -> online -> reconnect -> sync', () => {
      let state: ConnectionMachineState = { phase: 'synced', error: null };

      state = connectionReducer(state, { type: 'WENT_OFFLINE' });
      expect(state.phase).toBe('offline');

      state = connectionReducer(state, { type: 'WENT_ONLINE' });
      expect(state.phase).toBe('connecting');

      state = connectionReducer(state, { type: 'REMOTE_CONNECTED' });
      expect(state.phase).toBe('connected');

      state = connectionReducer(state, { type: 'SYNC_COMPLETE' });
      expect(state.phase).toBe('synced');
    });

    it('access denied during cache phase', () => {
      let state = INITIAL_STATE;
      state = connectionReducer(state, { type: 'CONNECT_REQUESTED' });
      state = connectionReducer(state, { type: 'PERSISTENCE_LOADED' });
      expect(state.phase).toBe('cached');

      state = connectionReducer(state, { type: 'ACCESS_DENIED', reason: 'Project deleted' });
      expect(state.phase).toBe('error');
      expect(state.error).toBe('Project deleted');
    });

    it('disconnect before first sync shows fallback, not empty content', () => {
      let state = INITIAL_STATE;
      state = connectionReducer(state, { type: 'CONNECT_REQUESTED' });
      state = connectionReducer(state, { type: 'REMOTE_CONNECTED' });
      expect(state.phase).toBe('connected');

      state = connectionReducer(state, { type: 'REMOTE_DISCONNECTED' });
      expect(state.phase).toBe('connecting');
    });
  });
});
