/**
 * Profile sync utility - fire-and-forget sync of profile changes to all projects
 */

import { parseResponse } from 'hono/client';
import { api } from '@/lib/rpc';

export async function syncProfileToProjects() {
  try {
    await parseResponse(api.api.users['sync-profile'].$post({}));
  } catch (err) {
    console.warn('Failed to sync profile to projects:', err);
  }
}
