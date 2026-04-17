/**
 * Profile sync utility - fire-and-forget sync of profile changes to all projects
 */

import { API_BASE } from '@/config/api';

export async function syncProfileToProjects() {
  try {
    const res = await fetch(`${API_BASE}/api/users/sync-profile`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(`sync-profile failed: ${res.status}`);
    }
  } catch (err) {
    console.warn('Failed to sync profile to projects:', err);
  }
}
