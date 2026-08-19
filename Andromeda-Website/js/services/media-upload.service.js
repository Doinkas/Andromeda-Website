import { storage } from '/js/core/firebase.js';
import {
  getDownloadURL,
  ref,
  uploadBytes
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js';
import { requirePermission } from '/js/services/authz.service.js';

export const MEDIA_UPLOAD_LIMITS = Object.freeze({
  maxImageBytes: 2 * 1024 * 1024,
  allowedImageTypes: Object.freeze(['image/png', 'image/jpeg', 'image/webp'])
});

function normalizeFilename(name) {
  const safe = String(name || 'media-image')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return safe || 'media-image';
}

export function validateMediaImageFile(file, limits = MEDIA_UPLOAD_LIMITS) {
  if (!file) {
    throw new Error('Choose an image file first.');
  }

  if (!limits.allowedImageTypes.includes(file.type)) {
    throw new Error('Use a PNG, JPG, or WebP image.');
  }

  if (file.size > limits.maxImageBytes) {
    throw new Error('Image is too large. Use an image under 2 MB.');
  }
}

export function buildMediaHubStoragePath({ panelIndex = 0, filename = '' } = {}) {
  const safePanel = Math.max(Number(panelIndex) || 0, 0) + 1;
  return `media-hub/home-carousel/panel-${safePanel}/${Date.now()}-${normalizeFilename(filename)}`;
}

export async function uploadMediaHubImage(file, {
  panelIndex = 0,
  uploadedBy = ''
} = {}) {
  await requirePermission('storage:upload', {
    message: 'You are not authorized to upload media assets.'
  });
  validateMediaImageFile(file);

  try {
    const path = buildMediaHubStoragePath({ panelIndex, filename: file.name });
    const storageRef = ref(storage, path);
    const result = await uploadBytes(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        uploadedBy: String(uploadedBy || '').trim().toLowerCase(),
        panel: String(Math.max(Number(panelIndex) || 0, 0) + 1)
      }
    });

    return {
      path,
      url: await getDownloadURL(result.ref)
    };
  } catch (error) {
    const code = String(error?.code || '').toLowerCase();
    if (
      code.includes('storage/unauthorized')
      || code.includes('storage/unknown')
      || code.includes('storage/bucket-not-found')
      || code.includes('storage/object-not-found')
    ) {
      throw new Error('Firebase Storage upload is not available yet. Paste an image URL to keep publishing.');
    }

    throw error;
  }
}
