import type { MediaRef } from '../types';

/**
 * Generates a 320px JPEG thumbnail Blob using Canvas (SPEC 5.4).
 */
export async function createThumbnail(imageBlob: Blob): Promise<Blob> {
  // If not in browser environment (e.g. Node tests), return original blob
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return imageBlob;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 320;
        let width = img.width || 320;
        let height = img.height || 320;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageBlob);
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (thumbBlob) => {
            resolve(thumbBlob || imageBlob);
          },
          'image/jpeg',
          0.8
        );
      } catch {
        resolve(imageBlob);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(imageBlob);
    };

    img.src = url;
  });
}

/**
 * Determines MediaRef.kind from MIME type.
 */
export function getMediaKind(mime: string): MediaRef['kind'] {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/')) return 'text';
  return 'doc';
}
