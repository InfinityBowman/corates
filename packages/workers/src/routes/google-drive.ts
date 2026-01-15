/**
 * Google Drive routes for Hono
 * Allows users to list and import PDFs from their connected Google Drive
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { createDb } from '@/db/client.js';
import { account, projects, mediaFiles } from '@/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { generateUniqueFileName } from './orgs/pdfs.js';
import {
  createDomainError,
  AUTH_ERRORS,
  FILE_ERRORS,
  SYSTEM_ERRORS,
  isDomainError,
  isPdfSignature,
  PDF_MAGIC_BYTES,
} from '@corates/shared';
import { validationHook } from '@/lib/honoValidationHook.js';
import type { Env } from '../types';

const googleDriveRoutes = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

// Apply auth middleware to all routes
googleDriveRoutes.use('*', requireAuth);

// Response schemas
const DriveStatusSchema = z
  .object({
    connected: z.boolean(),
    hasRefreshToken: z.boolean(),
  })
  .openapi('DriveStatus');

const PickerTokenSchema = z
  .object({
    accessToken: z.string(),
    expiresAt: z.string().nullable(),
  })
  .openapi('PickerToken');

const DisconnectSuccessSchema = z
  .object({
    success: z.literal(true),
    message: z.string(),
  })
  .openapi('DisconnectSuccess');

const ImportSuccessSchema = z
  .object({
    success: z.literal(true),
    id: z.string(),
    file: z.object({
      key: z.string(),
      fileName: z.string(),
      originalFileName: z.string().optional(),
      size: z.number(),
      source: z.literal('google-drive'),
    }),
  })
  .openapi('ImportSuccess');

const DriveErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('DriveError');

interface GoogleTokens {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
}

/**
 * Get Google OAuth tokens for the current user
 */
async function getGoogleTokens(
  db: ReturnType<typeof createDb>,
  userId: string,
): Promise<GoogleTokens | undefined> {
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
async function refreshGoogleToken(
  env: Env,
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
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
    const errorText = await response.text();
    const error = createDomainError(AUTH_ERRORS.INVALID, {
      context: 'google_token_refresh',
      originalError: errorText,
    });
    throw error;
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Get a valid access token, refreshing if necessary
 */
async function getValidAccessToken(
  env: Env,
  db: ReturnType<typeof createDb>,
  userId: string,
  tokens: GoogleTokens,
): Promise<string> {
  const now = new Date();
  const expiresAt = tokens.accessTokenExpiresAt;
  const bufferTime = 60 * 1000;

  if (expiresAt && new Date(expiresAt).getTime() - now.getTime() > bufferTime) {
    return tokens.accessToken!;
  }

  if (!expiresAt || Number.isNaN(new Date(expiresAt).getTime())) {
    if (tokens.accessToken) return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    const error = createDomainError(AUTH_ERRORS.INVALID, {
      context: 'google_no_refresh_token',
      message: 'No refresh token available. User needs to reconnect Google account.',
    });
    throw error;
  }

  const newTokens = await refreshGoogleToken(env, tokens.refreshToken);

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

// Status route
const statusRoute = createRoute({
  method: 'get',
  path: '/status',
  tags: ['Google Drive'],
  summary: 'Check Google connection status',
  description: 'Check if user has connected their Google account',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: DriveStatusSchema } },
      description: 'Connection status',
    },
  },
});

googleDriveRoutes.openapi(statusRoute, async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);

  const tokens = await getGoogleTokens(db, user!.id);

  return c.json({
    connected: !!tokens?.accessToken,
    hasRefreshToken: !!tokens?.refreshToken,
  });
});

// Picker token route
const pickerTokenRoute = createRoute({
  method: 'get',
  path: '/picker-token',
  tags: ['Google Drive'],
  summary: 'Get Google Picker token',
  description: 'Returns a short-lived access token for the Google Picker API',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: PickerTokenSchema } },
      description: 'Picker token',
    },
    401: {
      content: { 'application/json': { schema: DriveErrorSchema } },
      description: 'Google not connected',
    },
  },
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
googleDriveRoutes.openapi(pickerTokenRoute, async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);

  const tokens = await getGoogleTokens(db, user!.id);
  if (!tokens?.accessToken) {
    const error = createDomainError(AUTH_ERRORS.INVALID, {
      context: 'google_not_connected',
      code: 'GOOGLE_NOT_CONNECTED',
    });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  try {
    const accessToken = await getValidAccessToken(c.env, db, user!.id, tokens);
    const updatedTokens = await getGoogleTokens(db, user!.id);
    const expiresAt = updatedTokens?.accessTokenExpiresAt;

    return c.json({
      accessToken,
      expiresAt: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt || null,
    });
  } catch (error) {
    console.error('Google Drive picker-token error:', error);
    const err = error as { message?: string; code?: string };
    if (
      (typeof err?.message === 'string' && err.message.includes('reconnect')) ||
      (typeof err?.code === 'string' && err.code.includes('GOOGLE'))
    ) {
      const authError =
        isDomainError(error) ? error : (
          createDomainError(AUTH_ERRORS.INVALID, {
            context: 'google_token_expired',
            originalError: typeof err?.message === 'string' ? err.message : String(error),
          })
        );
      return c.json(authError, authError.statusCode as ContentfulStatusCode);
    }
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'get_google_picker_token',
      originalError: typeof err?.message === 'string' ? err.message : String(error),
    });
    return c.json(systemError, systemError.statusCode as ContentfulStatusCode);
  }
});

// Disconnect route
const disconnectRoute = createRoute({
  method: 'delete',
  path: '/disconnect',
  tags: ['Google Drive'],
  summary: 'Disconnect Google account',
  description: 'Remove OAuth tokens and disconnect Google account',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: DisconnectSuccessSchema } },
      description: 'Disconnected successfully',
    },
  },
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
googleDriveRoutes.openapi(disconnectRoute, async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    await db
      .delete(account)
      .where(and(eq(account.userId, user!.id), eq(account.providerId, 'google')));

    return c.json({ success: true as const, message: 'Google account disconnected' });
  } catch (error) {
    console.error('Google disconnect error:', error);
    const err = error as Error;
    const systemError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'disconnect_google_account',
      originalError: err?.message || String(error),
    });
    return c.json(systemError, systemError.statusCode as ContentfulStatusCode);
  }
});

// Import route
const importRoute = createRoute({
  method: 'post',
  path: '/import',
  tags: ['Google Drive'],
  summary: 'Import PDF from Google Drive',
  description: 'Import a PDF file from Google Drive to a project study',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              fileId: z.string().min(1).openapi({ example: '1abc123def456' }),
              projectId: z.string().min(1).openapi({ example: 'proj-123' }),
              studyId: z.string().min(1).openapi({ example: 'study-456' }),
            })
            .openapi('ImportRequest'),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ImportSuccessSchema } },
      description: 'File imported successfully',
    },
    400: {
      content: { 'application/json': { schema: DriveErrorSchema } },
      description: 'Validation error or invalid file type',
    },
    401: {
      content: { 'application/json': { schema: DriveErrorSchema } },
      description: 'Google not connected',
    },
    404: {
      content: { 'application/json': { schema: DriveErrorSchema } },
      description: 'File not found',
    },
  },
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
googleDriveRoutes.openapi(importRoute, async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);
  const { fileId, projectId, studyId } = c.req.valid('json');

  const tokens = await getGoogleTokens(db, user!.id);

  if (!tokens?.accessToken) {
    const error = createDomainError(AUTH_ERRORS.INVALID, {
      context: 'google_not_connected',
      code: 'GOOGLE_NOT_CONNECTED',
    });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  try {
    const accessToken = await getValidAccessToken(c.env, db, user!.id, tokens);

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
        const error = createDomainError(FILE_ERRORS.NOT_FOUND, {
          fileName: fileId,
          source: 'google-drive',
        });
        return c.json(error, error.statusCode as ContentfulStatusCode);
      }
      const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'fetch_google_drive_file',
        originalError: `HTTP ${metaResponse.status}`,
      });
      return c.json(systemError, systemError.statusCode as ContentfulStatusCode);
    }

    const fileMeta = (await metaResponse.json()) as {
      id: string;
      name: string;
      mimeType: string;
      size?: string;
    };

    // Verify it's a PDF
    if (fileMeta.mimeType !== 'application/pdf') {
      const error = createDomainError(FILE_ERRORS.INVALID_TYPE, {
        expectedType: 'application/pdf',
        receivedType: fileMeta.mimeType,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Check file size (limit to 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (fileMeta.size && parseInt(fileMeta.size, 10) > maxSize) {
      const error = createDomainError(FILE_ERRORS.TOO_LARGE, {
        maxSize: maxSize,
        fileSize: parseInt(fileMeta.size, 10),
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
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
      const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'download_google_drive_file',
        originalError: `HTTP ${downloadResponse.status}`,
      });
      return c.json(systemError, systemError.statusCode as ContentfulStatusCode);
    }

    const fileContent = await downloadResponse.arrayBuffer();

    // Verify PDF magic bytes
    const header = new Uint8Array(fileContent.slice(0, PDF_MAGIC_BYTES.length));
    if (!isPdfSignature(header)) {
      const error = createDomainError(FILE_ERRORS.INVALID_TYPE, {
        expectedType: 'application/pdf',
        receivedType: 'unknown (invalid PDF signature)',
        source: 'google-drive',
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Get project to retrieve orgId
    const project = await db
      .select({ orgId: projects.orgId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    if (!project) {
      const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_project_for_import',
        projectId,
        message: 'Project not found',
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Generate unique filename
    const originalFileName = fileMeta.name;
    const uniqueFileName = await generateUniqueFileName(fileMeta.name, projectId, studyId, db);
    const r2Key = `projects/${projectId}/studies/${studyId}/${uniqueFileName}`;

    // Upload to R2
    const fileSize = fileContent.byteLength;

    await c.env.PDF_BUCKET.put(r2Key, fileContent, {
      httpMetadata: {
        contentType: 'application/pdf',
      },
      customMetadata: {
        originalName: originalFileName,
        importedFrom: 'google-drive',
        googleDriveFileId: fileId,
        uploadedBy: user!.id,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Insert into mediaFiles table
    const mediaFileId = crypto.randomUUID();
    try {
      await db.insert(mediaFiles).values({
        id: mediaFileId,
        filename: uniqueFileName,
        originalName: originalFileName,
        fileType: 'application/pdf',
        fileSize: fileSize,
        uploadedBy: user!.id,
        bucketKey: r2Key,
        orgId: project.orgId,
        projectId,
        studyId,
        createdAt: new Date(),
      });
    } catch (dbError) {
      console.error('Failed to insert mediaFiles record after Google Drive import:', dbError);
    }

    return c.json({
      success: true as const,
      id: mediaFileId,
      file: {
        key: r2Key,
        fileName: uniqueFileName,
        originalFileName: originalFileName !== uniqueFileName ? originalFileName : undefined,
        size: fileSize,
        source: 'google-drive' as const,
      },
    });
  } catch (error) {
    console.error('Google Drive import error:', error);
    if (isDomainError(error)) {
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }
    const err = error as Error;
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'import_google_drive_file',
      originalError: typeof err?.message === 'string' ? err.message : String(error),
    });
    return c.json(systemError, systemError.statusCode as ContentfulStatusCode);
  }
});

export { googleDriveRoutes };
