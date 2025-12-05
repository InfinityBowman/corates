/**
 * Google Drive routes for Hono
 * Allows users to list and import PDFs from their connected Google Drive
 */

import { Hono } from 'hono';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { createDb } from '../db/client.js';
import { account } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const googleDriveRoutes = new Hono();

// Apply auth middleware to all routes
googleDriveRoutes.use('*', requireAuth);

/**
 * Get Google OAuth tokens for the current user
 * Returns null if not connected
 */
async function getGoogleTokens(db, userId) {
  const googleAccount = await db
    .select({
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      accessTokenExpiresAt: account.accessTokenExpiresAt,
    })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'google')))
    .get();

  return googleAccount;
}

/**
 * Refresh Google access token using refresh token
 */
async function refreshGoogleToken(env, refreshToken) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Get a valid access token, refreshing if necessary
 */
async function getValidAccessToken(env, db, userId, tokens) {
  // Check if token is expired or will expire in the next minute
  const now = new Date();
  const expiresAt = tokens.accessTokenExpiresAt;
  const bufferTime = 60 * 1000; // 1 minute buffer

  if (expiresAt && new Date(expiresAt).getTime() - now.getTime() > bufferTime) {
    // Token is still valid
    return tokens.accessToken;
  }

  // Token is expired or about to expire, refresh it
  if (!tokens.refreshToken) {
    throw new Error('No refresh token available. User needs to reconnect Google account.');
  }

  const newTokens = await refreshGoogleToken(env, tokens.refreshToken);

  // Update the token in the database
  const newExpiresAt = new Date(Date.now() + newTokens.expiresIn * 1000);
  await db
    .update(account)
    .set({
      accessToken: newTokens.accessToken,
      accessTokenExpiresAt: newExpiresAt,
      updatedAt: new Date(),
    })
    .where(and(eq(account.userId, userId), eq(account.providerId, 'google')));

  return newTokens.accessToken;
}

/**
 * GET /api/google-drive/status
 * Check if user has connected their Google account
 */
googleDriveRoutes.get('/status', async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);

  const tokens = await getGoogleTokens(db, user.id);

  return c.json({
    connected: !!tokens?.accessToken,
    hasRefreshToken: !!tokens?.refreshToken,
  });
});

/**
 * DELETE /api/google-drive/disconnect
 * Disconnect Google account (remove OAuth tokens)
 */
googleDriveRoutes.delete('/disconnect', async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    // Delete the Google account link
    await db
      .delete(account)
      .where(and(eq(account.userId, user.id), eq(account.providerId, 'google')));

    return c.json({ success: true, message: 'Google account disconnected' });
  } catch (error) {
    console.error('Google disconnect error:', error);
    return c.json({ error: 'Failed to disconnect Google account' }, 500);
  }
});

/**
 * GET /api/google-drive/files
 * List PDF files from user's Google Drive
 * Query params:
 *   - pageToken: for pagination
 *   - pageSize: number of results (default 20, max 100)
 *   - query: search query to filter files
 */
googleDriveRoutes.get('/files', async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);

  // Get Google tokens
  const tokens = await getGoogleTokens(db, user.id);

  if (!tokens?.accessToken) {
    return c.json(
      {
        error: 'Google account not connected',
        code: 'GOOGLE_NOT_CONNECTED',
      },
      400,
    );
  }

  try {
    const accessToken = await getValidAccessToken(c.env, db, user.id, tokens);

    // Build query parameters
    const pageToken = c.req.query('pageToken');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20', 10), 100);
    const searchQuery = c.req.query('query');

    // Build the Drive API query - only PDF files
    let driveQuery = "mimeType='application/pdf' and trashed=false";

    if (searchQuery) {
      // Escape single quotes in the search query
      const escapedQuery = searchQuery.replace(/'/g, "\\'");
      driveQuery += ` and name contains '${escapedQuery}'`;
    }

    const params = new URLSearchParams({
      q: driveQuery,
      pageSize: String(pageSize),
      fields:
        'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,iconLink,thumbnailLink)',
      orderBy: 'modifiedTime desc',
    });

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));

      if (response.status === 401) {
        return c.json(
          {
            error: 'Google token expired. Please reconnect your account.',
            code: 'GOOGLE_TOKEN_EXPIRED',
          },
          401,
        );
      }

      console.error('Google Drive API error:', error);
      return c.json({ error: 'Failed to fetch files from Google Drive' }, 500);
    }

    const data = await response.json();

    return c.json({
      files: data.files || [],
      nextPageToken: data.nextPageToken || null,
    });
  } catch (error) {
    console.error('Google Drive files error:', error);

    if (error.message.includes('reconnect')) {
      return c.json({ error: error.message, code: 'GOOGLE_TOKEN_EXPIRED' }, 401);
    }

    return c.json({ error: 'Failed to fetch files from Google Drive' }, 500);
  }
});

/**
 * GET /api/google-drive/files/:fileId
 * Get metadata for a specific file
 */
googleDriveRoutes.get('/files/:fileId', async c => {
  const { user } = getAuth(c);
  const fileId = c.req.param('fileId');
  const db = createDb(c.env.DB);

  const tokens = await getGoogleTokens(db, user.id);

  if (!tokens?.accessToken) {
    return c.json({ error: 'Google account not connected', code: 'GOOGLE_NOT_CONNECTED' }, 400);
  }

  try {
    const accessToken = await getValidAccessToken(c.env, db, user.id, tokens);

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,createdTime,modifiedTime,webViewLink`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        return c.json({ error: 'File not found' }, 404);
      }
      return c.json({ error: 'Failed to fetch file metadata' }, 500);
    }

    const file = await response.json();
    return c.json({ file });
  } catch (error) {
    console.error('Google Drive file metadata error:', error);
    return c.json({ error: 'Failed to fetch file metadata' }, 500);
  }
});

/**
 * POST /api/google-drive/files/:fileId/download
 * Download a file from Google Drive and return it
 * This streams the file content directly
 */
googleDriveRoutes.post('/files/:fileId/download', async c => {
  const { user } = getAuth(c);
  const fileId = c.req.param('fileId');
  const db = createDb(c.env.DB);

  const tokens = await getGoogleTokens(db, user.id);

  if (!tokens?.accessToken) {
    return c.json({ error: 'Google account not connected', code: 'GOOGLE_NOT_CONNECTED' }, 400);
  }

  try {
    const accessToken = await getValidAccessToken(c.env, db, user.id, tokens);

    // First get file metadata to check size and type
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!metaResponse.ok) {
      if (metaResponse.status === 404) {
        return c.json({ error: 'File not found' }, 404);
      }
      return c.json({ error: 'Failed to fetch file' }, 500);
    }

    const fileMeta = await metaResponse.json();

    // Verify it's a PDF
    if (fileMeta.mimeType !== 'application/pdf') {
      return c.json({ error: 'Only PDF files can be downloaded' }, 400);
    }

    // Check file size (limit to 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (fileMeta.size && parseInt(fileMeta.size, 10) > maxSize) {
      return c.json({ error: 'File too large. Maximum size is 50MB.' }, 400);
    }

    // Download the file content
    const downloadResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!downloadResponse.ok) {
      return c.json({ error: 'Failed to download file' }, 500);
    }

    // Return the file with appropriate headers
    return new Response(downloadResponse.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileMeta.name)}"`,
        'Content-Length': fileMeta.size || '',
      },
    });
  } catch (error) {
    console.error('Google Drive download error:', error);
    return c.json({ error: 'Failed to download file' }, 500);
  }
});

/**
 * POST /api/google-drive/import
 * Import a PDF from Google Drive to a project study
 * Body: { fileId, projectId, studyId }
 */
googleDriveRoutes.post('/import', async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { fileId, projectId, studyId } = body;

  if (!fileId || !projectId || !studyId) {
    return c.json({ error: 'fileId, projectId, and studyId are required' }, 400);
  }

  const tokens = await getGoogleTokens(db, user.id);

  if (!tokens?.accessToken) {
    return c.json({ error: 'Google account not connected', code: 'GOOGLE_NOT_CONNECTED' }, 400);
  }

  try {
    const accessToken = await getValidAccessToken(c.env, db, user.id, tokens);

    // Get file metadata
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!metaResponse.ok) {
      if (metaResponse.status === 404) {
        return c.json({ error: 'File not found in Google Drive' }, 404);
      }
      return c.json({ error: 'Failed to fetch file from Google Drive' }, 500);
    }

    const fileMeta = await metaResponse.json();

    // Verify it's a PDF
    if (fileMeta.mimeType !== 'application/pdf') {
      return c.json({ error: 'Only PDF files can be imported' }, 400);
    }

    // Check file size (limit to 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (fileMeta.size && parseInt(fileMeta.size, 10) > maxSize) {
      return c.json({ error: 'File too large. Maximum size is 50MB.' }, 400);
    }

    // Download the file content
    const downloadResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!downloadResponse.ok) {
      return c.json({ error: 'Failed to download file from Google Drive' }, 500);
    }

    // Upload to R2 bucket
    const r2Key = `projects/${projectId}/studies/${studyId}/${fileMeta.name}`;

    await c.env.PDF_BUCKET.put(r2Key, downloadResponse.body, {
      httpMetadata: {
        contentType: 'application/pdf',
      },
      customMetadata: {
        originalName: fileMeta.name,
        importedFrom: 'google-drive',
        googleDriveFileId: fileId,
        uploadedBy: user.id,
        uploadedAt: new Date().toISOString(),
      },
    });

    return c.json({
      success: true,
      file: {
        key: r2Key,
        fileName: fileMeta.name,
        size: fileMeta.size,
        source: 'google-drive',
      },
    });
  } catch (error) {
    console.error('Google Drive import error:', error);
    return c.json({ error: 'Failed to import file from Google Drive' }, 500);
  }
});

export { googleDriveRoutes };
