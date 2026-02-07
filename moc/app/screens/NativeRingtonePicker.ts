// NativeRingtonePicker.ts
import Constants from 'expo-constants';
import { Alert, NativeModules, Platform } from 'react-native';

const { RingtonePicker } = NativeModules;

const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

const showPickerUnavailableAlert = () => {
  const platformHint =
    Platform.OS === 'android'
      ? 'Ensure the native module is linked in your Android build.'
      : 'This picker is only available on Android.';
  const buildHint = isExpoGo
    ? 'This feature does not work in Expo Go. Build a custom dev client or a native build (expo run:android or EAS build).'
    : 'Rebuild the app so the native module is included.';

  Alert.alert('Tone picker unavailable', `${platformHint}\n\n${buildHint}`);
};

const openNativeTonePicker = async (type: 'notification' | 'ringtone') => {
  if (!RingtonePicker?.openRingtonePicker) {
    const platformHint =
      Platform.OS === 'android'
        ? 'Ensure the native module is linked in your Android build.'
        : 'This picker is only available on Android.';
    console.warn(
      `RingtonePicker native module is unavailable. ${platformHint} ` +
        'If you are using Expo Go, use a custom dev client or a native build.'
    );
    showPickerUnavailableAlert();
    return null;
  }

  try {
    const result: { uri: string; title: string } =
      await RingtonePicker.openRingtonePicker(type);
    return result;
  } catch (error: unknown) {
    console.error('Ringtone Picker Error:', error);
    return null;
  }
};

export default openNativeTonePicker;