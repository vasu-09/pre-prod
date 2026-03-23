import { useNetInfo } from '@react-native-community/netinfo';
import { useMemo } from 'react';

export function useNetworkStatus() {
  const netInfo = useNetInfo();

  const isOnline = useMemo(() => {
    if (netInfo.isConnected !== true) {
      return false;
    }

    if (netInfo.isInternetReachable === false) {
      return false;
    }

    return true;
  }, [netInfo.isConnected, netInfo.isInternetReachable]);

  return {
    ...netInfo,
    isOnline,
    isOffline: !isOnline,
  };
}