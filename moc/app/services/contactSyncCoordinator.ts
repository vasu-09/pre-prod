import type { ExistingContact } from 'expo-contacts';
import * as Contacts from 'expo-contacts';
import {
    getAllContactsFromDb,
    getContactsLastSyncedAt,
    getInviteContactsFromDb,
    getMatchedContactsFromDb,
    searchContactsInDb,
    searchMatchedContactsFromDb,
    setContactsLastSyncedAt,
    syncAndPersistContacts,
} from './contactStorage';
import type { StoredContactInput } from './database.native';

const DEFAULT_STALE_MS = 5 * 60 * 1000;

export type EnsureContactsSyncedOptions = {
  force?: boolean;
  staleMs?: number;
  requestPermission?: boolean;
};

export type EnsureContactsSyncedResult = {
  refreshed: boolean;
  permissionDenied: boolean;
  lastSyncedAt: string | null;
  error: Error | null;
};

let inFlightSync: Promise<EnsureContactsSyncedResult> | null = null;

const loadDeviceContactsWithPhones = async (): Promise<ExistingContact[]> => {
  const collected: ExistingContact[] = [];
  let pageOffset = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
      sort: Contacts.SortTypes.FirstName,
      pageSize: 250,
      pageOffset,
    });

    const withPhones = (response.data ?? []).filter((contact) => (contact.phoneNumbers ?? []).length > 0);
    collected.push(...withPhones);
    hasNextPage = response.hasNextPage;
    pageOffset += response.data.length;
  }

  return collected;
};

const resolvePermission = async (requestPermission = true): Promise<boolean> => {
  let permission = await Contacts.getPermissionsAsync();

  if (!permission.granted && requestPermission) {
    permission = await Contacts.requestPermissionsAsync();
  }

  return Boolean(permission.granted);
};

const shouldRefreshContacts = async (force: boolean, staleMs: number): Promise<boolean> => {
  if (force) {
    return true;
  }

  const lastSyncedAt = await getContactsLastSyncedAt();
  if (!lastSyncedAt) {
    return true;
  }

  const parsed = Date.parse(lastSyncedAt);
  if (Number.isNaN(parsed)) {
    return true;
  }

  return Date.now() - parsed >= staleMs;
};

const runContactsSync = async (options: EnsureContactsSyncedOptions): Promise<EnsureContactsSyncedResult> => {
  const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
  const force = Boolean(options.force);
  const requestPermission = options.requestPermission ?? true;

  try {
    const refreshNeeded = await shouldRefreshContacts(force, staleMs);

    if (!refreshNeeded) {
      return {
        refreshed: false,
        permissionDenied: false,
        lastSyncedAt: await getContactsLastSyncedAt(),
        error: null,
      };
    }

    const granted = await resolvePermission(requestPermission);

    if (!granted) {
      return {
        refreshed: false,
        permissionDenied: true,
        lastSyncedAt: await getContactsLastSyncedAt(),
        error: null,
      };
    }

    const contacts = await loadDeviceContactsWithPhones();
    await syncAndPersistContacts(contacts);

    const syncedAt = new Date().toISOString();
    await setContactsLastSyncedAt(syncedAt);

    return {
      refreshed: true,
      permissionDenied: false,
      lastSyncedAt: syncedAt,
      error: null,
    };
  } catch (error) {
    return {
      refreshed: false,
      permissionDenied: false,
      lastSyncedAt: await getContactsLastSyncedAt(),
      error: error instanceof Error ? error : new Error('Unknown contacts sync error'),
    };
  }
};

export const ensureContactsSynced = (options: EnsureContactsSyncedOptions = {}): Promise<EnsureContactsSyncedResult> => {
  if (!inFlightSync) {
    inFlightSync = runContactsSync(options).finally(() => {
      inFlightSync = null;
    });
  }

  return inFlightSync;
};

export const getCachedContacts = async (): Promise<StoredContactInput[]> => getAllContactsFromDb();

export const getCachedMatchedContacts = async (): Promise<StoredContactInput[]> => getMatchedContactsFromDb();

export const getCachedInviteContacts = async (): Promise<StoredContactInput[]> => getInviteContactsFromDb();

export const searchCachedContacts = async (query: string): Promise<StoredContactInput[]> =>
  searchContactsInDb(query);

export const searchCachedMatchedContacts = async (query: string): Promise<StoredContactInput[]> =>
  searchMatchedContactsFromDb(query);