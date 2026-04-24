import { syncUserProfile } from '@/server/functions/users.functions';

export async function syncProfileToProjects() {
  try {
    await syncUserProfile();
  } catch (err) {
    console.warn('Failed to sync profile to projects:', err);
  }
}
