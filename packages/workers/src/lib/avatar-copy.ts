/**
 * Avatar Copy Utility
 * Downloads OAuth profile pictures and uploads them to R2 storage
 * This ensures all avatars are served from our own storage, avoiding external URL issues
 */

import type { Env } from '@/types/env';

const ALLOWED_AVATAR_DOMAINS = [
  'lh3.googleusercontent.com',
  'googleusercontent.com',
  'avatars.githubusercontent.com',
  'platform-lookaside.fbsbx.com',
];

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

// Error codes for categorization (mirrors FILE_ERRORS from @corates/shared)
export const AVATAR_COPY_ERRORS = {
  DOMAIN_NOT_ALLOWED: 'AVATAR_DOMAIN_NOT_ALLOWED',
  FETCH_FAILED: 'AVATAR_FETCH_FAILED',
  INVALID_TYPE: 'AVATAR_INVALID_TYPE',
  TOO_LARGE: 'AVATAR_TOO_LARGE',
  UPLOAD_FAILED: 'AVATAR_UPLOAD_FAILED',
} as const;

export type AvatarCopyErrorCode = (typeof AVATAR_COPY_ERRORS)[keyof typeof AVATAR_COPY_ERRORS];

export interface AvatarCopyResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
  errorCode?: AvatarCopyErrorCode;
}

/**
 * Check if a URL is an external avatar URL that should be copied
 */
export function isExternalAvatarUrl(url: string | null | undefined): url is string {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return ALLOWED_AVATAR_DOMAINS.some(
      domain => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain),
    );
  } catch {
    return false;
  }
}

/**
 * Check if a URL is already an internal R2 avatar URL
 */
export function isInternalAvatarUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  // Internal avatars use relative paths like /api/users/avatar/{userId}
  return url.startsWith('/api/users/avatar/');
}

/**
 * Download an external avatar and upload it to R2 storage
 */
export async function copyAvatarToR2(
  env: Env,
  userId: string,
  externalUrl: string,
): Promise<AvatarCopyResult> {
  // Validate the URL is from an allowed domain
  if (!isExternalAvatarUrl(externalUrl)) {
    return {
      success: false,
      error: `URL domain not allowed for avatar copy: ${externalUrl}`,
      errorCode: AVATAR_COPY_ERRORS.DOMAIN_NOT_ALLOWED,
    };
  }

  try {
    // Fetch the external image
    const response = await fetch(externalUrl, {
      headers: {
        Accept: 'image/*',
        'User-Agent': 'CoRATES/1.0',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch avatar: ${response.status} ${response.statusText}`,
        errorCode: AVATAR_COPY_ERRORS.FETCH_FAILED,
      };
    }

    // Validate content type
    const contentType = response.headers.get('content-type')?.split(';')[0].trim() || '';
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return {
        success: false,
        error: `Invalid content type: ${contentType}`,
        errorCode: AVATAR_COPY_ERRORS.INVALID_TYPE,
      };
    }

    // Validate size from Content-Length header if available
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_AVATAR_SIZE) {
      return {
        success: false,
        error: `Avatar too large: ${contentLength} bytes (max: ${MAX_AVATAR_SIZE})`,
        errorCode: AVATAR_COPY_ERRORS.TOO_LARGE,
      };
    }

    // Read the image data
    const arrayBuffer = await response.arrayBuffer();

    // Double-check actual size
    if (arrayBuffer.byteLength > MAX_AVATAR_SIZE) {
      return {
        success: false,
        error: `Avatar too large: ${arrayBuffer.byteLength} bytes (max: ${MAX_AVATAR_SIZE})`,
        errorCode: AVATAR_COPY_ERRORS.TOO_LARGE,
      };
    }

    // Determine file extension from content type
    const ext = contentType.split('/')[1] || 'jpg';
    const timestamp = Date.now();
    const key = `avatars/${userId}/${timestamp}.${ext}`;

    // Delete old avatars for this user
    try {
      const oldAvatars = await env.PDF_BUCKET.list({ prefix: `avatars/${userId}/` });
      for (const obj of oldAvatars.objects) {
        await env.PDF_BUCKET.delete(obj.key);
      }
    } catch (e) {
      // Log but don't fail - old avatar cleanup is non-critical
      console.warn('[AvatarCopy] Failed to delete old avatars:', e);
    }

    // Upload to R2
    await env.PDF_BUCKET.put(key, arrayBuffer, {
      httpMetadata: {
        contentType,
        cacheControl: 'public, max-age=31536000',
      },
      customMetadata: {
        userId,
        sourceUrl: externalUrl,
        uploadedAt: new Date().toISOString(),
        copiedFromOAuth: 'true',
      },
    });

    const avatarUrl = `/api/users/avatar/${userId}?t=${timestamp}`;

    console.log(`[AvatarCopy] Successfully copied avatar for user ${userId} to ${key}`);

    return {
      success: true,
      url: avatarUrl,
      key,
    };
  } catch (error) {
    const err = error as Error;
    console.error('[AvatarCopy] Error copying avatar:', err);
    return {
      success: false,
      error: err.message,
      errorCode: AVATAR_COPY_ERRORS.UPLOAD_FAILED,
    };
  }
}
