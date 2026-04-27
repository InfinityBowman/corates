export async function sha256(data: string): Promise<string> {
  const buf = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function truncateError(
  error: Error | string | object | null | undefined,
  maxLength: number = 500,
): string | null {
  if (!error) return null;

  let errorStr: string;
  if (error instanceof Error) {
    errorStr = error.message;
  } else if (typeof error === 'string') {
    errorStr = error;
  } else {
    try {
      errorStr = JSON.stringify(error);
    } catch {
      errorStr = String(error);
    }
  }

  if (errorStr.length > maxLength) {
    return errorStr.slice(0, maxLength) + '...[truncated]';
  }
  return errorStr;
}
