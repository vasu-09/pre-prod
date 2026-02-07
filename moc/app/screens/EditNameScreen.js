import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import displayNameService from '../services/displayNameService';

const MAX_NAME_LENGTH = 25;

export default function EditNameScreen() {
  const router = useRouter();
  const { currentName } = useLocalSearchParams();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const initialNameParam = useMemo(() => {
    if (typeof currentName === 'string') {
      return currentName;
    }
    if (Array.isArray(currentName) && currentName.length) {
      return currentName[0];
    }
    return '';
  }, [currentName]);

  useEffect(() => {
    let isMounted = true;

    const loadName = async () => {
      try {
        const serverName = await displayNameService.fetchDisplayName();
        if (isMounted) {
          setName(initialNameParam || serverName);
        }
      } catch (err) {
        console.error('Failed to load display name', err);
        if (isMounted) {
          setName(initialNameParam);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadName();

 return () => {
      isMounted = false;
    };
  }, [initialNameParam]);

  const handleSave = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Your name cannot be blank.');
      return;
    }

    try {
      setIsSaving(true);
      await displayNameService.updateDisplayName(trimmedName);
      router.replace({
        pathname: '/screens/AccountSettings',
        params: { updatedName: trimmedName },
      });
    } catch (err) {
      console.error('Failed to update display name', err);
      Alert.alert('Unable to save changes', 'Please try again in a moment.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} disabled={isSaving}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Name</Text>
      </View>

      <View style={styles.inputWrapper}>
        <Text style={styles.label}>Your name</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={name}
           onChangeText={(value) => {
              setName(value);
              if (error) setError('');
            }}
            maxLength={MAX_NAME_LENGTH}
            style={styles.input}
            editable={!isSaving}
          />
          <Icon name="emoji-emotions" size={22} color="#888" />
        </View>
        <Text style={styles.charCount}>{name.length}/{MAX_NAME_LENGTH}</Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.subText}>
         People will see this name if you interact with them and they don’t have you saved as a
          contact.
        </Text>
      </View>

        {isLoading ? <ActivityIndicator style={styles.loader} color="#1f6ea7" /> : null}

      <TouchableOpacity
        style={[styles.saveBtn, isSaving && styles.disabledBtn]}
        onPress={handleSave}
        disabled={isSaving}
      >
        <Text style={styles.saveText}>{isSaving ? 'Saving…' : 'Save'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { fontSize: 18, fontWeight: '600' },
  inputWrapper: { marginTop: 32 },
  label: { fontSize: 14, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1f6ea7',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  charCount: { textAlign: 'right', color: '#888', marginTop: 4 },
  error: { color: '#c53030', marginTop: 8 },
  subText: { fontSize: 13, color: '#555', marginTop: 16 },
  loader: { marginTop: 12 },
  saveBtn: {
    backgroundColor: '#1f6ea7',
    padding: 14,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  disabledBtn: { opacity: 0.7 },
});
