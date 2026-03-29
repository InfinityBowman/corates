/**
 * Image compression and manipulation utilities
 */

// Default compression settings for avatars
const DEFAULT_MAX_SIZE = 256; // Max width/height in pixels
const DEFAULT_QUALITY = 0.85; // JPEG quality (0-1)

export interface CompressOptions {
  maxSize?: number;
  quality?: number;
}

/**
 * Compress and resize an image blob for storage
 */
export function compressImageBlob(blob: Blob, options: CompressOptions = {}): Promise<Blob> {
  const { maxSize = DEFAULT_MAX_SIZE, quality = DEFAULT_QUALITY } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions (maintain aspect ratio, fit within max size)
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        compressedBlob => {
          if (compressedBlob) {
            resolve(compressedBlob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        quality,
      );

      // Clean up the object URL
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };

    // Load the image from blob
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Compress and resize an image file for avatar use
 * Returns a new File object with the compressed image
 */
export async function compressImageFile(file: File, options: CompressOptions = {}): Promise<File> {
  const compressedBlob = await compressImageBlob(file, options);

  // Create a new File from the blob
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const newName = baseName ? `${baseName}.jpg` : 'image.jpg';
  return new File([compressedBlob], newName, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}
