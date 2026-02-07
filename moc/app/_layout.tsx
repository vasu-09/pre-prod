// app/_layout.tsx
import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ChatProvider } from './context/ChatContext';
import { initializeDatabase } from './services/database';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  useEffect(() => {
    initializeDatabase().catch(err => console.warn('Failed to initialize SQLite', err));
  }, []);
  if (!loaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SafeAreaProvider>
        <ChatProvider>
          <Stack initialRouteName="screens/PermissionsScreen" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="screens/PermissionsScreen" options={{ headerShown: false }} />
            <Stack.Screen name="screens/LoginScreen" options={{ headerShown: false }} />
            <Stack.Screen name="screens/OtpScreen" options={{ headerShown: false }} />
            <Stack.Screen name="screens/CameraScreen" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="screens/NewListScreen" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="screens/ViewListScreen" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="screens/PreviewScreen" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="screens/MocScreen" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="screens/CompleteProfileScreen" options={{ headerShown: false }} />
            <Stack.Screen name="screens/AccountSettings" options={{ headerShown: false }} />
            <Stack.Screen name="screens/EditNameScreen" options={{ headerShown: false }} />
            <Stack.Screen name="screens/EditEmailScreen" options={{ headerShown: false }} />
            <Stack.Screen name="screens/InviteContactsScreen" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="screens/ListsScreen" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="screens/LinkListScreen" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="screens/SelectedPreview" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="+not-found" />
          </Stack>
        </ChatProvider>
      </SafeAreaProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
