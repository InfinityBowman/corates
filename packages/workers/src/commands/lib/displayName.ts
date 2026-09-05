import type { Database } from '@corates/db/client';
import { user } from '@corates/db/schema';
import { eq } from 'drizzle-orm';

/** Name shown to other users in notification copy; same precedence as invitation emails. */
export async function displayName(db: Database, userId: string): Promise<string> {
  const row = await db
    .select({ name: user.name, givenName: user.givenName, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .get();
  return row?.givenName || row?.name || row?.email || 'Someone';
}
