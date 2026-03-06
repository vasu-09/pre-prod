import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

const MAX_LONG_EDGE = 1600;
const STANDARD_QUALITY = 0.78;
const SKIP_RECOMPRESS_MAX_BYTES = 300 * 1024;

const inferFileNameFromUri = uri => {
  if (!uri || typeof uri !== 'string') return null;
  const clean = uri.split('?')[0];
  const parts = clean.split('/');
  const last = parts[parts.length - 1];
  return last && last.trim() ? decodeURIComponent(last) : null;
};

const inferMimeFromName = name => {
  const lower = String(name || '').toLowerCase();

  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (lower.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (lower.endsWith('.pptx')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.zip')) return 'application/zip';

  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.mkv')) return 'video/x-matroska';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.3gp')) return 'video/3gpp';

  return null;
};

export const getFileSizeSafe = async uri => {
  if (!uri) return null;
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    return typeof info?.size === 'number' ? info.size : null;
  } catch {
    return null;
  }
};

export const prepareDocumentForChat = async asset => {
  const uri = asset?.uri;
  if (!uri) throw new Error('Missing document uri');

  const fileName =
    asset?.name ||
    asset?.fileName ||
    inferFileNameFromUri(uri) ||
    `document-${Date.now()}`;

  const mimeType =
    (typeof asset?.mimeType === 'string' && asset.mimeType.trim() && asset.mimeType !== 'application/json'
      ? asset.mimeType
      : null) ||
    inferMimeFromName(fileName) ||
    'application/octet-stream';

  return {
    uri,
    mimeType,
    fileName,
    sizeBytes: await getFileSizeSafe(uri),
    wasCompressed: false,
  };
};

export const prepareVideoForChat = async asset => {
  const uri = asset?.uri;
  if (!uri) throw new Error('Missing video uri');

  let thumbUri = null;
  try {
    const VideoThumbnails = require('expo-video-thumbnails');
    const result = await VideoThumbnails.getThumbnailAsync(uri, { time: 1000 });
    thumbUri = result?.uri || null;
  } catch {
    thumbUri = null;
  }

  const fileName =
    asset?.name ||
    asset?.fileName ||
    inferFileNameFromUri(uri) ||
    `video-${Date.now()}.mp4`;

  const mimeType =
    (typeof asset?.mimeType === 'string' && asset.mimeType.trim() && asset.mimeType !== 'application/json'
      ? asset.mimeType
      : null) ||
    inferMimeFromName(fileName) ||
    'video/mp4';

  return {
    uri,
    mimeType,
    fileName,
    sizeBytes: await getFileSizeSafe(uri),
    thumbUri,
    wasCompressed: false,
  };
};

const getDimensionsSafe = uri => new Promise(resolve => {
  if (!uri) {
    resolve({ width: null, height: null });
    return;
  }
  Image.getSize(
    uri,
    (width, height) => resolve({ width, height }),
    () => resolve({ width: null, height: null }),
  );
});

export const compressImageForChatStandard = async asset => {
  const source = typeof asset === 'string' ? { uri: asset } : (asset || {});
  const originalUri = source?.uri;
  let width = Number(source?.width);
  let height = Number(source?.height);

  if (!originalUri) {
    throw new Error('compressImageForChatStandard requires a valid image uri');
  }

  const originalSizeBytes = await getFileSizeSafe(originalUri);
  if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) {
    const measured = await getDimensionsSafe(originalUri);
    width = Number(measured?.width);
    height = Number(measured?.height);
  }
  const hasValidDimensions = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  const longEdge = hasValidDimensions ? Math.max(width, height) : null;
  const shouldSkipCompression =
    typeof originalSizeBytes === 'number' &&
    originalSizeBytes <= SKIP_RECOMPRESS_MAX_BYTES &&
    typeof longEdge === 'number' &&
    longEdge <= MAX_LONG_EDGE;

  if (shouldSkipCompression) {
    return {
      uri: originalUri,
      mimeType: 'image/jpeg',
      width: hasValidDimensions ? width : null,
      height: hasValidDimensions ? height : null,
      originalUri,
      originalSizeBytes,
      compressedSizeBytes: originalSizeBytes,
      wasCompressed: false,
    };
  }

  const actions = [];
  if (typeof longEdge === 'number' && longEdge > MAX_LONG_EDGE) {
    if (width >= height) {
      actions.push({ resize: { width: MAX_LONG_EDGE } });
    } else {
      actions.push({ resize: { height: MAX_LONG_EDGE } });
    }
  }

  const compressed = await ImageManipulator.manipulateAsync(originalUri, actions, {
    compress: STANDARD_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: false,
  });

  const compressedSizeBytes = await getFileSizeSafe(compressed?.uri);

  return {
    uri: compressed?.uri || originalUri,
    mimeType: 'image/jpeg',
    width: compressed?.width ?? (hasValidDimensions ? width : null),
    height: compressed?.height ?? (hasValidDimensions ? height : null),
    originalUri,
    originalSizeBytes,
    compressedSizeBytes,
    wasCompressed: Boolean(compressed?.uri && compressed.uri !== originalUri),
  };
};

export default compressImageForChatStandard;