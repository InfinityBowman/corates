/**
 * Avatar Copy Utility
 * Downloads OAuth profile pictures and uploads them to R2 storage
 * This ensures all avatars are served from our own storage, avoiding external URL issues
 */

import type { Env } from '@/types/env';
import {
  createDomainError,
  FILE_ERRORS,
  VALIDATION_ERRORS,
  SYSTEM_ERRORS,
  type DomainError,
  type FileErrorDetails,
  type SystemErrorDetails,
} from '@corates/shared';

const ALLOWED_AVATAR_DOMAINS = [
  'lh3.googleusercontent.com',
  'googleusercontent.com',
  'avatars.githubusercontent.com',
  'platform-lookaside.fbsbx.com',
];

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

export interface AvatarCopyResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: DomainError;
}

/**
 * Check if a URL is an external avatar URL that should be copied.
 * Only accepts HTTPS URLs from allowed domains.
 */
export function isExternalAvatarUrl(url: string | null | undefined): url is string {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    // Only allow HTTPS URLs
    if (parsed.protocol !== 'https:') return false;
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
      error: createDomainError(
        VALIDATION_ERRORS.INVALID_INPUT,
        { field: 'avatarUrl', value: externalUrl } as FileErrorDetails,
        `URL domain not allowed for avatar copy: ${externalUrl}`,
      ),
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
        error: createDomainError(
          SYSTEM_ERRORS.SERVICE_UNAVAILABLE,
          { operation: 'avatar_fetch', statusCode: response.status } as SystemErrorDetails,
          `Failed to fetch avatar: ${response.status} ${response.statusText}`,
        ),
      };
    }

    // Validate content type
    const contentType = response.headers.get('content-type')?.split(';')[0].trim() || '';
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return {
        success: false,
        error: createDomainError(
          FILE_ERRORS.INVALID_TYPE,
          { fileType: contentType } as FileErrorDetails,
          `Invalid content type: ${contentType}`,
        ),
      };
    }

    // Validate size from Content-Length header if available
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_AVATAR_SIZE) {
      return {
        success: false,
        error: createDomainError(
          FILE_ERRORS.TOO_LARGE,
          { fileSize: contentLength } as FileErrorDetails,
          `Avatar too large: ${contentLength} bytes (max: ${MAX_AVATAR_SIZE})`,
        ),
      };
    }

    // Read the image data
    const arrayBuffer = await response.arrayBuffer();

    // Double-check actual size
    if (arrayBuffer.byteLength > MAX_AVATAR_SIZE) {
      return {
        success: false,
        error: createDomainError(
          FILE_ERRORS.TOO_LARGE,
          { fileSize: arrayBuffer.byteLength } as FileErrorDetails,
          `Avatar too large: ${arrayBuffer.byteLength} bytes (max: ${MAX_AVATAR_SIZE})`,
        ),
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
      error: createDomainError(
        FILE_ERRORS.UPLOAD_FAILED,
        { operation: 'avatar_upload', originalError: err.message } as SystemErrorDetails,
        err.message,
      ),
    };
  }
}
