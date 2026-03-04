import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

const MAX_LONG_EDGE = 1600;
const STANDARD_QUALITY = 0.78;
const SKIP_RECOMPRESS_MAX_BYTES = 300 * 1024;

const getFileSizeSafe = async uri => {
  if (!uri) return null;
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    return typeof info?.size === 'number' ? info.size : null;
  } catch {
    return null;
  }
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