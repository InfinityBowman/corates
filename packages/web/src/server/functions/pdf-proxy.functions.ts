import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import { proxyPdfFetch as proxyPdfFetchImpl } from './pdf-proxy.server';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const proxyPdfFetch = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ url: z.string().url() }))
  .handler(async ({ data, context: { session } }) => {
    const buffer = await proxyPdfFetchImpl(session, data);
    return { data: arrayBufferToBase64(buffer), byteLength: buffer.byteLength };
  });
