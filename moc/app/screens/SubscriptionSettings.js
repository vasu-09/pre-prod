import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../services/apiClient';
import { getStoredSession } from '../services/authStorage';

export default function SubscriptionSettings() {
  const router = useRouter();

  // Replace with real subscription data
  const [isSubscribed] = useState(true);
  const [autopayEnabled, setAutopayEnabled] = useState(false);
  const [isSubmittingAutopay, setIsSubmittingAutopay] = useState(false);
  const [statusText, setStatusText] = useState('');
  const startDate = '2025-07-01';
  const expiryDate = '2025-08-01';

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const getSubscriptionStatus = async () => {
    const { data } = await apiClient.get('/api/v1/payments/subscription/status');
    return data;
  };

  const reconcileSubscription = async () => {
    const { data } = await apiClient.post('/api/v1/payments/subscriptions/reconcile');
    return data;
  };

  const reconcileWithRetry = async (attempts = 6, delayMs = 2500) => {
    let lastResponse = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const data = await reconcileSubscription();
        lastResponse = data;

        if (data?.isActive === true) {
          return data;
        }
     if (
          data?.razorpayStatus === 'cancelled' ||
          data?.razorpayStatus === 'halted' ||
          data?.razorpayStatus === 'expired'
        ) {
          return data;
        }
      } catch (error) {
        lastResponse = { error };
      }

      if (attempt < attempts - 1) {
        await sleep(delayMs);
      }
    }

    return lastResponse;
  };

  useEffect(() => {
    const hydrateAutopayStatus = async () => {
      try {
        const data = await getSubscriptionStatus();
        setAutopayEnabled(Boolean(data?.isActive));
      } catch {
        // Best-effort passive refresh.
      }
    };

    hydrateAutopayStatus();
  }, []);

  const createAutopaySubscription = async () => {
    if (isSubmittingAutopay) {
      return;
    }

    try {
      setIsSubmittingAutopay(true);

      const session = await getStoredSession();
      const email = session?.email ?? null;
      const contact = session?.username ?? null;

      const payload = {
        email,
        contact,
      };

      setStatusText('Opening payment page...');
      const { data } = await apiClient.post('/api/v1/payments/subscriptions', payload);
      const shortUrl = data?.shortUrl ?? data?.short_url;

      if (!shortUrl) {
        throw new Error('Mandate authorization link not available.');
      }

      await WebBrowser.openBrowserAsync(shortUrl, {
        showTitle: true,
        enableBarCollapsing: true,
      });

      setStatusText('Checking subscription...');
      const finalState = await reconcileWithRetry(6, 2500);

      if (finalState?.isActive === true) {
        setAutopayEnabled(true);
        Alert.alert('Success', 'Your subscription is active now.');
        return;
      }

      const razorpayStatus = finalState?.razorpayStatus;
      if (
        razorpayStatus === 'pending' ||
        razorpayStatus === 'created' ||
        razorpayStatus === 'authenticated'
      ) {
        setAutopayEnabled(false);
        Alert.alert('Pending', 'Authorization is still being confirmed. Please refresh after a moment.');
        return;
      }

      setAutopayEnabled(false);
      Alert.alert('Not active', 'Subscription was not confirmed.');
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'We could not start AutoPay setup. Please try again.';

      Alert.alert('AutoPay setup failed', message);
      setAutopayEnabled(false);
    } finally {
      setIsSubmittingAutopay(false);
      setStatusText('');
    }
  };

  const handleAutopayToggle = async (value) => {
    if (value) {
      Alert.alert(
        'Enable AutoPay',
        'To enable AutoPay, you’ll be redirected to a secure payment page to authorize recurring payments.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => {
              // Navigate to a screen that launches Razorpay/Stripe Subscription Checkout
              createAutopaySubscription();
            },
          },
        ]
      );
    } else {
      setAutopayEnabled(false);
      // Optionally call backend to cancel the mandate
      Alert.alert('AutoPay Disabled', 'You will need to renew manually after expiry.');
    }
  };

  const handleSubscribe = () => {
    // Placeholder: Navigate to Razorpay/Payment flow
    Alert.alert('Subscribe', 'Navigate to subscription payment screen.');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Subscription</Text>
      </View>

      {/* Status Card */}
      <View style={styles.card}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={[styles.statusValue, { color: isSubscribed ? '#1f6ea7' : '#e53935' }]}> 
          {isSubscribed ? 'Active' : 'Not Subscribed'}
        </Text>

        {isSubscribed && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.dateLabel}>Start Date: <Text style={styles.dateValue}>{startDate}</Text></Text>
            <Text style={styles.dateLabel}>Expiry Date: <Text style={styles.dateValue}>{expiryDate}</Text></Text>
          </View>
        )}
      </View>

      {/* AutoPay */}
      <View style={styles.settingRow}>
        <Text style={styles.settingText}>AutoPay</Text>
        <Switch
          value={autopayEnabled}
          disabled={isSubmittingAutopay}
          onValueChange={handleAutopayToggle}
          thumbColor={autopayEnabled ? '#1f6ea7' : '#ccc'}
        />
      </View>

      {/* Payment Method (placeholder) */}
      <TouchableOpacity style={styles.settingRow}>
        <Text style={styles.settingText}>Payment Method</Text>
        <Icon name="chevron-right" size={22} color="#888" />
      </TouchableOpacity>

      {/* Subscribe / Renew Button */}
      {!!statusText && <Text style={styles.progressText}>{statusText}</Text>}

      <TouchableOpacity
        style={[styles.subscribeBtn, isSubmittingAutopay && styles.subscribeBtnDisabled]}
        onPress={handleSubscribe}
        disabled={isSubmittingAutopay}
      >
        <Text style={styles.subscribeText}>
          {isSubscribed ? 'Renew Subscription' : 'Subscribe Now'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  title: { fontSize: 18, fontWeight: '600' },

  card: {
    backgroundColor: '#f4f9fd',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusLabel: { fontSize: 14, color: '#555' },
  statusValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  dateLabel: { fontSize: 14, color: '#444', marginTop: 4 },
  dateValue: { fontWeight: '500' },

  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  settingText: {
    fontSize: 16,
    color: '#222',
  },

  subscribeBtn: {
    marginTop: 36,
    backgroundColor: '#1f6ea7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  subscribeBtnDisabled: {
    opacity: 0.7,
  },
  progressText: {
    marginTop: 20,
    color: '#1f6ea7',
    fontSize: 14,
    fontWeight: '500',
  },
  subscribeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});