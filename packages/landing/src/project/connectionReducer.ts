/**
 * Pure connection state machine for project sync lifecycle.
 */

export type ConnectionPhase =
  | 'idle'
  | 'loading'
  | 'connecting'
  | 'connected'
  | 'synced'
  | 'error'
  | 'offline';

export type ConnectionEvent =
  | { type: 'CONNECT_REQUESTED' }
  | { type: 'PERSISTENCE_LOADED' }
  | { type: 'REMOTE_CONNECTED' }
  | { type: 'REMOTE_DISCONNECTED' }
  | { type: 'SYNC_COMPLETE' }
  | { type: 'WENT_OFFLINE' }
  | { type: 'WENT_ONLINE' }
  | { type: 'ACCESS_DENIED'; reason: string }
  | { type: 'ERROR_THRESHOLD_REACHED'; message: string }
  | { type: 'LOCAL_READY' }
  | { type: 'RESET' };

export interface ConnectionMachineState {
  phase: ConnectionPhase;
  error: string | null;
}

const INITIAL_STATE: ConnectionMachineState = {
  phase: 'idle',
  error: null,
};

export function connectionReducer(
  state: ConnectionMachineState,
  event: ConnectionEvent,
): ConnectionMachineState {
  switch (event.type) {
    case 'CONNECT_REQUESTED':
      return { phase: 'connecting', error: null };

    case 'PERSISTENCE_LOADED':
      // Dexie loaded -- no phase change needed, WebSocket handles progression
      return state;

    case 'LOCAL_READY':
      return { phase: 'synced', error: null };

    case 'REMOTE_CONNECTED':
      if (state.phase !== 'error' && state.phase !== 'synced') {
        return { phase: 'connected', error: null };
      }
      return state;

    case 'SYNC_COMPLETE':
      if (state.phase !== 'error') {
        return { phase: 'synced', error: null };
      }
      return state;

    case 'REMOTE_DISCONNECTED':
      if (state.phase === 'connected' || state.phase === 'synced') {
        return { phase: 'connecting', error: null };
      }
      return state;

    case 'WENT_OFFLINE':
      if (state.phase !== 'error' && state.phase !== 'idle') {
        return { phase: 'offline', error: null };
      }
      return state;

    case 'WENT_ONLINE':
      if (state.phase === 'offline') {
        return { phase: 'connecting', error: null };
      }
      return state;

    case 'ACCESS_DENIED':
      return { phase: 'error', error: event.reason };

    case 'ERROR_THRESHOLD_REACHED':
      return { phase: 'error', error: event.message };

    case 'RESET':
      return INITIAL_STATE;

    default:
      return state;
  }
}

export { INITIAL_STATE };

/**
 * Map the new phase enum to the legacy 4-boolean shape for backward compatibility.
 * Remove once all consumers are migrated to check `phase` directly.
 */
export function phaseToLegacy(state: ConnectionMachineState): {
  connected: boolean;
  connecting: boolean;
  synced: boolean;
  error: string | null;
} {
  switch (state.phase) {
    case 'idle':
      return { connected: false, connecting: false, synced: false, error: null };
    case 'loading':
    case 'connecting':
      return { connected: false, connecting: true, synced: false, error: null };
    case 'connected':
      return { connected: true, connecting: false, synced: false, error: null };
    case 'synced':
      return { connected: true, connecting: false, synced: true, error: null };
    case 'offline':
      return { connected: false, connecting: false, synced: false, error: null };
    case 'error':
      return { connected: false, connecting: false, synced: false, error: state.error };
  }
}
