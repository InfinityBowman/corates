/**
 * Test factories index
 *
 * Usage:
 *   import { buildUser, buildProject, buildMemberRemovalScenario } from '@/__tests__/factories';
 *
 * Or import specific modules:
 *   import { buildUser, buildAdminUser } from '@/__tests__/factories/user';
 */

// Utilities
export { generateId, nowSec, nowDate, resetCounter } from './utils.js';

// User factories
export { buildUser, buildAdminUser, buildBannedUser } from './user.js';

// Organization factories
export { buildOrg, buildOrgMember, buildOrgWithMembers } from './org.js';

// Project factories
export {
  buildProject,
  buildProjectWithOwner,
  buildProjectMember,
  buildProjectWithMembers,
  buildProjectInvitation,
} from './project.js';

// Scenario factories
export {
  buildMemberRemovalScenario,
  buildLastOwnerScenario,
  buildMultipleOwnersScenario,
  buildSelfRemovalScenario,
  buildNonMemberScenario,
  buildOrgAdminScenario,
  buildCrossOrgScenario,
} from './scenarios.js';
