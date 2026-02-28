import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../services/apiClient';
import { getStoredSession } from '../services/authStorage';
import { getUserProfileFromDb, upsertUserProfileInDb } from '../services/database';

const DEFAULT_PHOTO = 'https://randomuser.me/api/portraits/men/2.jpg';

const resolveParamValue = (param) => {
  if (Array.isArray(param)) {
    return param[0];
  }
  return param;
};

export default function AccountSettings() {
  const router = useRouter();
  const { updatedUri, updatedName, updatedEmail } = useLocalSearchParams();
  const [photoUri, setPhotoUri] = useState(DEFAULT_PHOTO);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isActiveRef = useRef(false);

  const fetchProfile = useCallback(async () => {
    if (!isActiveRef.current) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const session = await getStoredSession();
      if (!isActiveRef.current) {
        return;
      }

      const userIdValue = session?.userId ? Number(session.userId) : null;
      const nextPhone = session?.username ?? '';
      setPhoneNumber(nextPhone);

      if (!userIdValue) {
        setName('');
        setEmail('');
        setPhotoUri(DEFAULT_PHOTO);
        setError('Unable to load your profile. Please sign in again.');
        return;
      }

      const cachedProfile = await getUserProfileFromDb(userIdValue);
      if (isActiveRef.current && cachedProfile) {
        setName(cachedProfile.displayName ?? '');
        setEmail(cachedProfile.email ?? '');
        setPhotoUri(cachedProfile.avatarUrl || DEFAULT_PHOTO);
      }

      const { data } = await apiClient.get(`/user/${userIdValue}`);
      if (!isActiveRef.current) {
        return;
      }

      const nextName = typeof data?.displayName === 'string' ? data.displayName : '';
      const nextEmail = typeof data?.email === 'string' ? data.email : '';
      const nextPhoto = typeof data?.avatarUrl === 'string' && data.avatarUrl.length
        ? data.avatarUrl
        : DEFAULT_PHOTO;

        await upsertUserProfileInDb({
        userId: userIdValue,
        displayName: nextName,
        email: nextEmail,
        avatarUrl: nextPhoto,
        phoneNumber: nextPhone,
        updatedAt: new Date().toISOString(),
      });

      setName(nextName);
      setEmail(nextEmail);
      setPhotoUri(nextPhoto);
    } catch (err) {
      console.error('Failed to load account settings', err);
      if (isActiveRef.current) {
        setError('Unable to load profile. Pull to refresh.');
      }
    } finally {
      if (isActiveRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isActiveRef.current = true;
      fetchProfile();

      return () => {
        isActiveRef.current = false;
      };
    }, [fetchProfile]),
  );

  const handleRefresh = useCallback(async () => {
    if (!isActiveRef.current) {return;}

    setIsRefreshing(true);
    await fetchProfile();
    if (isActiveRef.current) {
      setIsRefreshing(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
   const nextUri = resolveParamValue(updatedUri);
    if (typeof nextUri === 'string' && nextUri.length) {
      setPhotoUri(nextUri);
    }

    const nextName = resolveParamValue(updatedName);
    if (typeof nextName === 'string') {
      setName(nextName);
    }

    const nextEmail = resolveParamValue(updatedEmail);
    if (typeof nextEmail === 'string') {
      setEmail(nextEmail);
    }
  }, [updatedUri, updatedName, updatedEmail]);

  const phoneLabel = useMemo(() => {
    if (phoneNumber && typeof phoneNumber === 'string') {
      return phoneNumber;
    }
    return 'Not available';
  }, [phoneNumber]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
      </View>
 <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#1f6ea7"
            colors={["#1f6ea7"]}
          />
        }
      >
        <View style={styles.profileSection}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/screens/ProfilePhotoScreen', params: { uri: photoUri } })}
          >
            <Image source={{ uri: photoUri }} style={styles.avatar} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push({ pathname: '/screens/ProfilePhotoScreen', params: { uri: photoUri } })}
          >
            <Text style={styles.changePhoto}>Change Photo</Text>
          </TouchableOpacity>
        </View>
       {isLoading ? <ActivityIndicator style={styles.loader} color="#1f6ea7" /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          onPress={() => router.push({ pathname: '/screens/EditNameScreen', params: { currentName: name } })}
        >
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Display Name</Text>
            <View style={styles.editRow}>
              <Text style={styles.input}>{name}</Text>
              <Icon name="edit" size={20} color="#1f6ea7" />
            </View>
          </View>
      </TouchableOpacity>

      <TouchableOpacity
          onPress={() => router.push({ pathname: '/screens/EditEmailScreen', params: { currentEmail: email } })}
        >
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.editRow}>
              <Text style={[styles.input, !email && styles.placeholderText]}>
                {email || 'Add an email address'}
              </Text>
              <Icon name="edit" size={20} color="#1f6ea7" />
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Phone Number</Text>
          <Text style={styles.staticText}>{phoneLabel}</Text>
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f6ea7',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  backBtn: { marginRight: 12 },
  headerTitle: { fontSize: 18, color: '#fff', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  profileSection: { alignItems: 'center', marginVertical: 24 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#ccc',
  },
  changePhoto: { color: '#1f6ea7', marginTop: 8, fontSize: 14 },
  loader: { marginBottom: 12 },
  errorText: {
    color: '#c53030',
    textAlign: 'center',
    marginHorizontal: 24,
    marginBottom: 12,
  },
  fieldContainer: { paddingHorizontal: 16, marginVertical: 10 },
  label: { color: '#666', marginBottom: 4, fontSize: 14 },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 6,
    color: '#333',
  },
  placeholderText: { color: '#999' },
  staticText: { fontSize: 16, color: '#333', paddingVertical: 6 },
});
