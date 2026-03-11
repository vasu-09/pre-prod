// app/index.tsx
import * as Contacts from 'expo-contacts';
import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getStoredSession } from './services/authStorage';

const PERMISSIONS_ROUTE = '/screens/PermissionsScreen' as Href;
const LOGIN_ROUTE = '/screens/LoginScreen' as Href;
const HOME_ROUTE = '/screens/MocScreen' as Href;

export default function Index() {
  const [targetRoute, setTargetRoute] = useState<Href | null>(null);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const contacts = await Contacts.getPermissionsAsync();

        if (!isMounted) return;

        if (contacts.status !== 'granted') {
          setTargetRoute(PERMISSIONS_ROUTE);
          return;
        }

        const { accessToken, refreshToken } = await getStoredSession();

        if (!isMounted) return;

        if (accessToken && refreshToken) {
          setTargetRoute(HOME_ROUTE);
          return;
        }

        setTargetRoute(LOGIN_ROUTE);
      } catch (err) {
        console.warn('Bootstrap routing failed', err);
        if (isMounted) {
          setTargetRoute(LOGIN_ROUTE);
        }
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!targetRoute) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff',
        }}
      >
        <ActivityIndicator size="large" color="#1f6ea7" />
      </View>
    );
  }

  return <Redirect href={targetRoute} />;
}
