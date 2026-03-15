/**
 * Profile sync utility - fire-and-forget sync of profile changes to all projects
 */

import { apiFetch } from '@/lib/apiFetch';

export async function syncProfileToProjects() {
  try {
    await apiFetch('/api/users/sync-profile', { method: 'POST' });
  } catch (err) {
    console.warn('Failed to sync profile to projects:', err);
  }
}
