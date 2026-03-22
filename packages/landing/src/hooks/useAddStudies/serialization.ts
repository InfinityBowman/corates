/**
 * Serialization utilities for useAddStudies state persistence
 */

/**
 * Clone an ArrayBuffer safely (handles detached buffers)
 */
export function cloneArrayBuffer(buffer: ArrayBuffer | null | undefined): ArrayBuffer | null {
  if (!buffer || !(buffer instanceof ArrayBuffer)) return null;
  try {
    // Check if buffer is detached by trying to access byteLength
    if (buffer.byteLength === 0 && (buffer as ArrayBuffer & { maxByteLength?: number }).maxByteLength === undefined) {
      return null;
    }
    // Create a new ArrayBuffer copy
    const copy = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(copy).set(new Uint8Array(buffer));
    return copy;
  } catch (err) {
    console.warn('Failed to copy ArrayBuffer (likely detached):', (err as Error).message);
    return null;
  }
}
