import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';

export default function SupportSettings() {
  const router = useRouter();

  const openEmailSupport = () => {
    const email = 'support@mocconnect.in';
    const subject = 'Support Request';
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open email client');
    });
  };

  const openWhatsAppSupport = () => {
    const phoneNumber = '+919999999999'; // Replace with your support number
    const message = 'Hello, I need help with MoC App';
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open WhatsApp');
    });
  };

  const openHelpCenter = () => {
    const url = 'https://mocconnect.in/help';
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open Help Center');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Support</Text>
      </View>

      {/* Support Options */}
      <TouchableOpacity style={styles.optionRow} onPress={openEmailSupport}>
        <Text style={styles.optionText}>Contact via Email</Text>
        <Icon name="chevron-right" size={22} color="#888" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionRow} onPress={openWhatsAppSupport}>
        <Text style={styles.optionText}>Contact via WhatsApp</Text>
        <Icon name="chevron-right" size={22} color="#888" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionRow} onPress={openHelpCenter}>
        <Text style={styles.optionText}>Help Center / FAQs</Text>
        <Icon name="chevron-right" size={22} color="#888" />
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

  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 16,
    color: '#222',
  },
});
