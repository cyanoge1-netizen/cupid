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

/**
 * Formats byte count to human-readable string (B, KB, MB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Checks file sizes against limits (SPEC-UPDATE-1 3.2):
 * - 15 MB per file warning
 * - 50 MB total per person warning
 */
export function checkMediaLimits(files: MediaRef[]): {
  hasLargeFile: boolean;
  isOverTotalLimit: boolean;
  totalBytes: number;
  largeFiles: { name: string; sizeStr: string }[];
} {
  const SINGLE_FILE_LIMIT = 15 * 1024 * 1024; // 15 MB
  const TOTAL_PERSON_LIMIT = 50 * 1024 * 1024; // 50 MB

  let totalBytes = 0;
  const largeFiles: { name: string; sizeStr: string }[] = [];

  for (const f of files) {
    const size = f.blob.size;
    totalBytes += size;
    if (size > SINGLE_FILE_LIMIT) {
      largeFiles.push({ name: f.name, sizeStr: formatFileSize(size) });
    }
  }

  return {
    hasLargeFile: largeFiles.length > 0,
    isOverTotalLimit: totalBytes > TOTAL_PERSON_LIMIT,
    totalBytes,
    largeFiles,
  };
}
