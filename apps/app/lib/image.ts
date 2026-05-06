import imageCompression from 'browser-image-compression';

const MAX_SIZE_MB = 0.2;

function supportsWebP(): boolean {
  if (!import.meta.client) return false;
  const canvas = document.createElement('canvas');
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}

export async function compressImage(file: File): Promise<File> {
  if (file.size <= MAX_SIZE_MB * 1024 * 1024) {
    return file;
  }

  return imageCompression(file, {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: 512,
    useWebWorker: true,
    ...(supportsWebP() && { fileType: 'image/webp' as const }),
  });
}
