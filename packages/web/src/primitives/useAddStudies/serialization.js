/**
 * Serialization utilities for useAddStudies state persistence
 */

/**
 * Clone an ArrayBuffer safely (handles detached buffers)
 * @param {ArrayBuffer} buffer
 * @returns {ArrayBuffer|null}
 */
export function cloneArrayBuffer(buffer) {
  if (!buffer || !(buffer instanceof ArrayBuffer)) return null;
  try {
    // Check if buffer is detached by trying to access byteLength
    if (buffer.byteLength === 0 && buffer.maxByteLength === undefined) {
      return null;
    }
    // Create a new ArrayBuffer copy
    const copy = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(copy).set(new Uint8Array(buffer));
    return copy;
  } catch (err) {
    console.warn('Failed to copy ArrayBuffer (likely detached):', err.message);
    return null;
  }
}
