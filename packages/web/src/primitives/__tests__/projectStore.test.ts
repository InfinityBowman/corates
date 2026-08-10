/**
 * projectStore — the engine-fed connection phase projection.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, selectConnectionPhase } from '@/stores/projectStore';

const PROJECT = 'project-store-test';

describe('projectStore connection state', () => {
  beforeEach(() => {
    useProjectStore.getState().clearProject(PROJECT);
  });

  it('starts idle for unknown projects', () => {
    const state = selectConnectionPhase(useProjectStore.getState(), PROJECT);
    expect(state).toEqual({ phase: 'idle', error: null, pending: 0 });
  });

  it('stores phase transitions from the pool', () => {
    const store = useProjectStore.getState();
    store.setConnectionState(PROJECT, 'connecting');
    expect(selectConnectionPhase(useProjectStore.getState(), PROJECT).phase).toBe('connecting');

    store.setConnectionState(PROJECT, 'cached');
    expect(selectConnectionPhase(useProjectStore.getState(), PROJECT).phase).toBe('cached');

    store.setConnectionState(PROJECT, 'synced');
    expect(selectConnectionPhase(useProjectStore.getState(), PROJECT).phase).toBe('synced');
  });

  it('carries the error message for the access-denied redirect', () => {
    useProjectStore
      .getState()
      .setConnectionState(PROJECT, 'error', 'You are not a member of this project');
    const state = selectConnectionPhase(useProjectStore.getState(), PROJECT);
    expect(state.phase).toBe('error');
    expect(state.error).toBe('You are not a member of this project');
  });

  it('setConnectionState without an error resets a previous error', () => {
    const store = useProjectStore.getState();
    store.setConnectionState(PROJECT, 'error', 'boom');
    store.setConnectionState(PROJECT, 'connecting');
    expect(selectConnectionPhase(useProjectStore.getState(), PROJECT)).toEqual({
      phase: 'connecting',
      error: null,
      pending: 0,
    });
  });

  it('setPending creates the record and survives phase changes', () => {
    const store = useProjectStore.getState();
    store.setPending(PROJECT, 2);
    expect(selectConnectionPhase(useProjectStore.getState(), PROJECT)).toEqual({
      phase: 'idle',
      error: null,
      pending: 2,
    });

    // Phase and pending change on different events; neither clobbers the other.
    store.setConnectionState(PROJECT, 'synced');
    expect(selectConnectionPhase(useProjectStore.getState(), PROJECT).pending).toBe(2);

    store.setPending(PROJECT, 0);
    const state = selectConnectionPhase(useProjectStore.getState(), PROJECT);
    expect(state.phase).toBe('synced');
    expect(state.pending).toBe(0);
  });

  it('clearProject removes the record and active pointer', () => {
    const store = useProjectStore.getState();
    store.setActiveProject(PROJECT);
    store.setConnectionState(PROJECT, 'synced');
    store.clearProject(PROJECT);
    const state = useProjectStore.getState();
    expect(state.connections[PROJECT]).toBeUndefined();
    expect(state.activeProjectId).toBeNull();
  });
});
