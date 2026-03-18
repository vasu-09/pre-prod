import React, { useState } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import openNativeTonePicker from './NativeRingtonePicker'; // Adjust path as needed

export default function NotificationSettingsScreen() {
  const router = useRouter();

  const [messageNotifs, setMessageNotifs] = useState(true);
  const [messageVibrate, setMessageVibrate] = useState(true);
  const [messageTone, setMessageTone] = useState('Default');

  const [callNotifs, setCallNotifs] = useState(true);
  const [callVibrate, setCallVibrate] = useState(true);
  const [callTone, setCallTone] = useState('Default');

 const pickSystemTone = async (type) => {
  console.log('Opening tone picker for:', type); // Debug log
  const result = await openNativeTonePicker(type);
  console.log('Tone Picker result:', result); // Debug log

  if (result?.title) {
    if (type === 'notification') setMessageTone(result.title);
    if (type === 'ringtone') setCallTone(result.title);
  }
};


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Notification Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Messages Section */}
        <Text style={styles.sectionTitle}>Messages</Text>

        <View style={styles.settingRow}>
          <Text style={styles.settingText}>Enable Notifications</Text>
          <Switch
            value={messageNotifs}
            onValueChange={setMessageNotifs}
            thumbColor={messageNotifs ? '#1f6ea7' : '#ccc'}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingText}>Notification Tone</Text>
          <TouchableOpacity onPress={() => pickSystemTone('notification')}>
            <Text style={styles.toneLabel}>{messageTone}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingText}>Vibrate</Text>
          <Switch
            value={messageVibrate}
            onValueChange={setMessageVibrate}
            thumbColor={messageVibrate ? '#1f6ea7' : '#ccc'}
          />
        </View>

        {/* Calls Section */}
        <Text style={styles.sectionTitle}>Calls</Text>

        <View style={styles.settingRow}>
          <Text style={styles.settingText}>Enable Call Alerts</Text>
          <Switch
            value={callNotifs}
            onValueChange={setCallNotifs}
            thumbColor={callNotifs ? '#1f6ea7' : '#ccc'}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingText}>Ringtone</Text>
          <TouchableOpacity onPress={() => pickSystemTone('ringtone')}>
            <Text style={styles.toneLabel}>{callTone}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingText}>Vibrate</Text>
          <Switch
            value={callVibrate}
            onValueChange={setCallVibrate}
            thumbColor={callVibrate ? '#1f6ea7' : '#ccc'}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#444',
    marginTop: 24,
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingText: {
    fontSize: 15,
    color: '#222',
  },
  toneLabel: {
    color: '#1f6ea7',
    fontWeight: '500',
    fontSize: 15,
  },
});
