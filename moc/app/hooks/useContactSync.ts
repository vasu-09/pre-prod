import { useCallback, useEffect, useState } from 'react';

import {
    ensureContactsSynced,
    getCachedContacts,
    getCachedInviteContacts,
    getCachedMatchedContacts,
} from '../services/contactSyncCoordinator';
import type { StoredContactInput } from '../services/database.native';

type ContactSelector = 'all' | 'matched' | 'invite';

type UseContactSyncOptions = {
  selector?: ContactSelector;
  refreshOnMount?: boolean;
  staleMs?: number;
};

const loadBySelector = async (selector: ContactSelector): Promise<StoredContactInput[]> => {
  if (selector === 'matched') {
    return getCachedMatchedContacts();
  }

  if (selector === 'invite') {
    return getCachedInviteContacts();
  }

  return getCachedContacts();
};

export const useContactSync = (options: UseContactSyncOptions = {}) => {
  const selector = options.selector ?? 'all';
  const refreshOnMount = options.refreshOnMount ?? true;
  const staleMs = options.staleMs;

  const [contacts, setContacts] = useState<StoredContactInput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string>('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  const reloadFromCache = useCallback(async () => {
    const cached = await loadBySelector(selector);
    setContacts(cached);
  }, [selector]);

  const refresh = useCallback(
    async (force = false) => {
      setIsRefreshing(true);
      setError('');

      const result = await ensureContactsSynced({ force, staleMs });
      await reloadFromCache();

      setPermissionDenied(result.permissionDenied);
      if (result.error) {
        console.warn('Background contact refresh failed', result.error);
        setError('Unable to refresh contacts right now. Showing saved contacts.');
      }

      setIsRefreshing(false);
      return result;
    },
    [reloadFromCache, staleMs],
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const cached = await loadBySelector(selector);
        if (!mounted) {
          return;
        }

        setContacts(cached);
      } catch (err) {
        console.warn('Failed to load cached contacts', err);
        if (mounted) {
          setError('Unable to load cached contacts right now.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }

      if (refreshOnMount) {
        await refresh(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [refresh, refreshOnMount, selector]);

  return {
    contacts,
    isLoading,
    isRefreshing,
    error,
    permissionDenied,
    refresh,
    reloadFromCache,
  };
};