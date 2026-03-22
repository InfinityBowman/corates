/**
 * @/project - Deep module for project sync
 * See docs/audits/project-sync-refactor-rfc.md
 */

export {
  connectionReducer,
  phaseToLegacy,
  INITIAL_STATE,
  type ConnectionPhase,
  type ConnectionEvent,
  type ConnectionMachineState,
} from './connectionReducer';

export { ProjectGate } from './ProjectGate';
export { project } from './actions';
