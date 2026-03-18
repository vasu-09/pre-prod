import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Keyboard, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import apiClient, { apiBaseURL } from '../services/apiClient';
import { normalizeIndianPhoneNumber } from '../services/phoneNumber';

const LoginScreen = () => {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sendOtp = async (trimmedPhone) => {
    const normalizedPhone = normalizeIndianPhoneNumber(trimmedPhone);
    if (!normalizedPhone) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      await apiClient.post('/auth/otp/send', { phone: normalizedPhone });

     router.push({
        pathname: '/screens/OtpScreen',
        params: { phone: normalizedPhone },
      });
    } catch (err) {
      console.error('Failed to send OTP:', err);

      const serverMessage = err?.response?.data?.message;
      const baseMessage = serverMessage || err?.message || 'Unable to send OTP. Please try again.';

      if (!serverMessage && err?.message === 'Network Error') {
        const hintLines = [
          `Unable to reach the server at ${apiBaseURL}.`,
          '• Make sure the API gateway is running and accessible on your LAN.',
          '• If you are using Expo Go over a tunnel, set EXPO_PUBLIC_API_URL to a reachable host (or expose the API publicly).',
        ];

        setError(hintLines.join('\n'));
        return;
      }

      setError(baseMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhoneChange = (value) => {
    const sanitized = value.replace(/\D/g, '').slice(0, 10);
    setPhone(sanitized);

    if (error) {
      setError('');
    }
  };

  const handleSendOtp = () => {
    Keyboard.dismiss();

    if (isSubmitting) return;

    const trimmedPhone = phone.trim();
  if (trimmedPhone.length !== 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    setError('');

    const message = `+91 ${trimmedPhone}\n\nWe’ll send a verification code to this number. Messaging rates may apply.`;

     if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        const confirmed = window.confirm(`Is the phone number below correct?\n\n${message}`);
        if (confirmed) {
          void sendOtp(trimmedPhone);
        }
      }

      return;
    }

    Alert.alert('Is the phone number below correct?', message, [
      { text: 'Edit number', style: 'cancel' },
      { text: 'OK', onPress: () => { void sendOtp(trimmedPhone);}  },
    ]);
  };

  

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#1f6ea7" barStyle="light-content" />
      <Text style={styles.logo}>MOC</Text>
      <Text style={styles.baseUrl}>API: {apiBaseURL}</Text>

      {!!error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.label}>Enter your mobile number</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.countryCode}
          value="+91"
          editable={false}
          placeholderTextColor="#888"
        />
         <TextInput
          value={phone}
          onChangeText={handlePhoneChange}
          placeholder="e.g. 9876543210"
          placeholderTextColor="#888"
          keyboardType="phone-pad"
          maxLength={10}
          style={styles.input}
        />
      </View>
      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
         onPress={handleSendOtp}
        disabled={isSubmitting}
      >
        <Text style={styles.buttonText}>{isSubmitting ? 'Sending…' : 'Send OTP'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 150,
    justifyContent: 'flex-start',
  },
  logo: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#1f6ea7',
    alignSelf: 'center',
    marginBottom: 80,
  },
  baseUrl: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
    marginBottom: 30,
  },
  label: {
    fontSize: 18,
    marginBottom: 12,
    textAlign: 'left',
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f6ea7',
    borderRadius: 10,
    marginBottom: 20,
    overflow: 'hidden',
  },
  countryCode: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#f0f4f8',
    borderRightWidth: 1,
    borderRightColor: '#1f6ea7',
    minWidth: 60,
    textAlign: 'center',
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#000',
  },
  button: {
    backgroundColor: '#1f6ea7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#c53030',
    textAlign: 'center',
    marginBottom: 16,
  },
});

export default LoginScreen;
