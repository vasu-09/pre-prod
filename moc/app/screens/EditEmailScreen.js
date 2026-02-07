import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../services/apiClient';

const emailRegex = /^\S+@\S+\.\S+$/;

export default function EditEmailScreen() {
  const router = useRouter();
  const { currentEmail } = useLocalSearchParams();
 const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const initialEmailParam = useMemo(() => {
    if (typeof currentEmail === 'string') {
      return currentEmail;
    }
    if (Array.isArray(currentEmail) && currentEmail.length) {
      return currentEmail[0];
    }
    return '';
  }, [currentEmail]);



 useEffect(() => {
    let isMounted = true;
    const loadEmail = async () => {
      try {
        const { data } = await apiClient.get('/user/me/email');
        const nextEmail =
          typeof data?.email === 'string' && data.email.trim().length ? data.email : '';
        if (isMounted) {
          setEmail(initialEmailParam || nextEmail);
        }
      } catch (err) {
        console.error('Failed to load email address', err);
        if (isMounted) {
          setEmail(initialEmailParam);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadEmail();

    return () => {
      isMounted = false;
    };
  }, [initialEmailParam]);

  const handleSave = async () => {
    const trimmedEmail = email.trim();

    if (trimmedEmail && !emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address or leave the field blank.');
      return;
    }

     try {
      setIsSaving(true);
      await apiClient.put('/user/me/email', { email: trimmedEmail || null });
      router.replace({
        pathname: '/screens/AccountSettings',
        params: { updatedEmail: trimmedEmail },
      });
    } catch (err) {
      console.error('Failed to update email', err);
      Alert.alert('Unable to save changes', 'Please try again in a moment.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
       <TouchableOpacity onPress={() => router.back()} disabled={isSaving}>
            <Icon name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>Email</Text>
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (error) setError('');
            }}
            placeholder="Add your email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSaving}
            inputStyle={styles.input}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Text style={styles.subText}>
           Add an email address so we can reach you with important updates. Leave blank if you prefer
            not to share one.
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  title: { fontSize: 18, fontWeight: '600' },
  inputWrapper: { paddingHorizontal: 16, marginTop: 24 },
  label: { fontSize: 14, marginBottom: 8, color: '#444' },
  input: {
    borderWidth: 2,
    borderColor: '#1f6ea7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
  },
  subText: { fontSize: 13, color: '#555', marginTop: 16 },
  error: { color: '#c53030', marginTop: 8 },
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
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});