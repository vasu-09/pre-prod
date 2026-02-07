import { useRouter } from 'expo-router';
import { useState } from 'react';
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

export default function SubscriptionSettings() {
  const router = useRouter();

  // Replace with real subscription data
  const [isSubscribed] = useState(true);
  const [autopayEnabled, setAutopayEnabled] = useState(false);
  const startDate = '2025-07-01';
  const expiryDate = '2025-08-01';

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
              router.push('/screens/AutoPaySetupScreen');
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
      <TouchableOpacity style={styles.subscribeBtn} onPress={handleSubscribe}>
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
  subscribeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});