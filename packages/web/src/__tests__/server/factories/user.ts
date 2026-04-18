import type { SeedUserInput } from '../seed-schemas.js';
import { seedUser } from '../helpers.js';
import { generateId, nowSec, withDefaults, emailFromId, nextCounter } from './utils.js';

export interface BuiltUser {
  id: string;
  name: string;
  email: string;
  givenName: string | null;
  familyName: string | null;
  username: string | null;
  role: string;
  emailVerified: number | boolean;
  banned: number | boolean;
  banReason: string | null;
  banExpires: number | null;
  stripeCustomerId: string | null;
  createdAt: number;
  updatedAt: number;
}

export async function buildUser(overrides: Partial<SeedUserInput> = {}): Promise<BuiltUser> {
  const n = nextCounter();
  const id = overrides.id || generateId('user');
  const ts = nowSec();

  const defaults = {
    id,
    name: `Test User ${n}`,
    email: emailFromId(id),
    givenName: 'Test',
    familyName: `User ${n}`,
    username: `testuser${n}`,
    role: 'user',
    emailVerified: 1,
    banned: 0,
    banReason: null,
    banExpires: null,
    stripeCustomerId: `cus_test_${id}`,
    createdAt: ts,
    updatedAt: ts,
  };

  const userData = withDefaults(defaults, overrides);
  await seedUser(userData);

  return userData as BuiltUser;
}

export async function buildAdminUser(overrides: Partial<SeedUserInput> = {}): Promise<BuiltUser> {
  return buildUser({
    role: 'admin',
    ...overrides,
  });
}

export async function buildBannedUser(overrides: Partial<SeedUserInput> = {}): Promise<BuiltUser> {
  const ts = nowSec();
  return buildUser({
    banned: 1,
    banReason: overrides.banReason || 'Test ban',
    banExpires: overrides.banExpires || ts + 86400,
    ...overrides,
  });
}
