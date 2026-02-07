import { useNavigation, useRoute } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getDeviceMetadata } from '../services/deviceMetadata';

import apiClient, { apiBaseURL } from '../services/apiClient';
import { saveSession } from '../services/authStorage';

const OtpScreen = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputs = useRef([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigation = useNavigation();

  const route = useRoute();
  const phoneNumber = route?.params?.phone ?? route?.params?.phoneNumber ?? '';

  const handleChange = (text, index) => {
    if (!/^\d?$/.test(text)) return; // Allow only single digit
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 5) inputs.current[index + 1].focus();
    if (!text && index > 0) inputs.current[index - 1].focus();
  };

  const verifyOtp = async () => {
    const otpValue = otp.join('');
    if (!phoneNumber) {
      setError('Missing phone number. Please return to the login screen and request a new code.');
      return;
    }
    if (otpValue.length !== 6) {
      setError('Please enter the 6-digit code sent to your phone.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError('');
      setMessage('');

       const metadata = await getDeviceMetadata();

      const response = await apiClient.post('/auth/otp/verify', {
        phone: phoneNumber,
        otp: otpValue,
        deviceModel: route?.params?.deviceModel ?? metadata.deviceModel,
        platform: route?.params?.platform ?? metadata.platform,
        appVersion: route?.params?.appVersion ?? metadata.appVersion,
        fcmToken: route?.params?.fcmToken ?? metadata.fcmToken,
      });
     const { userId, username, sessionId, accessToken, refreshToken, issuedAt } = response.data ?? {};

      await saveSession({
        userId,
        username: username ?? phoneNumber,
        sessionId,
        accessToken,
        refreshToken,
        issuedAt,
      });

      if (!accessToken || !refreshToken) {
        setError('Login succeeded but tokens were missing in the response. Please try again.');
        return;
      }
      setMessage('OTP verified. Logged in successfully.');
       const displayName = username ?? phoneNumber ?? '';
      navigation.reset({
        index: 0,
         routes: [
          {
            name: 'screens/CompleteProfileScreen',
            params: {
              phoneNumber,
              initialName: displayName,
            },
          },
        ],
      });
    } catch (err) {
       console.error('OTP verification failed:', err.message);
       setError('OTP verification failed. Please check the code and try again.');
    } finally {
      setIsSubmitting(false);
    }
    };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#1f6ea7" barStyle="light-content" />
      <Text style={styles.logo}>MOC</Text>
      <Text style={styles.baseUrl}>API: {apiBaseURL}</Text>
      {phoneNumber ? (
        <Text style={styles.phoneLabel}>Sending code to {phoneNumber}</Text>
      ) : (
        <Text style={styles.phoneLabelWarning}>
          No phone number supplied. Navigate to this screen with a `phone` param.
        </Text>
      )}
      {!!message && <Text style={styles.success}>{message}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.label}>Enter the 6-digit code</Text>

      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputs.current[index] = ref)}
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
            style={styles.otpInput}
            keyboardType="number-pad"
            maxLength={1}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={verifyOtp}
        disabled={isSubmitting}
      >
        <Text style={styles.buttonText}>{isSubmitting ? 'Verifying…' : 'Verify'}</Text>
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
    marginBottom: 24,
  },
  phoneLabel: {
    textAlign: 'center',
    color: '#333',
    marginBottom: 12,
  },
  phoneLabelWarning: {
    textAlign: 'center',
    color: '#c05621',
    marginBottom: 12,
  },
  label: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 32,
  },
  otpInput: {
    width: 48,
    height: 56,
    fontSize: 22,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderColor: '#1f6ea7',
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
  success: {
    color: '#2f855a',
    textAlign: 'center',
    marginBottom: 12,
  },
  error: {
    color: '#c53030',
    textAlign: 'center',
    marginBottom: 12,
  },
});

export default OtpScreen;
