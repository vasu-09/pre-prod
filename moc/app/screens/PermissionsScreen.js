import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Request CALL_PHONE explicitly (simpler & safer)
const ANDROID_PHONE_PERMISSION = PermissionsAndroid?.PERMISSIONS?.CALL_PHONE ?? null;

const PermissionsScreen = () => {
  const router = useRouter();
  const [isRequesting, setIsRequesting] = useState(false);
  const [contactsStatus, setContactsStatus] = useState('undetermined');
  const [phoneStatus, setPhoneStatus] = useState(
  Platform.OS === 'android' ? 'undetermined' : 'granted'
);

  const [error, setError] = useState('');

  const handleNavigation = useCallback(() => {
    const contactsGranted = contactsStatus === 'granted';
    // phone is nice to have but don't hard-block login on it
     if (contactsGranted) router.replace('/screens/LoginScreen');
  }, [contactsStatus, router]);

  // Initial permission check on mount
  useEffect(() => {
    const checkPermissions = async () => {
      const contacts = await Contacts.getPermissionsAsync();
      setContactsStatus(contacts.status === 'granted' ? 'granted' : 'undetermined');

      if (Platform.OS === 'android' && ANDROID_PHONE_PERMISSION) {
        const granted = await PermissionsAndroid.check(ANDROID_PHONE_PERMISSION);
        setPhoneStatus(granted ? 'granted' : 'undetermined');
      } else {
        setPhoneStatus('granted');
      }
    };

    void checkPermissions();
  }, []);

  // Navigate whenever both are effectively granted
  useEffect(() => {
    handleNavigation();
  }, [handleNavigation]);

  const requestPermissions = async () => {
    setIsRequesting(true);
    setError('');

    try {
      // 1) Contacts permission
      const contactsResult = await Contacts.requestPermissionsAsync();
      const contactsGranted = contactsResult.status === 'granted';
      setContactsStatus(contactsGranted ? 'granted' : 'denied');

      // 2) Phone permission (Android only, best-effort)
      let phoneGranted = true;

      if (Platform.OS === 'android' && ANDROID_PHONE_PERMISSION) {
        try {
          const result = await PermissionsAndroid.request(ANDROID_PHONE_PERMISSION, {
            title: 'Allow phone access',
            message:
              'MoC needs phone access to verify your account and enable additional calling features.',
            buttonPositive: 'Allow',
            buttonNegative: "Don\'t allow",
          });

          phoneGranted = result === PermissionsAndroid.RESULTS.GRANTED;
          setPhoneStatus(phoneGranted ? 'granted' : 'denied');
        } catch (phoneErr) {
          console.warn('Phone permission error:', phoneErr);
          phoneGranted = false;
          setPhoneStatus('denied');
        }
      }

      // 3) Decide navigation
      if (contactsGranted) {
        // Contacts are mandatory, phone is optional for now
        router.replace('/screens/LoginScreen');
      } else {
        setError(
          "You’ll need to allow Contacts access to continue. You can also enable it later in your device settings."
        );
      }

      if (!phoneGranted && Platform.OS === 'android') {
        // Optional warning text
        setError(prev =>
          prev
            ? prev +
              '\n\nPhone permission was denied. Some calling features may not work until you allow it in settings.'
            : 'Phone permission was denied. Some calling features may not work until you allow it in settings.'
        );
      }
    } catch (err) {
      console.error('Failed to request permissions:', err);
      setError('Something went wrong while requesting permissions. Please try again.');
    } finally {
      setIsRequesting(false);
    }
  };

  const openSettings = () => {
    void Linking.openSettings();
  };

  

const renderPermissionStatus = (status) => {
  switch (status) {
    case 'granted':
      return 'Allowed';
    case 'denied':
      return 'Denied';
    default:
      return 'Required';
  }
};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Allow permissions</Text>
      <Text style={styles.subtitle}>
        To help you connect with people you know, MoC will request the following permissions.
      </Text>

      <View style={styles.permissionCard}>
        <View style={styles.permissionRow}>
          <View style={styles.iconPlaceholder}>
            <Text style={styles.icon}>👥</Text>
          </View>
          <View style={styles.permissionText}>
            <Text style={styles.permissionTitle}>Contacts</Text>
            <Text style={styles.permissionDescription}>
              Find people you know. Your contacts stay encrypted and private to MoC.
            </Text>
            <Text style={styles.permissionStatus}>{renderPermissionStatus(contactsStatus)}</Text>
          </View>
        </View>

        <View style={styles.permissionRow}>
          <View style={styles.iconPlaceholder}>
            <Text style={styles.icon}>📞</Text>
          </View>
          <View style={styles.permissionText}>
            <Text style={styles.permissionTitle}>Phone calls</Text>
            <Text style={styles.permissionDescription}>
              Make registration easier and enable additional calling features.
            </Text>
            <Text style={styles.permissionStatus}>{renderPermissionStatus(phoneStatus)}</Text>
          </View>
        </View>
      </View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.primaryButton, isRequesting && styles.disabledButton]}
        onPress={requestPermissions}
        disabled={isRequesting}
      >
        {isRequesting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Allow access</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={openSettings}>
        <Text style={styles.secondaryButtonText}>Open settings</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6f8',
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f1f1f',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#4a4a4a',
    marginBottom: 24,
    lineHeight: 22,
  },
  permissionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  iconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f1fb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
  },
  permissionText: {
    flex: 1,
    gap: 6,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  permissionDescription: {
    fontSize: 14,
    color: '#5a5a5a',
    lineHeight: 20,
  },
  permissionStatus: {
    fontSize: 12,
    color: '#1f6ea7',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  errorText: {
    marginTop: 20,
    color: '#c53030',
    fontSize: 14,
  },
  primaryButton: {
    marginTop: 32,
    backgroundColor: '#1f6ea7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 16,
    alignSelf: 'center',
  },
  secondaryButtonText: {
    color: '#1f6ea7',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PermissionsScreen;