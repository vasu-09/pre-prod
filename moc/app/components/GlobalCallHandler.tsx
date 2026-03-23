import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import useCallSignalingHook from '../hooks/useCallSignaling';

const CALL_PATHS = new Set([
  '/screens/CallScreen',
  '/screens/AudioCallReceivingScreen',
  '/screens/VideoCallScreen',
  '/screens/VideoCallReceivingScreen',
]);

export default function GlobalCallHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const activeCallIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!CALL_PATHS.has(pathname)) {
      activeCallIdRef.current = null;
    }
  }, [pathname]);

  const handleQueueEvent = useCallback(
    (event: any) => {
      if (!event || event.type !== 'call.invite') {
        return;
      }

      const callId = typeof event.callId === 'number' ? event.callId : Number(event.callId);
      if (!callId || Number.isNaN(callId)) {
        return;
      }

      if (activeCallIdRef.current === callId) {
        return;
      }

      if (CALL_PATHS.has(pathname)) {
        return;
      }

      activeCallIdRef.current = callId;
      const mode = String(event.mode ?? '').toLowerCase();
      const isVideo = mode === 'video';

      router.push({
        pathname: isVideo ? '/screens/VideoCallReceivingScreen' : '/screens/AudioCallReceivingScreen',
        params: {
          callId: String(callId),
          role: 'callee',
          name: 'Incoming call',
        },
      });
    },
    [pathname, router],
  );

  useCallSignalingHook({
    onQueueEvent: handleQueueEvent,
  });

  return null;
}