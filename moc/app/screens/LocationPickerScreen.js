import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MapView from '../../components/MapView';
import { useChatSession } from '../hooks/useChatSession';

const DEFAULT_REGION = {
  latitude: 17.385,
  longitude: 78.4867,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const toRegion = coords => ({
  latitude: coords.latitude,
  longitude: coords.longitude,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
});

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    ),
  ]);

export default function LocationPickerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const mapRef = useRef(null);

  const [region, setRegion] = useState(DEFAULT_REGION);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(true);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  const normalizeParam = value => {
    if (Array.isArray(value)) return value[0];
    return value != null ? String(value) : undefined;
  };

  const roomId = normalizeParam(params?.roomId);
  const roomKey = normalizeParam(params?.roomKey);
  const peerId = normalizeParam(params?.peerId);
  const title = normalizeParam(params?.title);

  const { sendTextMessage } = useChatSession({
    roomId: roomId != null ? Number(roomId) : null,
    roomKey: roomKey ?? null,
    peerId: peerId != null ? Number(peerId) : null,
    title: title ?? null,
    disableSubscriptions: true,
  });

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const existing = await Location.getForegroundPermissionsAsync();
        let status = existing.status;

        if (status !== 'granted') {
          const requested = await Location.requestForegroundPermissionsAsync();
          status = requested.status;
        }

        if (!mounted) return;

        if (status !== 'granted') {
          setHasLocationPermission(false);
          setIsFetchingLocation(false);
          Alert.alert(
            'Location permission required',
            'Please allow location permission to share your location.'
          );
          return;
        }

        setHasLocationPermission(true);

        // Android-only: check whether device location itself is turned on
        try {
          const providerStatus = await Location.getProviderStatusAsync();
          if (
            Platform.OS === 'android' &&
            providerStatus &&
            providerStatus.locationServicesEnabled === false
          ) {
            Alert.alert(
              'Turn on location',
              'Please enable location services on your phone.'
            );
          }
        } catch (e) {
          console.warn('Provider status check failed', e);
        }

        // Fast path: use last known location first if available
        try {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (mounted && lastKnown?.coords) {
            setRegion(toRegion(lastKnown.coords));
          }
        } catch (e) {
          console.warn('Last known location failed', e);
        }

        // Fresh location with timeout so screen never hangs forever
        try {
          const current = await withTimeout(
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }),
            8000
          );

          if (mounted && current?.coords) {
            const nextRegion = toRegion(current.coords);
            setRegion(nextRegion);
            requestAnimationFrame(() => {
              mapRef.current?.animateToRegion?.(nextRegion, 500);
            });
          }
        } catch (e) {
          console.warn('Fresh location failed or timed out', e);
        }
      } catch (err) {
        console.error('Failed to load location:', err);
        Alert.alert('Location error', 'Unable to load location right now.');
      } finally {
        if (mounted) {
          setIsFetchingLocation(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const sendCurrent = async () => {
    if (!region) {
      Alert.alert('Location unavailable', 'Location is not ready yet.');
      return;
    }

    if (!roomId && !roomKey) {
      Alert.alert('Missing room details', 'Unable to send location right now.');
      return;
    }

    try {
      const url = `https://maps.google.com/?q=${region.latitude},${region.longitude}`;
      const payload = JSON.stringify({
        type: 'location',
        coords: {
          latitude: region.latitude,
          longitude: region.longitude,
        },
        url,
      });

      const sent = await sendTextMessage(payload);

      if (sent?.success) {
        router.back();
        return;
      }

      Alert.alert('Send failed', 'Unable to send location. Please try again.');
    } catch (err) {
      console.error('Send location failed:', err);
      Alert.alert('Send failed', 'Unable to send location. Please try again.');
    }
  };

  const centerMap = () => {
    mapRef.current?.animateToRegion?.(region, 500);
  };

  const mapHeight = isFullScreen
    ? Dimensions.get('window').height - insets.top
    : Dimensions.get('window').height * 0.5;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.title}>Send Location</Text>

        <TouchableOpacity onPress={() => {}} style={styles.iconBtn}>
          <Icon name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[styles.mapContainer, { height: mapHeight }]}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          region={region}
          onRegionChangeComplete={r => setRegion(r)}
          showsUserLocation={hasLocationPermission}
          showsMyLocationButton={false}
          liteMode={false}
        />

        {isFetchingLocation ? (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Getting your location...</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={() => setIsFullScreen(f => !f)}
          style={styles.fullscreenBtn}
        >
          <Icon
            name={isFullScreen ? 'fullscreen-exit' : 'fullscreen'}
            size={24}
            color="#1f6ea7"
          />
        </TouchableOpacity>

        <View style={styles.markerFixed}>
          <Icon name="place" size={40} color="red" />
        </View>

        <TouchableOpacity style={styles.locateBtn} onPress={centerMap}>
          <Icon name="my-location" size={24} color="#1f6ea7" />
        </TouchableOpacity>
      </View>

      <View style={styles.options}>
        <TouchableOpacity style={styles.optionRow} onPress={sendCurrent}>
          <Icon name="radio-button-checked" size={24} color="#1f6ea7" />
          <Text style={styles.optionText}>Send your current location</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    height: 56,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  backBtn: { padding: 8 },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  iconBtn: { padding: 8 },

  mapContainer: {
    width: '100%',
    backgroundColor: '#eee',
    overflow: 'hidden',
  },

  loadingOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10,
    zIndex: 2,
  },
  loadingText: {
    color: '#333',
    textAlign: 'center',
  },

  markerFixed: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40,
  },
  fullscreenBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 24,
    elevation: 3,
  },
  locateBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 24,
    elevation: 3,
  },

  options: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  optionText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
});